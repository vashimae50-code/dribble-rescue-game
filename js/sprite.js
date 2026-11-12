// プレイヤーの 絵（スプライト）の コマえらびと、ボールの いち
// ・絵は うしろすがた。x は 画面の 右が ＋、y は 足元が 0、z は カメラがわ（せなか がわ）が ＋
// ・数字は 絵を 32px の マス目で はかって きめた もの（1マス 384px ＝ 1.65）
// ・左右の 手は 「hdribL（左手）」「hdribR（右手）」の シートを つかいわける（反転は しない：せばんごうが うらがえるため）

export const SHEETS = ['hpower', 'hdribL', 'hdribR', 'hside', 'hsideL', 'height', 'hleg', 'hwrap', 'hhead', 'hknees', 'hroll', 'hspin', 'hjstop'];

const R = 0.17;            // ボールの はんけい
const DX = 0.56;           // ドリブルする ボールの よこの いち（手の 真下）
const TOP = 0.52;          // ドリブルの いちばん 上（手に ふれる 高さ）
const HEAD = [0, 1.2], WAIST = 0.7, KNEE = 0.34, LEGX = 0.3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

// まわす ワザ：角度 → コマ（せなかがわ＝見える／よこ／おなかがわ＝かくれる）
function ring(th, rx, rz, cx, cy, back, side, front) {
  const x = Math.sin(th), z = Math.cos(th);
  const f = z > 0.55 ? (x < 0 ? back[0] : back[1]) : z < -0.55 ? (x < 0 ? front[0] : front[1]) : (x < 0 ? side[0] : side[1]);
  return { f, ball: { x: cx + x * rx, y: cy, z: z * rz } };
}

