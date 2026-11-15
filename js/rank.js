// ランキング（Firebase：匿名ログイン ＋ Firestore を REST で つかう。ライブラリは つかわない）
// ・ブラウザごとに 見えない ばんごう（uid）を もらい、プレイヤーごとの pid と くみあわせて 書く
// ・書きこみの ルール（他人の スコアは 書きかえられない・ありえない スコアは はじく）は Firestore の ルールで まもる
// ・つながらない ときは なにも しない（ゲームは そのまま あそべる）

const CFG = { apiKey: 'AIzaSyDNVFEECtrSf3U4nTL2o4Wz__hmavGjTqY', projectId: 'dribble-king' };
const DB = `https://firestore.googleapis.com/v1/projects/${CFG.projectId}/databases/(default)/documents`;
const LS = 'dribbat-rank-auth';

let auth = null;
function loadAuth() { try { auth = auth || JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { auth = null; } return auth; }
function saveAuth(a) { auth = a; try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) { /* noop */ } }

async function token() {
  const a = loadAuth();
  if (a && a.exp > Date.now() + 60000) return a;
  if (a && a.refresh) {
    const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${CFG.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(a.refresh)}` });
    if (r.ok) { const j = await r.json(); saveAuth({ uid: j.user_id, id: j.id_token, refresh: j.refresh_token, exp: Date.now() + (+j.expires_in) * 1000 }); return auth; }
  }
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CFG.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
  if (!r.ok) throw new Error('auth ' + r.status);
  const j = await r.json(); saveAuth({ uid: j.localId, id: j.idToken, refresh: j.refreshToken, exp: Date.now() + (+j.expiresIn) * 1000 }); return auth;
}

const val = (v) => (typeof v === 'number' ? { integerValue: String(Math.round(v)) } : { stringValue: String(v) });
const unval = (f) => { const o = {}; for (const [k, v] of Object.entries(f || {})) o[k] = v.integerValue !== undefined ? +v.integerValue : v.stringValue ?? v.timestampValue ?? null; return o; };

async function getDoc(path) { const r = await fetch(`${DB}/${path}`); if (r.status === 404) return null; if (!r.ok) throw new Error('get ' + r.status); return unval((await r.json()).fields); }
async function commit(a, path, data, extra = []) {
  const name = `projects/${CFG.projectId}/databases/(default)/documents/${path}`;
  const fields = {}; for (const [k, v] of Object.entries(data)) fields[k] = val(v);
  const body = { writes: [{ update: { name, fields }, updateTransforms: [{ fieldPath: 'ts', setToServerValue: 'REQUEST_TIME' }, ...extra] }] };
  const r = await fetch(`${DB.replace(/\/documents$/, '')}/documents:commit`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.id}` }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('commit ' + r.status);
}
async function query(col, field, value, limit = 300) {
  const body = { structuredQuery: { from: [{ collectionId: col }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: val(value) } }, limit } };
  const r = await fetch(`${DB}:runQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('query ' + r.status);
  return (await r.json()).filter((x) => x.document).map((x) => unval(x.document.fields));
}

// しゅうの ばんごう（にほん時間の げつようびの 日づけ）
export function weekId(d = new Date()) {
  const j = new Date(d.getTime() + 9 * 3600e3); const day = (j.getUTCDay() + 6) % 7; j.setUTCDate(j.getUTCDate() - day);
  return `${j.getUTCFullYear()}${String(j.getUTCMonth() + 1).padStart(2, '0')}${String(j.getUTCDate()).padStart(2, '0')}`;
}
export const stageKey = (stageId, level) => `${stageId}L${level}`;
// さんかは さいしょから オン（せってい で オフに できる）。ニックネームが ないときは 本名を つかわず「ドリブラー＋ばんごう」を じどうで つける
export function autoName(p) { if (!p.rkName) p.rkName = 'ドリブラー' + (100 + Math.floor(Math.random() * 900)); return p.rkName; }
export const canRank = (p) => !!(p && p.rk !== false && autoName(p));
const pidOf = (p) => String(p.id).replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'p';

// ステージの じこベストを おくる（いまより 上の ときだけ）
export async function sendBest(p, stageId, level, score, stars) {
  if (!canRank(p)) return null;
  const a = await token(); const st = stageKey(stageId, level); const pid = pidOf(p); const path = `best/${st}_${a.uid}_${pid}`;
  const old = await getDoc(path).catch(() => null);
  if (!old || score > old.score) await commit(a, path, { uid: a.uid, pid, name: p.rkName, stage: st, score, stars });
  return true;
}
// れんしゅう かいすうを 1 ふやす
export async function addPlay(p) {
  if (!canRank(p)) return null;
  const a = await token(); const wk = weekId(); const pid = pidOf(p); const path = `weekly/${wk}_${a.uid}_${pid}`;
  const old = await getDoc(path).catch(() => null);
  await commit(a, path, { uid: a.uid, pid, name: p.rkName, week: wk, plays: (old ? old.plays : 0) + 1 });
  return true;
}
// ランキングを よむ
export async function topStage(stageId, level, n = 10) { return (await query('best', 'stage', stageKey(stageId, level))).sort((x, y) => y.score - x.score).slice(0, n); }
export async function topWeek(n = 10) { return (await query('weekly', 'week', weekId())).sort((x, y) => y.plays - x.plays).slice(0, n); }
export function myId(p) { const a = loadAuth(); return a ? `${a.uid}_${pidOf(p)}` : ''; }