// st: { sk, cue, beat, vx, bp（3Dモデルが 出した ボールの いち）, mem（コマを またいで おぼえる 箱） }
export function spritePose(st) {
  const { sk, cue, beat, vx, bp, mem } = st;
  const cb = cue ? Math.max(0, beat - cue.b0) : 0;
  const hold = !cue || sk.hand === 'hold';
  const out = { sheet: 'hpower', f: 0, lift: 0, ball: null, ball2: null, hideBall: false };

  // 3Dモデルの ボールの 高さから、ドリブルの 上下（0＝ゆか 1＝手）を 出す
  if (bp) { if (mem.cue !== cue) { mem.cue = cue; mem.max = 0.3; } mem.max = Math.max(mem.max * 0.997, bp.y, 0.3); }
  const t = bp ? clamp((bp.y - 0.13) / Math.max(0.12, mem.max - 0.13), 0, 1) : 1;
  const rx = bp ? bp.x : 0.4;
  const strong = sk === undefined ? false : (cue && cue.skill === 'pound');
  const top = strong ? TOP + 0.08 : sk.low ? 0.36 : TOP;
  const dribY = R + t * (top - R);

  // スピン（その場で 1回転）
  if (cue && sk.spin) { const u = clamp(cb / 1.6, 0, 1); let f = Math.min(5, Math.floor(u * u * (3 - 2 * u) * 6)); if ((cue.dir || 1) < 0) f = (6 - f) % 6; out.sheet = 'hspin'; out.f = f; out.ball = { x: 0.3 * Math.cos(u * TAU) * ((cue.dir || 1)), y: dribY, z: -0.25 * Math.sin(u * TAU) }; return out; }
  // ジャンプストップ
  if (cue && sk.jump) { out.sheet = 'hjstop'; out.f = cb < 1 ? Math.min(3, Math.floor(cb * 4)) : cb < 1.5 ? 4 : 5; if (cb < 1) out.lift = Math.sin(Math.PI * cb) * 0.3; out.ball = { x: 0.3, y: 0.62 + out.lift, z: -0.12 }; return out; }
  // よこへ うごく（サイドステップ・ドライブ など）
  if (Math.abs(vx) > 0.9) { out.sheet = vx > 0 ? 'hside' : 'hsideL'; out.f = 1 + Math.floor(performance.now() / 100) % 4; if (!hold) out.ball = { x: (vx > 0 ? 1 : -1) * DX * 0.9, y: dribY, z: 0.02 }; else out.ball = { x: 0.32 * (vx > 0 ? 1 : -1), y: 0.62, z: -0.1 }; return out; }
  // ハンドリング（ボールまわし）
  if (cue && sk.handle) {
    const th = cb * Math.PI; let r;
    if (sk.handle === 'head') { r = ring(th, 0.27, 0.2, HEAD[0], HEAD[1], [3, 4], [2, 2], [2, 2]); out.sheet = 'hhead'; }
    else if (sk.handle === 'wrap') { r = ring(th, 0.4, 0.3, 0, WAIST - 0.06, [2, 3], [1, 4], [0, 5]); out.sheet = 'hwrap'; }
    else if (sk.handle === 'knees') { r = ring(th, 0.3, 0.22, 0, KNEE, [3, 3], [1, 4], [2, 2]); out.sheet = 'hknees'; }
    else if (sk.handle === 'leg') { const s = Math.floor(cb / 4) % 2 ? -1 : 1; r = ring(th * s, 0.2, 0.2, s * LEGX, KNEE - 0.02, [2, 2], s < 0 ? [3, 1] : [4, 3], [2, 2]); out.sheet = s < 0 ? 'height' : 'hleg'; }
    else if (sk.handle === 'eight') { const a = cb * Math.PI * 0.5; const x = Math.sin(a) * 0.4, z = Math.sin(2 * a) * 0.2; out.sheet = x < -0.12 ? 'height' : x > 0.12 ? 'hleg' : 'height'; out.f = Math.abs(x) <= 0.12 ? (z > 0 ? 4 : 1) : 3; out.ball = { x, y: 0.3, z }; return out; }
    else { out.sheet = 'hpower'; out.f = 0; out.ball = { x: 0.4 * Math.sin(Math.PI * cb), y: 0.32, z: 0.16 }; return out; } // うしろで ふる
    out.f = r.f; out.ball = r.ball; return out;
  }
  // ピボット・ロールターン
  if (cue && (sk.turn || sk.combo === 'roll')) { const p = sk.turn ? 4 : 2; out.sheet = 'hroll'; out.f = Math.min(5, Math.floor((cb % p) / p * 6)); out.ball = { x: 0.3, y: sk.turn ? 0.62 : dribY, z: -0.15 }; return out; }
  // 2ボール
  if (cue && sk.hand === 'two') { out.sheet = 'hdribL'; out.f = t > 0.6 ? 2 : 0; const t2 = st.bp2 ? clamp((st.bp2.y - 0.13) / Math.max(0.12, mem.max - 0.13), 0, 1) : t; out.sheet = 'hpower'; out.f = 0; out.ball = { x: DX * 0.85, y: dribY, z: 0.02 }; out.ball2 = { x: -DX * 0.85, y: R + t2 * (top - R), z: 0.02 }; return out; }
  // ボールを もつ（パワーポジション・ピタッ など）
  if (cue && cue.skill === 'jab') { const j = Math.sin(Math.min(1, (cb % 1) * 1.7) * Math.PI); out.sheet = (cue.dir || 1) > 0 ? 'hside' : 'hsideL'; out.f = j > 0.3 ? 1 : 0; out.ball = { x: 0.36 * ((cue.dir || 1) > 0 ? -1 : 1), y: 0.62, z: 0.05 }; return out; }
  if (hold) { out.sheet = 'hpower'; out.f = Math.floor(Math.max(0, beat) / 2) % 2 ? 5 : 0; out.ball = { x: 0.38, y: 0.62, z: 0.05 }; return out; }

  // ドリブル：ボールの ある がわの 手の シート。まんなかを とおる ときは ワザごとの コマ
  const side = rx < 0 ? -1 : 1; const ax = Math.abs(rx);
  const legsT = sk.legs || sk.combo === 'legs' || sk.fig8; const behindT = sk.behind || sk.combo === 'behind';
  if (ax < 0.24 && (sk.hand !== 'R' && sk.hand !== 'L')) {
    const u = clamp(rx / 0.24, -1, 1);
    if (behindT) { out.sheet = 'hwrap'; out.f = 2; out.ball = { x: u * 0.35, y: WAIST - 0.05, z: 0.3 }; }       // せなかの うしろを とおす（見える）
    else if (legsT) { out.sheet = side < 0 ? 'hdribL' : 'hdribR'; out.f = 1; out.ball = { x: u * 0.22, y: 0.24, z: 0 }; } // 足の あいだ
    else { out.sheet = 'hpower'; out.f = 0; out.ball = { x: u * 0.4, y: 0.24, z: -0.22 }; }                       // 体の まえ（フロントチェンジ）
    return out;
  }
  out.sheet = side < 0 ? 'hdribL' : 'hdribR';
  out.f = t > 0.72 ? 2 : t > 0.38 ? 4 : 0;
  out.ball = { x: side * DX, y: dribY, z: 0.02 };
  out.strong = strong;
  return out;
}
