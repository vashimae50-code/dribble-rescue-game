// ドリバト！（めざせ！ドリブルキング） メニュー・成長・ごほうび
import { SKILLS, SKILL_IDS, RANKS, TIERS, tierOf, rankSkills, poolFor, WORLDS, MISSIONS, STAGES, sl, FRIENDS, BOSS_FRIENDS, ALL_FRIENDS, BALLS, SUITS, SHOP_BALLS, ballComplete, SHOES, SHOP_SHOES, buyItem, KING_FRIEND, kingOpen, lvStar3, CAPSULE_COST, AVATARS,
  S, save, avHTML, MAX_LV, LEVEL_GOAL, LEVEL_SPEED, MAIN_STAGES, curLv, lvStars, lvTotal, lvCleared, lvDone, testReady, addPlayer, renamePlayer, player, totalStars, mastery, canTest, dayState, missionProgress, stamp, esc, MISSION_COIN, MISSION_ALL, missionAllDone, STREAK_RW, streakNow, GROW, growOf, budLv, BUD_LV, TITLES, checkTitles, titleOf, SP_ORDER } from './data.js';
import { runStage } from './run.js';
import { preloadStage } from './env.js';
import { ballIcon } from './balls.js';
import { shoeIcon } from './shoes.js';
import * as RK from './rank.js';
import * as MV from './move.js';

const app = document.getElementById('app'); const nav = document.getElementById('nav'); const gameEl = document.getElementById('game');
const gl = document.getElementById('gl'); const hud = document.getElementById('hud'); const overlay = document.getElementById('overlay'); const video = document.getElementById('pip');
let game = null, pose = null, wake = null, tab = 'home', videoMode = false;
const $ = (s) => app.querySelector(s);
const friend = (id) => ALL_FRIENDS.find((f) => f.id === id);

async function awake(on) { try { if (on && navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } else if (!on && wake) { await wake.release(); wake = null; } } catch (e) { wake = null; } }
function beep(notes, type = 'triangle') { if (!S.settings.sound) return; try { const c = new (window.AudioContext || window.webkitAudioContext)(); notes.forEach((sm, i) => { const o = c.createOscillator(); const g = c.createGain(); o.type = type; o.frequency.value = 523 * Math.pow(2, sm / 12); const t = c.currentTime + i * 0.11; g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.3); }); setTimeout(() => c.close(), 2500); } catch (e) { /* noop */ } }
function show(html, t, bare) {
  try { if (unmuteEl) unmuteEl.pause(); } catch (e) { /* noop */ }
  if (game) { game.stop(); game = null; } if (pose) { pose.stop(); pose = null; } awake(false); document.body.classList.remove('rec');
  if (t) tab = t; gameEl.hidden = true; app.hidden = false; nav.hidden = !!bare; app.innerHTML = (bare ? '' : topbar()) + html; window.scrollTo(0, 0);
  nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
}
function topbar() {
  const p = player(); const L = curLv(p); const r = RANKS[L];
  return `<div class="topbar"><button class="who" data-act="who">${avHTML(p.avatar)}<span>${esc(p.name)}${titleOf(p) ? `<small class="ttl">${titleOf(p).i} ${titleOf(p).n}</small>` : ''}</span></button>
    <span class="rank" style="--c:${r.c}">R${L} ${r.n}</span>
    <span class="cur">⭐ ${lvTotal(p, L)}</span><span class="cur coin">🪙 ${p.coins}</span></div>`;
}
const badge = (pts) => { const t = TIERS[tierOf(pts)]; const nx = TIERS[tierOf(pts) + 1]; const pr = nx ? (pts - t.at) / (nx.at - t.at) : 1; return `<span class="badge" style="--c:${t.c}">${t.i} ${t.n}</span><span class="mbar"><i style="width:${Math.round(pr * 100)}%;background:${nx ? nx.c : t.c}"></i></span>`; };

// ---------- ホーム ----------
function home() {
  const p = player(); const d = dayState(p); const r = RANKS[p.rank];
  const ms = d.missions.map((m) => { const v = Math.min(m.n, missionProgress(p, m)); const done = v >= m.n; const got = d.claimed.includes(m.id);
    return `<div class="ms ${done ? 'done' : ''}"><div><b>${m.text}</b><span class="mbar"><i style="width:${(v / m.n) * 100}%"></i></span><small>${v}/${m.n}</small></div>
      ${got ? '<span class="got">✔</span>' : done ? `<button class="claim" data-act="claim" data-id="${m.id}">🪙${MISSION_COIN} もらう</button>` : `<span class="rw">🪙${MISSION_COIN}</span>`}</div>`; }).join('')
    + (d.allGot ? '<div class="ms done allb"><b>🎁 ぜんぶ クリア ボーナス</b><span class="got">✔</span></div>' : missionAllDone(p) ? `<div class="ms done allb"><b>🎁 ぜんぶ クリア ボーナス！</b><button class="claim" data-act="claim" data-id="all">🪙${MISSION_ALL} もらう</button></div>` : `<div class="ms allb"><b>🎁 3つ ぜんぶで ボーナス</b><span class="rw">🪙${MISSION_ALL}</span></div>`);
  const sk7 = streakNow(p); let nxt = sk7 + 1; while (nxt < 3 || !STREAK_RW[nxt % 7]) nxt++; const nrw = STREAK_RW[nxt % 7];
  const st = p.stamps % 7;
  const weak = poolFor(curLv(p)).slice().sort((a, b) => mastery(p, a) - mastery(p, b))[0];
  show(`${MV.inLine() ? '<button class="banner warn" data-act="moveSafari"><b>⚠️ LINEの なかでは とまることが あります</b><small>タップで Safariに ひっこし（データも いっしょに うつります）</small></button>' : ''}
    <div class="hero">
      <div class="logo"><span>めざせ！ドリブルキング</span><b>ドリバト！</b></div>
      ${(() => { const L = curLv(p); const ls = lvStars(p, L); const nx = MAIN_STAGES.find((x) => !(ls[x.id] > 0)); return nx ? `<button class="play" data-act="stage" data-id="${nx.id}">▶ つづきから<small>${sl(nx)} ${MISSIONS[nx.mission].n}</small></button>` : '<button class="play" data-act="tab" data-tab="stages">▶ ステージへ</button>'; })()}
    </div>
    ${lvBanner(p)}
    <div class="card"><h2>📅 きょうの ミッション</h2>${ms}</div>
    <div class="card stampcard"><h2>🗓️ スタンプカード <small>あそんだひに 1こ。7こで カプセルけん 🎟️（とぎれても きえない）</small></h2>
      <div class="stamps">${Array.from({ length: 7 }, (_, i) => `<i class="${i < st || (st === 0 && p.stamps > 0 && p.lastDay === d.date && i < 7) ? 'on' : ''}">${i === 6 ? '🎟️' : '⭐'}</i>`).join('')}</div>
      <div class="streak"><b>🔥 れんぞく ${sk7}にち</b><small>${p.lastDay === d.date ? 'きょうも あそんだね！' : 'きょう あそぶと れんぞく ' + (sk7 + 1) + 'にち'}　つぎは ${nxt}にちめで ${nrw.t}（3にち 🪙30・5にち 🎟️・7にち 🪙100）</small></div>
      <small>カプセルけん：${p.tickets}まい</small></div>
    <button class="banner" data-act="dojo" data-id="${weak}"><b>💡 おすすめ れんしゅう：${SKILLS[weak].i} ${SKILLS[weak].n}</b><small>トレーニングルームで ゆっくり れんしゅうしよう</small></button>
    <div class="row2"><button class="mini" data-act="record">📒 きろく</button><button class="mini" data-act="how">❓ あそびかた</button><button class="mini" data-act="settings">⚙️ せってい（おうちのひと）</button></div>
  `, 'home');
}

// ---------- ステージ ----------
const testBtn = (p) => `<button class="banner test" data-act="testIntro"><b>🎓 しょうきゅうテストに ちょうせんできる！</b><small>R${p.rank} ${RANKS[p.rank].n} → R${p.rank + 1} ${RANKS[p.rank + 1].n}　ごうかくで つぎの レベルと 🪙100</small></button>`;
function lvBanner(p) {
  const L = curLv(p); const tot = lvTotal(p, L), cl = lvCleared(p, L), goal = LEVEL_GOAL[L]; const n = MAIN_STAGES.length;
  if (L === p.rank && testReady(p)) return testBtn(p);
  if (L < p.rank || L >= MAX_LV) return `<button class="banner" data-act="tab" data-tab="stages"><b>🏅 R${L} ${RANKS[L].n}　⭐${tot}/${n * 3}</b><small>${L < p.rank ? 'クリアずみの レベル' : 'さいごの レベル'}</small></button>`;
  return `<button class="banner" data-act="tab" data-tab="stages"><b>🏅 R${L} ${RANKS[L].n} → R${L + 1} ${RANKS[L + 1].n} まで</b><small>ステージ ★1いじょう ${cl}/${n}　・　⭐ ${tot}/${goal}</small><span class="mbar"><i style="width:${Math.min(100, (Math.min(cl / n, tot / goal)) * 100)}%"></i></span></button>`;
}
function stages() {
  const p = player(); const L = curLv(p); const ls = lvStars(p, L); const ts = lvTotal(p, L); const goal = LEVEL_GOAL[L]; const cl = lvCleared(p, L); const n = MAIN_STAGES.length;
  const tabs = `<section class="card lvcard"><div class="seg lvtabs">${Array.from({ length: MAX_LV }, (_, i) => i + 1).map((r) => `<button class="${r === L ? 'on' : ''}" ${r > p.rank ? 'disabled' : ''} data-act="lv" data-lv="${r}">${r > p.rank ? '🔒' : lvDone(p, r) ? '🏅' : ''}R${r} ${RANKS[r].n}</button>`).join('')}</div>
    <p class="hint">${L < MAX_LV ? (L < p.rank ? `R${L} は クリアずみ！ ⭐${ts}/${n * 3}` : `しょうきゅうテスト（R${L + 1} へ）が うけられる じょうけん：<b>ぜんぶの ステージで ★1いじょう（${cl}/${n}）</b> ＋ <b>⭐ ごうけい ${goal}こ（いま ${ts}こ）</b>　めざせ ぜんぶ ★2！`) : `さいごの レベル！ ⭐${ts}/${n * 3}`}</p>${L === p.rank && testReady(p) ? testBtn(p) : ''}</section>`;
  show(tabs + WORLDS.map((w, wi) => {
    const locked = !S.settings.openAll && ts < w.need;
    return `<section class="world ${locked ? 'locked' : ''}" style="--a:${w.pal.a};--b:${w.pal.b};--bg:${w.pal.bg};--img:url(img/court/${w.theme}1.webp)">
      <h2>コート ${wi + 1}　${w.name} ${locked ? `<small>🔒 ⭐${w.need}こで ひらく</small>` : ''}</h2>
      <div class="sgrid">${STAGES.filter((s) => s.wi === wi && !s.sp).map((s) => { const m = MISSIONS[s.mission]; const st = ls[s.id] || 0;
        return `<button class="stage ${m.boss ? 'boss' : ''}" ${locked ? 'disabled' : ''} data-act="stage" data-id="${s.id}" title="${wi + 1}-${s.mi + 1}"><span class="s-i">${m.i}</span><b>${m.n}</b><small>${wi + 1}-${s.mi + 1}</small><span class="s-st">${[1, 2, 3].map((n) => `<i class="${n <= st ? 'on' : ''}">★</i>`).join('')}</span></button>`; }).join('')}</div>
    </section>`; }).join('') + kingCard(p, L) + `<section class="world" style="--a:#ffb86b;--b:#ff7a1a;--bg:#2a1608"><h2>スペシャル</h2><div class="sgrid">${STAGES.filter((x) => x.sp && !x.king).sort((a, b) => SP_ORDER.indexOf(a.sp) - SP_ORDER.indexOf(b.sp)).map((x) => `<button class="stage" data-act="stage" data-id="${x.id}"><span class="s-i">${MISSIONS[x.mission].i}</span><b>${x.sp}</b><small>${MISSIONS[x.mission].n}</small><span class="s-st">${[1, 2, 3].map((n) => `<i class="${n <= (p.stars[x.id] || 0) ? 'on' : ''}">★</i>`).join('')}</span></button>`).join('')}</div><p class="hint">L1〜L10 は ワザを ステップで おぼえる ステージ（L1 から じゅんばんに）。H1 は うごかずに ハンドリングだけ。SP は ボールが 2つ いるよ。</p></section>`, 'stages');
}
// だいボス：レベルの ぜんぶの ステージで ★3を とると あらわれる
function kingCard(p, L) {
  const n = MAIN_STAGES.length, k = lvStar3(p, L), done = !!(p.king || {})[L];
  if (!kingOpen(p, L)) return `<section class="world kingw locked"><h2>👑 だいボス <small>🔒 R${L} の ぜんぶの ステージで ★3を とると あらわれる（いま ${k}/${n}）</small></h2><div class="kbar"><i style="width:${(k / n) * 100}%"></i></div></section>`;
  return `<section class="world kingw"><h2>👑 だいボスが あらわれた！ <small>R${L}${done ? '　🏆 たおした！' : ''}</small></h2><div class="sgrid"><button class="stage boss king" data-act="stage" data-id="sp-king"><span class="s-i">👑</span><b>だいボス せん</b><small>R${L} ファイナル</small><span class="s-st">${[1, 2, 3].map((x) => `<i class="${x <= (p.stars['sp-king'] || 0) ? 'on' : ''}">★</i>`).join('')}</span></button></div></section>`;
}
function stageIntro(id) {
  { const st0 = STAGES.find((x) => x.id === id); if (st0) preloadStage(st0.world.theme, st0.id, !!player().girl); }
  const s = STAGES.find((x) => x.id === id); const p = player(); const m = MISSIONS[s.mission]; const LV = s.sp ? p.rank : curLv(p); const pool = poolFor(LV);
  const feat = pool.filter((k) => (m.w[k] || 0) > 1).slice(0, 6); const list = (m.pool && m.pool.length > 8 ? m.pool.slice(0, 8) : m.pool) || (m.plan ? [...new Set(m.plan.flat().map((x) => x[0]))].filter((k) => SKILLS[k].combo || k === m.learn) : feat.length ? feat : pool.slice(-6));
  show(`<div class="card intro" style="--a:${s.world.pal.a};--b:${s.world.pal.b}">
      <div class="intro-h"><span class="bob">${m.i}</span><div><b>${s.sp ? '' : `R${LV} ・ `}${s.world.name} ${sl(s)}</b><h1>${m.n}</h1><small>${m.d}</small></div></div>
      <p class="hint">${m.plan ? m.steps.join('<br>') : m.pool && m.pool.some((k) => SKILLS[k].hand === 'two') ? 'ボールを 2つ よういしよう。' : m.pool ? 'うごかないで、ハンドリングの ワザだけ でるよ。' : `きみの ランク（R${p.rank} ${RANKS[p.rank].n}）に あわせた ワザが でるよ。`}</p>
      <div class="legend">${list.map((k) => `<div class="tile" style="--c:${SKILLS[k].c}"><b>${SKILLS[k].i} ${SKILLS[k].n}</b><span>${SKILLS[k].tips[0]}</span></div>`).join('')}</div>
      <p class="hint">${S.settings.camera ? '📷 カメラはんてい ON：ぜんしんが うつる ばしょに たとう' : '📺 がめんの おてほんに あわせて うごこう。まわりに ぶつかるものが ないか たしかめてね'}</p>
      <button class="big" id="go">▶ スタート</button><p class="hint" id="msg"></p>
      <button class="mini" data-act="tab" data-tab="stages">← もどる</button></div>`, 'stages');
  $('#go').addEventListener('click', () => start({ mode: 'stage', stage: s, level: LV, speedK: s.sp ? 1 : LEVEL_SPEED(LV) }));
}

// ---------- トレーニングルーム ----------
function training() {
  const p = player();
  show(`<div class="card"><h2>🥋 トレーニングルーム</h2><p class="hint">ワザを えらぶと、ゆっくり → ふつう → ゲームの はやさ の 3セットで れんしゅうできるよ。れんしゅうランクは「どれだけ れんしゅうしたか」の しるし。</p></div>
    ${[1, 2, 3, 4, 5, 6].map((r) => { const open = r <= p.rank || r === 6;
      return `<section class="rk ${open ? '' : 'locked'}" style="--c:${RANKS[r].c}"><h2>${r === 6 ? '🏀🏀' : 'R' + r} ${RANKS[r].n} <small>${RANKS[r].sub}${open ? '' : '　🔒 しょうきゅうすると ひらく（れんしゅうは できるよ）'}</small></h2>
        <div class="skills">${rankSkills(r).map((k) => `<button class="skill" data-act="dojo" data-id="${k}" style="--c:${SKILLS[k].c}"><span class="sk-i">${SKILLS[k].i}</span><b>${SKILLS[k].n}</b>${badge(mastery(p, k))}</button>`).join('')}</div></section>`; }).join('')}`, 'training');
}
function dojoIntro(id) {
  const sk = SKILLS[id]; const p = player();
  show(`<div class="card intro" style="--a:${sk.c};--b:#7dffb0"><div class="intro-h"><span class="bob">${sk.i}</span><div><b>トレーニングルーム</b><h1>${sk.n}</h1>${badge(mastery(p, id))}</div></div>
    <div class="tipbox">${sk.tips.map((t, i) => `<span>💡 コツ${i + 1}：${t}</span>`).join('')}</div>
    <p class="hint">3セット（ゆっくり → ふつう → ゲームの はやさ）。${(sk.hand === 'hold' && !sk.handle) || sk.lane ? 'さいしょの セットは ボールなしで あしだけ。' : ''}がめんの ロボの うごきを まねしよう。</p>
    <button class="big" id="go">▶ れんしゅう スタート</button><p class="hint" id="msg"></p><button class="mini" data-act="tab" data-tab="training">← もどる</button></div>`, 'training');
  $('#go').addEventListener('click', () => start({ mode: 'dojo', skill: id }));
}

// ---------- プレイ開始 ----------
// iPhone は 消音スイッチが入っていると 合成音（音楽・効果音）だけ 鳴らない。無音の音声を流して「メディア再生」あつかいにする
let unmuteEl = null;
function unmuteIOS() {
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* noop */ }
  try {
    if (!unmuteEl) {
      const n = 4000; const buf = new ArrayBuffer(44 + n); const v = new DataView(buf); const w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
      for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
      unmuteEl = document.createElement('audio'); unmuteEl.src = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })); unmuteEl.loop = true; unmuteEl.setAttribute('playsinline', ''); unmuteEl.volume = 0.01; document.body.appendChild(unmuteEl);
    }
    const pr = unmuteEl.play(); if (pr && pr.catch) pr.catch(() => {});
  } catch (e) { /* noop */ }
}
async function start(o) {
  unmuteIOS();
  let actx = null; try { actx = new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); const b = actx.createBuffer(1, 1, 22050); const src = actx.createBufferSource(); src.buffer = b; src.connect(actx.destination); src.start(0); } catch (e) { actx = null; }
  try { if (window.speechSynthesis && S.settings.voice && S.settings.voice !== 'en') { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; window.speechSynthesis.speak(u); } } catch (e) { /* noop */ }
  const p = player(); const st = S.settings; const msg = $('#msg'); const go = $('#go'); if (go) go.disabled = true; pose = null;
  if (st.camera) { if (msg) msg.textContent = '📷 カメラを じゅんびちゅう…'; try { const m = await import('./pose.js'); pose = await m.startPose(video, { sens: st.sens, swap: st.swap }); } catch (e) { pose = null; } }
  app.hidden = true; nav.hidden = true; gameEl.hidden = false; video.hidden = !pose; awake(true);
  const noCam = st.camera && !pose;
  const preview3D = new URLSearchParams(location.search).get('character3d') !== '0'; // 3D が ふだんの 表示。?character3d=0 で 絵（スプライト）
  // 3Dの ときは えらんだ かお（@c1〜@c8）の キャラクターを うごかす（絵の ときは いままでどおり）
  let human = null, foeHuman = null; try { if (msg) msg.textContent = 'キャラクターを よみこみちゅう…'; const ch = await import('./character.js'); human = await ch.loadHuman(preview3D ? ch.modelKeyFor(p.avatar) : undefined); foeHuman = human && human.userData.no7Replacement ? await ch.loadFoeHuman() : human; } catch (e) { human = null; }
  const look = { human, foeHuman, sprite: !preview3D, girl: !!p.girl, suit: SUITS.find((x) => x.id === p.suit)?.c, ball: BALLS.find((x) => x.id === p.ball), shoe: SHOES.find((x) => x.id === p.shoe), buddy: p.buddy ? friend(p.buddy)?.e : null, buddyLv: p.buddy ? budLv(p, p.buddy) : 1, grow: GROW[growOf(p)] };
  try {
    const qVid = new URLSearchParams(location.search).get('video');
    const vid = qVid || (st.videoRec && o.mode === 'stage' && o.stage ? o.stage.id : null); videoMode = !!vid; document.body.classList.toggle('rec', videoMode); // どうがは 1920×1080 で ろくが
    game = runStage({ gl, hud, overlay, ...o, video: !!vid, videoName: vid, actx, player: p, settings: st, pose, look,
      onQuit: () => { game = null; o.mode === 'dojo' ? training() : stages(); },
      onEnd: (r) => { game = null; if (pose) { pose.stop(); pose = null; } result(o, r, noCam); } });
  } catch (e) { show(`<div class="card"><h2>😢 3Dの がめんを ひらけませんでした</h2><p class="hint">${esc(e.message || e)}</p><button class="big" data-act="tab" data-tab="home">ホームへ</button></div>`); return; }
  if (noCam) { overlay.insertAdjacentHTML('beforeend', '<div class="toast">この がめんでは カメラが つかえないので、カメラなしで あそぶよ</div>'); setTimeout(() => { const t = overlay.querySelector('.toast'); if (t) t.remove(); }, 4000); }
}

// ---------- けっか ----------
function applyPractice(p, r, mult = 1) {
  const ups = []; const d = dayState(p);
  for (const k of Object.keys(r.counts)) { if (!SKILLS[k] || k === 'rest') continue; const before = mastery(p, k); const add = Math.round((r.counts[k] + (r.okCounts[k] || 0)) * mult); p.m[k] = before + add; d.cues[k] = (d.cues[k] || 0) + r.counts[k]; ups.push({ k, add, from: tierOf(before), to: tierOf(p.m[k]) }); }
  const g0 = growOf(p); const b0 = p.buddy ? budLv(p, p.buddy) : 0;
  p.leftReps = (p.leftReps || 0) + r.leftReps; p.rightReps = (p.rightReps || 0) + r.rightReps; p.tipIdx = r.tipIdx; p.plays++; d.plays = (d.plays || 0) + 1;
  if (p.buddy) { p.bud = p.bud || {}; p.bud[p.buddy] = (p.bud[p.buddy] || 0) + 1; }
  const recs = []; if (r.cam) { const rc = p.rec = p.rec || {}; rc.camPlays = (rc.camPlays || 0) + 1; // カメラの じこベスト
    for (const [k, v, n, u] of [['combo', r.maxCombo, 'さいだい コンボ', 'コンボ'], ['dribbles', r.dribbles, '1かいの ドリブル', 'かい'], ['speed', Math.round((r.speed || 0) * 10) / 10, 'はやい ドリブル', 'かい/びょう']]) { if (v > 0 && v > (rc[k] || 0)) { if (rc[k]) recs.push({ n, from: rc[k], to: v, u }); rc[k] = v; } } }
  const stamped = stamp(p); return { ups, stamped, g0, b0, recs };
}
const upsHtml = (ups) => `<div class="ups">${ups.sort((a, b) => (b.to - b.from) - (a.to - a.from) || b.add - a.add).slice(0, 8).map((u) => `<div class="up ${u.to > u.from ? 'lvl' : ''}" style="--c:${SKILLS[u.k].c}"><b>${SKILLS[u.k].i} ${SKILLS[u.k].n}</b><span>+${u.add}</span>${u.to > u.from ? `<em>${TIERS[u.to].i} ${TIERS[u.to].n}に アップ！</em>` : `<small>${TIERS[u.to].n}</small>`}</div>`).join('')}</div>`;
// あそんだ あとの ごほうび：れんぞく・そだつ・しょうごう・じこベスト
function endingHtml(p, e) {
  return `<div class="ending"><div class="rays"></div><div class="crown">👑</div><h2>おめでとう！</h2><p>R${e.L} の だいボスを たおした！<br>キミこそ <b>ドリブルキング</b>！</p>
    <div class="presents"><b>🎁 エンディング プレゼント</b>${e.friend ? `<span>${e.friend.e} なかま「${e.friend.n}」</span>` : ''}<span>👑 しょうごう「ドリブルキング」${Object.keys(p.king).length >= 6 ? '・「しんの ドリブルキング」' : ''}</span><span>🪙 200</span></div>
    <div class="roll"><span>${esc(p.name)} の ぼうけん</span><span>あそんだ かいすう ${p.plays}かい</span><span>ひだりて ${p.leftReps || 0}かい ／ みぎて ${p.rightReps || 0}かい</span><span>あつめた ★ ${Object.values(p.stars || {}).reduce((a, b) => a + b, 0)}こ</span><span>${e.L < 6 ? `つぎは R${e.L + 1} の だいボスが まってるぞ！` : 'ぜんぶの だいボスを たおした でんせつの プレイヤー！'}</span><span>THANK YOU FOR PLAYING!</span></div></div>`;
}
function extrasHtml(p, pr) {
  const out = []; const g = growOf(p); const row = (e, t, sub, cls = '') => `<div class="gift ${cls}"><span>${e}</span><div><b>${t}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
  if (g > pr.g0) out.push(row('🌱', `${GROW[g].n}に せいちょう！`, 'からだが すこし おおきく なって、オーラが つよく なったよ', 'rare'));
  for (const rc of pr.recs || []) out.push(row('🏆', `${rc.n} きろく こうしん！ ${rc.from} → ${rc.to} ${rc.u}`, '', 'rec'));
  if (pr.stamped && pr.stamped.rw) out.push(row('🔥', `${pr.stamped.streak}にち れんぞく！ ${pr.stamped.rw.t} ゲット`, ''));
  if (p.buddy && pr.b0 && budLv(p, p.buddy) > pr.b0) { const f = friend(p.buddy); out.push(row(f.e, `${f.n}が Lv${budLv(p, p.buddy)}に なった！`, 'ステージで すこし おおきく なるよ')); }
  for (const t of checkTitles(p)) out.push(row(t.i, `しょうごう「${t.n}」 ゲット！`, `${t.d}（ずかんで つけかえられる）`, 'rare'));
  return out.length ? `<div class="gifts">${out.join('')}</div>` : '';
}
function result(o, r, noCam) {
  const p = player();
  if (o.mode === 'dojo') return dojoResult(o, r);
  if (o.mode === 'test') return testResult(o, r);
  const s = o.stage; const m = MISSIONS[s.mission]; const d = dayState(p);
  const pr = applyPractice(p, r); const { ups, stamped } = pr; d.clears++; d.st = d.st || []; if (!d.st.includes(s.id)) d.st.push(s.id); if (r.stars >= 3) d.star3 = (d.star3 || 0) + 1; if (m.boss) d.boss = (d.boss || 0) + 1; addLog(p, { t: 'stage', id: s.id, stars: r.stars, score: r.score });
  const prevBest = p.best[s.id] || 0; const isBest = r.score > prevBest; if (isBest) p.best[s.id] = r.score; p.stars[s.id] = Math.max(p.stars[s.id] || 0, r.stars); let lvUp = 0; if (!s.sp) { const L = o.level || curLv(p); const ls = lvStars(p, L); ls[s.id] = Math.max(ls[s.id] || 0, r.stars); if (L === p.rank && testReady(p)) lvUp = p.rank; }
  let coins = 20 + (m.boss ? 10 : 0); let got = null;
  let ending = null; if (s.king) { const L = o.level || curLv(p); p.king = p.king || {}; const first = !Object.keys(p.king).length; if (!p.king[L]) { ending = { L, first, friend: null }; p.king[L] = true; coins += 200; if (!p.friends.includes(KING_FRIEND.id)) { p.friends.push(KING_FRIEND.id); ending.friend = KING_FRIEND; } } }
  if (m.boss && !s.king && !p.bossDone[s.world.id]) { p.bossDone[s.world.id] = true; const bf = BOSS_FRIENDS[s.wi]; if (!p.friends.includes(bf.id)) { p.friends.push(bf.id); got = bf; } }
  p.coins += coins; const extra = extrasHtml(p, pr); save();
  const next = STAGES[STAGES.indexOf(s) + 1]; const hk = r.hardest;
  show(`<div class="card result" style="--a:${s.world.pal.a};--b:${s.world.pal.b}">
      ${ending ? endingHtml(p, ending) : ''}<div class="res-h">${sl(s)} ${m.n}　クリア！</div>
      <div class="res-stars">${[1, 2, 3].map((n) => `<i class="${n <= r.stars ? 'on' : ''}" style="animation-delay:${n * 0.3}s">★</i>`).join('')}</div>
      <div class="res-score">⚡ ${r.score}　<span class="coinup">🪙 +${coins}</span></div>
      <div id="rkbox"></div>
      ${isBest && prevBest ? `<div class="recup big">🏆 さいこうきろく こうしん！ <b>${prevBest} → ${r.score}</b></div>` : ''}${extra}
      ${got ? `<div class="rescue rare"><div class="rays"></div><span>${got.e}</span><b>${got.n} が なかまに なった！</b><small>✨ ボスの なかま ✨</small></div>` : ''}
      <h3>れんしゅう ポイント</h3>${upsHtml(ups)}
      <div class="res-lines">${r.cam ? `<span>せいこう ${Math.round(r.hit * 100)}%</span><span>さいだい ${r.maxCombo} コンボ</span><span>ドリブル ${r.dribbles}かい</span>` : `<span>ルート：${r.tiers.map((x) => ['あんぜん', 'ふつう', 'ちかみち'][x]).join(' → ')}</span>`}${stamped ? '<span>🗓️ スタンプ +1</span>' : ''}</div>
      ${noCam ? '<p class="hint">📷 この がめんでは カメラが つかえなかったので、カメラなしで あそびました。</p>' : ''}
      ${r.cam && r.tracked < 0.5 ? '<p class="hint">📷 からだが あまり うつって いなかったよ。もうすこし はなれて ぜんしんを うつしてね。</p>' : ''}
      ${hk ? `<button class="banner" data-act="dojo" data-id="${hk}"><b>💡 ${SKILLS[hk].i} ${SKILLS[hk].n} を れんしゅうする？</b><small>コツ：${SKILLS[hk].tips[0]}</small></button>` : ''}
      ${lvUp ? testBtn(p) : ''}
      <div class="btns"><button class="big" data-act="stage" data-id="${s.id}">もういちど</button>${next ? `<button class="big alt" data-act="stage" data-id="${next.id}">つぎへ ▶</button>` : ''}<button class="big ghost" data-act="tab" data-tab="home">ホーム</button></div></div>`, 'stages');
  beep([0, 4, 7, 12, 16, 12, 19]);
  rankAfter(p, s, o.level || curLv(p), r);
}
// ランキング：おくって、このステージの じゅんいを 出す（つながらなければ なにも 出さない）
async function rankAfter(p, s, L, r) {
  const box = () => document.getElementById('rkbox'); if (!RK.canRank(p)) return; save(); // じどうの ニックネームを ほぞん
  try {
    await Promise.all([s.sp ? null : RK.sendBest(p, s.id, L, r.score, r.stars), RK.addPlay(p).catch(() => null)]);
    if (s.sp) return; const top = await RK.topStage(s.id, L, 100); const me = RK.myId(p); const i = top.findIndex((x) => `${x.uid}_${x.pid}` === me);
    if (box() && i >= 0) box().innerHTML = `<div class="recup">🏆 このステージ（R${L}）の ランキング <b>${i + 1}い</b> / ${top.length}にん</div>`;
  } catch (e) { console.warn('rank', e); }
}
function dojoResult(o, r) {
  const p = player(); const d = dayState(p); const sk = SKILLS[o.skill];
  const pr = applyPractice(p, r, 0.5); const { ups, stamped } = pr; d.dojo++; p.dojoN = (p.dojoN || 0) + 1; addLog(p, { t: 'dojo', id: o.skill }); const coins = d.dojo <= 3 ? 15 : 0; p.coins += coins; const extra = extrasHtml(p, pr); save();
  const tip = sk.tips[(p.tipIdx[o.skill] || 0) % sk.tips.length];
  show(`<div class="card result" style="--a:${sk.c};--b:#7dffb0"><div class="res-h">${sk.i} ${sk.n}　れんしゅう おわり！</div>
      <div class="res-score">${coins ? `<span class="coinup">🪙 +${coins}</span>` : '<small>きょうの コインは もう もらったよ（れんしゅうポイントは たまる）</small>'}</div>
      ${extra}${upsHtml(ups)}${stamped ? '<div class="res-lines"><span>🗓️ スタンプ +1</span></div>' : ''}
      ${r.cam ? `<div class="res-lines"><span>カメラで かくにん：${Math.round(r.hit * 100)}% せいこう</span></div>` : ''}
      <h3>どうだった？</h3>
      <div class="btns"><button class="big" data-act="tab" data-tab="training">😆 できた！</button><button class="big alt" id="tipbtn">💡 コツを きく</button><button class="big ghost" data-act="dojo" data-id="${o.skill}">🔁 もういちど</button></div>
      <div id="tipout"></div></div>`, 'training');
  $('#tipbtn').addEventListener('click', () => { p.tipIdx[o.skill] = (p.tipIdx[o.skill] || 0) + 1; save(); $('#tipout').innerHTML = `<div class="tipbox big"><span>💡 ${tip}</span><button class="big" data-act="dojoGo" data-id="${o.skill}">この コツで もういちど ▶</button></div>`; });
  beep([0, 7, 12]);
  if (RK.canRank(p)) { save(); RK.addPlay(p).catch(() => null); }
}

// ---------- しょうきゅうテスト ----------
function testIntro() {
  const p = player(); const ks = rankSkills(p.rank);
  show(`<div class="card intro" style="--a:${RANKS[p.rank + 1]?.c || '#fff'};--b:#ffe03d"><div class="intro-h"><span class="bob">🎓</span><div><b>しょうきゅうテスト</b><h1>R${p.rank} → R${p.rank + 1} ${RANKS[p.rank + 1].n}</h1><small>R${p.rank} の ワザだけが でる ステージ。さいごに しけんかんと しょうぶ！</small></div></div>
    <div class="legend">${ks.map((k) => `<div class="tile" style="--c:${SKILLS[k].c}"><b>${SKILLS[k].i} ${SKILLS[k].n}</b><span>${SKILLS[k].tips[0]}</span></div>`).join('')}</div>
    <p class="hint">${S.settings.camera ? '📷 カメラで はんていします（70%いじょうで ごうかく）。' : '👀 カメラなしの ときは、おわったあとに おうちのひとが ワザを かくにんします。おうちのひとと いっしょに やろう。'}</p>
    <button class="big" id="go">▶ テスト スタート</button><p class="hint" id="msg"></p><button class="mini" data-act="tab" data-tab="home">← もどる</button></div>`, 'home');
  $('#go').addEventListener('click', () => start({ mode: 'test', stage: { ...STAGES[Math.min(STAGES.length - 1, (p.rank - 1) * 6 + 5)], mission: 'dodge', sections: 2 } }));
}
function testResult(o, r) {
  const p = player(); const ks = rankSkills(p.rank); applyPractice(p, r); addLog(p, { t: 'test', id: 'R' + p.rank }); save();
  const pass = () => { p.verified[p.rank] = true; p.rank++; p.lv = p.rank; p.day = null; p.coins += 100; save(); beep([0, 4, 7, 12, 16, 19, 24]);
    show(`<div class="card result" style="--a:${RANKS[p.rank].c};--b:#ffe03d"><div class="rescue rare"><div class="rays"></div><span>🎓</span><b>ごうかく！ R${p.rank} ${RANKS[p.rank].n} に しょうきゅう！</b><small>${RANKS[p.rank].sub}　🪙 +100</small></div>
      <h3>あたらしい ワザ</h3><div class="legend">${rankSkills(p.rank).map((k) => `<div class="tile" style="--c:${SKILLS[k].c}"><b>${SKILLS[k].i} ${SKILLS[k].n}</b><span>${SKILLS[k].tips[0]}</span></div>`).join('')}</div>
      <div class="btns"><button class="big" data-act="tab" data-tab="training">トレーニングルームへ</button><button class="big ghost" data-act="tab" data-tab="home">ホーム</button></div></div>`, 'home'); };
  if (r.cam) {
    if (r.hit >= 0.7 && r.tracked > 0.5) return pass();
    return show(`<div class="card result"><div class="res-h">おしい！ せいこう ${Math.round(r.hit * 100)}%</div><p class="hint">70%いじょうで ごうかく。トレーニングルームで れんしゅうして、また ちょうせんしよう。</p>
      <div class="btns">${r.hardest ? `<button class="big" data-act="dojo" data-id="${r.hardest}">${SKILLS[r.hardest].i} ${SKILLS[r.hardest].n} を れんしゅう</button>` : ''}<button class="big ghost" data-act="tab" data-tab="home">ホーム</button></div></div>`, 'home');
  }
  const marks = {};
  const draw = () => {
    show(`<div class="card"><h2>👀 おうちのひと チェック</h2><p class="hint">おこさんの うごきを みて、ワザごとに えらんでください。ぜんぶ「できた」で しょうきゅうします。みられなかったひは「きょうは みられない」で、テストは もういちど うけられます。</p>
      ${ks.map((k) => `<div class="chk" style="--c:${SKILLS[k].c}"><div><b>${SKILLS[k].i} ${SKILLS[k].n}</b><small>${SKILLS[k].tips.join(' / ')}</small></div>
        <div class="seg"><button class="${marks[k] === 1 ? 'on' : ''}" data-k="${k}" data-v="1">できた</button><button class="${marks[k] === 0 ? 'on' : ''}" data-k="${k}" data-v="0">もうすこし</button></div></div>`).join('')}
      <div class="btns"><button class="big" id="decide" ${ks.every((k) => marks[k] != null) ? '' : 'disabled'}>けってい</button><button class="big ghost" data-act="tab" data-tab="home">きょうは みられない</button></div></div>`, 'home');
    app.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { marks[b.dataset.k] = +b.dataset.v; draw(); }));
    $('#decide').addEventListener('click', () => {
      const weak = ks.filter((k) => marks[k] === 0); if (!weak.length) return pass();
      show(`<div class="card result"><div class="res-h">あと すこし！</div><p class="hint">つぎの ワザを トレーニングルームで れんしゅうして、また ちょうせんしよう。</p>
        <div class="btns">${weak.map((k) => `<button class="big" data-act="dojo" data-id="${k}">${SKILLS[k].i} ${SKILLS[k].n}</button>`).join('')}<button class="big ghost" data-act="tab" data-tab="home">ホーム</button></div></div>`, 'home');
    });
  };
  draw();
}

// ---------- なかま ----------
let zTab = 'friends';
function friends() {
  const p = player(); checkTitles(p);
  const tabs = [['friends', `🐾 なかま ${p.friends.length}/${ALL_FRIENDS.length}`], ['balls', `🏀 ボール ${p.balls.length}/${BALLS.length}`], ['shoes', `👟 バッシュ ${p.shoes.length}/${SHOES.length}`], ['boss', `🛡️ ボス ${Object.keys(p.bossDone).length}/${WORLDS.length}`], ['titles', `🏅 しょうごう ${(p.titles || []).length}/${TITLES.length}`]];
  const seg = `<div class="seg ztabs">${tabs.map(([k, t]) => `<button class="${zTab === k ? 'on' : ''}" data-act="ztab" data-id="${k}">${t}</button>`).join('')}</div>`;
  let body = '';
  if (zTab === 'friends') body = `<p class="hint">タップすると バディに なって、ステージで いっしょに はしるよ。いっしょに あそぶほど レベルが あがって おおきく なる！（Lv2：${BUD_LV[1]}かい・Lv3：${BUD_LV[2]}かい・Lv4：${BUD_LV[3]}かい）</p>
    <div class="zukan">${ALL_FRIENDS.map((f) => { const lv = budLv(p, f.id); return p.friends.includes(f.id) ? `<button class="z on ${f.rare ? 'rare' : ''} ${p.buddy === f.id ? 'sel' : ''} lv${lv}" data-act="buddy" data-id="${f.id}"><span>${f.e}</span><b>${f.n}</b><small>Lv${lv}${'⭐'.repeat(lv - 1)}${p.buddy === f.id ? ' バディ' : ''}</small></button>` : `<div class="z"><span>？</span><b>？？？</b><small>${f.rare ? 'ボスを たおすと…' : 'カプセルで でる'}</small></div>`; }).join('')}</div>`;
  else if (zTab === 'balls') body = `<p class="hint">ショップで かえるよ。あつめた ボールは ショップで えらんで つかえる。</p>
    <div class="zukan">${BALLS.map((b) => p.balls.includes(b.id) ? `<div class="z on"><img class="zb" src="${ballIcon(b)}" alt=""><b>${b.n}</b><small>${p.ball === b.id ? 'つかっている' : ''}</small></div>` : b.secret ? `<div class="z"><span>💎</span><b>？？？</b><small>ぜんぶ あつめると…</small></div>` : `<div class="z"><img class="zb dim" src="${ballIcon(b)}" alt=""><b>？？？</b><small>🪙 ${b.cost}</small></div>`).join('')}</div>`;
  else if (zTab === 'shoes') body = `<p class="hint">ショップで かえるよ。あつめた バッシュは ショップで えらんで はける。</p>
    <div class="zukan">${SHOES.map((b) => p.shoes.includes(b.id) ? `<div class="z on"><img class="zs" src="${shoeIcon(b)}" alt=""><b>${b.n}</b><small>${p.shoe === b.id ? 'はいている' : ''}</small></div>` : b.secret ? `<div class="z"><span>👟</span><b>？？？</b><small>ぜんぶ あつめると…</small></div>` : `<div class="z"><img class="zs dim" src="${shoeIcon(b)}" alt=""><b>？？？</b><small>🪙 ${b.cost}</small></div>`).join('')}</div>`;
  else if (zTab === 'boss') body = `<p class="hint">コートの さいごの ボスを たおすと のるよ。</p>
    <div class="zukan">${WORLDS.map((w, i) => p.bossDone[w.id] ? `<div class="z on rare" style="--a:${w.pal.a}"><span>${BOSS_FRIENDS[i].e}</span><b>${w.boss}</b><small>コート ${i + 1}　たおした！</small></div>` : `<div class="z"><span>？</span><b>？？？</b><small>コート ${i + 1} の ボス</small></div>`).join('')}</div>`;
  else body = `<p class="hint">とった しょうごうを タップすると、なまえの よこに つくよ。</p>
    <div class="titles">${TITLES.map((t) => { const has = (p.titles || []).includes(t.id); return has ? `<button class="tt on ${p.title === t.id ? 'sel' : ''}" data-act="title" data-id="${t.id}"><span>${t.i}</span><b>${t.n}</b><small>${t.d}</small></button>` : `<div class="tt"><span>🔒</span><b>？？？</b><small>${t.d}</small></div>`; }).join('')}</div>`;
  show(`<div class="card"><h2>📖 ずかん</h2>${seg}${body}</div>`, 'friends');
}

// ---------- ショップ ----------
function shop(msg = '') {
  const p = player(); const left = FRIENDS.filter((f) => !p.friends.includes(f.id));
  const item = (kind, it, owned, sel) => `<button class="item ${sel ? 'sel' : ''}" data-act="buy" data-kind="${kind}" data-id="${it.id}">${kind === 'ball' ? `<img class="sw ball" src="${ballIcon(it)}" alt="">` : kind === 'shoe' ? `<img class="sw shoe" src="${shoeIcon(it)}" alt="">` : `<span class="sw" style="background:${it.c}"></span>`}<b>${it.n}</b><small>${sel ? 'つかっている' : owned ? 'もっている' : `🪙 ${it.cost}`}</small></button>`;
  show(`${msg}<div class="card capsule"><h2>🎁 なかまカプセル</h2><p class="hint">まだ いない なかまが かならず ひとり でるよ（かぶりなし）。のこり ${left.length}にん</p>
      <div class="btns"><button class="big" data-act="capsule" data-pay="coin" ${left.length && p.coins >= CAPSULE_COST ? '' : 'disabled'}>🪙 ${CAPSULE_COST} で まわす</button><button class="big alt" data-act="capsule" data-pay="ticket" ${left.length && p.tickets > 0 ? '' : 'disabled'}>🎟️ けんで まわす（${p.tickets}）</button></div></div>
    <div class="card"><h2>🏀 ボール <small>${SHOP_BALLS.filter((b) => p.balls.includes(b.id)).length}/${SHOP_BALLS.length}</small></h2><p class="hint">ぜんぶ あつめると… ひみつの ボールが もらえるよ！</p><div class="items">${BALLS.filter((b) => !b.secret || p.balls.includes(b.id)).map((b) => item('ball', b, p.balls.includes(b.id), p.ball === b.id)).join('')}</div></div>
    <div class="card"><h2>👟 バッシュ <small>${SHOP_SHOES.filter((b) => p.shoes.includes(b.id)).length}/${SHOP_SHOES.length}</small></h2><p class="hint">ぜんぶ あつめると… ひみつの バッシュが もらえるよ！</p><div class="items">${SHOES.filter((b) => !b.secret || p.shoes.includes(b.id)).map((b) => item('shoe', b, p.shoes.includes(b.id), p.shoe === b.id)).join('')}</div></div>
    <div class="card"><h2>✨ オーラの いろ</h2><div class="items">${SUITS.map((b) => item('suit', b, p.suits.includes(b.id), p.suit === b.id)).join('')}</div></div>
    <p class="hint">コインで かえるのは みためだけ。つよさは かわらないよ。</p>`, 'shop');
}

// ---------- そのほか ----------
function how() {
  show(`<div class="card"><h2>❓ あそびかた</h2><ol class="how">
    <li>テレビや iPad の まえに、ボールを もって たとう。<b>まわりに ぶつかるものが ないか</b> たしかめてね。</li>
    <li>つうろの おくから <b>ゲート</b> が せまってくる。くぐるときに、その ワザに きりかえる！</li>
    <li>がめんの <b>ロボ</b>が おてほん。うごきを まねしよう。「みぎへ」「ひだりへ」は <b>1〜2ほ</b> うごく。</li>
    <li><b>セーフゾーン</b>では ボールをもって きゅうけい。つぎの ルートを えらべる。「むずかしい」を えらぶと コツが でる。</li>
    <li>ワザを やるたびに <b>れんしゅうポイント</b>が たまる。レベルの ステージを ぜんぶ クリアして ★が たまったら <b>しょうきゅうテスト</b>。ごうかくで つぎの レベルへ。</li>
    <li>むずかしい ワザは <b>トレーニングルーム</b>で ゆっくり れんしゅうできる。</li></ol>
    <p class="hint">🗣️ にほんごの こえ：VOICEVOX:No.7</p>
    <p class="hint">📷 カメラはんてい：iPad・iPhone を 2〜3m はなして ぜんしんを うつすと、ての さゆう・ひくさ・はやさ・もちかえ・さゆうの うごき・ジャンプを みます。レッグスルーや ビハインドは「もちかえたか」まで。カメラが つかえない がめんでは じどうで カメラなしに なります。</p></div>`, 'home');
}
function settings() {
  const st = S.settings; const tg = (k, l) => `<label class="toggle"><input type="checkbox" data-set="${k}" ${st[k] ? 'checked' : ''}><span>${l}</span></label>`;
  show(`<div class="card"><h2>⚙️ せってい（おうちのひとむけ）</h2>
    ${tg('camera', '📷 カメラはんていを つかう')}<div class="prow"><b>🗣️ こえの あいず</b><div class="seg">${[['en', 'English'], ['ja', 'にほんご'], ['', 'オフ']].map(([v, l]) => `<button class="${(st.voice || '') === v || (st.voice === true && v === 'ja') ? 'on' : ''}" data-voice="${v}">${l}</button>`).join('')}</div></div>${tg('bloom', '✨ ひかりの えんしゅつ（うごきが おもい ときは オフ）')}${tg('music', '🎵 おんがく')}${tg('sound', '🔊 こうかおん')}${tg('openAll', '🔓 すべての コートを ひらく（おためし）')}${tg('swap', '📷 みぎてとひだりてを いれかえる（ぎゃくに かぞえるとき）')}${tg('videoRec', '🎬 どうが ろくがモード（つぎに あそぶ ステージを じどうで ろくがする・セーフゾーンの せんたくも スキップ）')}
    <div class="prow"><b>🎵 おんがくの スタイル</b><div class="seg">${[['workout', 'ダンス（アップテンポ）'], ['game', 'ゲーム（ピコピコ）']].map(([v, l]) => `<button class="${(st.musicStyle || 'workout') === v ? 'on' : ''}" data-ms="${v}">${l}</button>`).join('')}</div></div>
    <h3>🔈 おとの おおきさ</h3>
    ${[['volMusic', '🎵 おんがく', 0.5], ['volBall', '🏀 ボールの おと', 1], ['volVoice', '🗣️ こえ', 1]].map(([k, l, d]) => `<div class="prow"><b>${l}</b><input type="range" min="0" max="100" step="5" value="${Math.round((st[k] ?? d) * 100)}" data-vol="${k}" style="flex:1;max-width:260px"><span class="volv" style="width:3em;text-align:right">${Math.round((st[k] ?? d) * 100)}</span></div>`).join('')}
    <h3>🔊 おとの テスト</h3><p class="hint">おとが でないときに、どのほうしきなら きこえるかを たしかめます。1つずつ おして、きこえたものを おしえてください。</p>
    <div class="btns"><button class="big ghost" id="ta">① ごうせいおん</button><button class="big ghost" id="tb">② おんせいファイル</button><button class="big ghost" id="tc">③ こえ → ごうせいおん</button></div><p class="hint" id="tout"></p>
    <h3>プレイヤーと ランク</h3><p class="hint">いまの じつりょくに あわせて、スタートの ランクを えらんでください。ランクが あがるほど むずかしい ワザが でます。</p>
    ${S.players.map((p) => `<div class="prow"><b>${avHTML(p.avatar)}</b><input class="pname-edit" maxlength="10" value="${esc(p.name)}" data-pid="${p.id}" style="width:6em"><div class="seg">${[1, 2, 3, 4, 5, 6].map((r) => `<button class="${p.rank === r ? 'on' : ''}" data-rank="${r}" data-pid="${p.id}">R${r}</button>`).join('')}</div><button class="mini" data-girl="${p.id}" title="おとこのこ／おんなのこ">${p.girl ? '👧 おんなのこ' : '👦 おとこのこ'}</button><button class="mini danger" data-del="${p.id}">けす</button></div>`).join('')}
    <h3>📦 ひっこし（ほかの ブラウザ・たんまつへ）</h3><p class="hint">LINEの なかから Safariへ うつるときや、ほかの iPad に うつすときに つかいます。プレイヤー・★・コイン・ボールなど ぜんぶ うつります。</p>
    <div class="btns"><button class="big" data-act="moveSafari">🧭 Safariで ひらく（データごと）</button><button class="big ghost" id="mvcopy">📋 ひっこしコードを コピー</button></div>
    <p class="hint">Safariで ひらかないときは：①「ひっこしコードを コピー」→ ② Safariで このゲームを ひらく → ③ せっていの ここに はりつけて「コードで ひっこし」</p>
    <textarea id="mvin" rows="2" placeholder="ここに ひっこしコードを はりつけ" style="width:100%"></textarea><button class="big ghost" id="mvgo">📥 コードで ひっこし</button><p class="hint" id="mvmsg"></p>
    <h3>🛠 エラーきろく</h3><p class="hint">とまった・おかしかった ときに、ここを スクショして おくってください。</p><pre class="errlog">${(() => { try { const L = JSON.parse(localStorage.getItem('dribble-errlog') || '[]'); return L.length ? L.map((x) => esc(`${x.t} [${x.w}${x.ph ? '/' + x.ph : ''}${x.st ? '/' + x.st : ''}] ${x.m}`)).join('\n\n') : 'なし'; } catch (e) { return 'なし'; } })()}</pre>
    <h3>🏆 ランキング</h3><p class="hint">さいしょから オンです。ニックネームと スコア・れんしゅうかいすうが インターネットの ランキングに のります（URLを しっている ひとなら だれでも みられます）。ニックネームは さいしょ「ドリブラー＋ばんごう」に なっています。かえるときも ほんみょうは いれないでください。のせたくない ときは「さんか」を オフに してください。</p>
    ${S.players.map((p) => `<div class="prow"><b>${avHTML(p.avatar)} ${esc(p.name)}</b><label class="toggle"><input type="checkbox" data-rkon="${p.id}" ${p.rk !== false ? 'checked' : ''}><span>さんか</span></label><input class="rkname" maxlength="10" placeholder="ニックネーム" value="${esc(RK.autoName(p))}" data-rkname="${p.id}" style="width:8em"></div>`).join('')}
    <p class="hint">${[1, 2, 3, 4, 5, 6].map((r) => `R${r} ${RANKS[r].n}：${rankSkills(r).map((k) => SKILLS[k].n).join('・')}`).join('<br>')}</p>
    <p class="hint">きろくは この たんまつの ブラウザの なかだけに ほぞんされます。</p></div>`, 'home');
  app.querySelectorAll('[data-set]').forEach((i) => i.addEventListener('change', () => { st[i.dataset.set] = i.checked; save(); }));
  const tout = $('#tout'); const say = (t) => { tout.textContent = t; };
  const wav = () => { const sr = 8000, n = sr * 0.6; const buf = new ArrayBuffer(44 + n); const v = new DataView(buf); const w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); }; w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); for (let i = 0; i < n; i++) v.setUint8(44 + i, 128 + Math.round(Math.sin(i / sr * 6.283 * (i < n / 2 ? 660 : 880)) * 90 * (1 - i / n))); return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })); };
  const tone = (c) => { [0, 4, 7].forEach((sm, i) => { const o = c.createOscillator(); const g = c.createGain(); o.frequency.value = 523 * Math.pow(2, sm / 12); const t = c.currentTime + i * 0.15; g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.32); }); };
  $('#mvcopy').addEventListener('click', async () => { try { const c = await MV.makeCode(); try { await navigator.clipboard.writeText(c); alertMsg('📋 コピーしました（' + c.length + 'もじ）。Safariで ひらいて はりつけてね'); } catch (e) { $('#mvin').value = c; $('#mvin').select(); alertMsg('コピーできなかったので、うえの わくの もじを ぜんぶ えらんで コピーしてね'); } } catch (e) { alertMsg('つくれませんでした'); } });
  $('#mvgo').addEventListener('click', () => { const v = $('#mvin').value.trim(); if (!v) return alertMsg('コードを はりつけてね'); moveIn(v); });
  $('#ta').addEventListener('click', async () => { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const s0 = c.state; try { await c.resume(); } catch (e) { /* noop */ } tone(c); say(`① ごうせいおん：はじめ=${s0} → いま=${c.state}（ポポポと 3おん なるはず）`); setTimeout(() => say(`① ごうせいおん：はじめ=${s0} → 1びょうご=${c.state} じかん=${c.currentTime.toFixed(2)}`), 1000); } catch (e) { say('① エラー：' + e.message); } });
  $('#tb').addEventListener('click', async () => { try { const a = document.createElement('audio'); a.src = wav(); a.setAttribute('playsinline', ''); await a.play(); say('② おんせいファイル：さいせいできた（ピポと なるはず）'); } catch (e) { say('② エラー：' + e.name + ' ' + e.message); } });
  $('#tc').addEventListener('click', async () => { try { const c = new (window.AudioContext || window.webkitAudioContext)(); try { await c.resume(); } catch (e) { /* noop */ } const u = new SpeechSynthesisUtterance('Test'); u.lang = 'en-US'; window.speechSynthesis.speak(u); setTimeout(() => { const s1 = c.state; try { c.resume(); } catch (e) { /* noop */ } tone(c); setTimeout(() => say(`③ こえの あと：ごうせいおん=${s1} → ${c.state}（こえの あとに 3おん なるはず）`), 600); }, 1500); say('③ こえ → ごうせいおん を ためしちゅう…'); } catch (e) { say('③ エラー：' + e.message); } });
  app.querySelectorAll('[data-vol]').forEach((i) => { i.addEventListener('input', () => { i.nextElementSibling.textContent = i.value; }); i.addEventListener('change', () => { st[i.dataset.vol] = (+i.value) / 100; save(); if (st.sound) beep([0, 7]); }); });
  app.querySelectorAll('[data-ms]').forEach((b) => b.addEventListener('click', () => { st.musicStyle = b.dataset.ms; save(); settings(); }));
  app.querySelectorAll('[data-voice]').forEach((b) => b.addEventListener('click', () => { st.voice = b.dataset.voice || false; save(); settings(); }));
  app.querySelectorAll('[data-rank]').forEach((b) => b.addEventListener('click', () => { const p = S.players.find((x) => x.id === b.dataset.pid); p.rank = +b.dataset.rank; p.lv = p.rank; p.day = null; save(); settings(); }));
  app.querySelectorAll('[data-rkon]').forEach((i) => i.addEventListener('change', () => { const p = S.players.find((x) => x.id === i.dataset.rkon); if (p) { p.rk = i.checked; save(); } }));
  app.querySelectorAll('[data-rkname]').forEach((i) => i.addEventListener('change', () => { const p = S.players.find((x) => x.id === i.dataset.rkname); if (p) { p.rkName = i.value.trim().slice(0, 10); if (!p.rkName) RK.autoName(p); save(); settings(); } }));
  app.querySelectorAll('[data-girl]').forEach((b) => b.addEventListener('click', () => { const p = S.players.find((x) => x.id === b.dataset.girl); if (p) { p.girl = !p.girl; save(); preloadStage(null, null, p.girl); } settings(); }));
  app.querySelectorAll('.pname-edit').forEach((i) => i.addEventListener('change', () => { const p = S.players.find((x) => x.id === i.dataset.pid); if (p) renamePlayer(p, i.value); settings(); }));
  app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.sure) { S.players = S.players.filter((x) => x.id !== b.dataset.del); if (S.current === b.dataset.del) S.current = null; save(); settings(); } else { b.dataset.sure = '1'; b.textContent = 'ほんとうに けす'; } }));
}
function addLog(p, e) { const d = new Date(); p.log = p.log || []; p.log.unshift({ ...e, d: `${d.getMonth() + 1}/${d.getDate()}`, h: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` }); p.log = p.log.slice(0, 40); p.lastPlay = Date.now(); }
const cleared = (p) => lvCleared(p, curLv(p));
const ago = (ts) => { if (!ts) return 'まだ あそんでいない'; const dd = Math.floor((Date.now() - ts) / 86400000); return dd <= 0 ? 'きょう あそんだ' : dd === 1 ? 'きのう あそんだ' : `${dd}にちまえに あそんだ`; };
// ---------- だれが あそぶ？ ----------
function who() {
  const ps = S.players.filter((x) => !x.guest || x.plays > 0);
  if (!ps.length) return players(true);
  show(`<div class="hero"><div class="logo"><span>めざせ！ドリブルキング</span><b>ドリバト！</b></div></div>
    <h2 class="whoq">だれが あそぶ？</h2>
    <div class="wholist">${ps.map((x) => { const nx = MAIN_STAGES.find((y) => !(lvStars(x, curLv(x))[y.id] > 0)); return `<button class="whocard" data-act="pick" data-id="${x.id}" style="--c:${RANKS[x.rank].c}">
      <span class="wav">${avHTML(x.avatar)}</span><span class="wbody"><b>${esc(x.name)}</b><span class="rank" style="--c:${RANKS[x.rank].c}">R${x.rank} ${RANKS[x.rank].n}</span>
      <small>R${curLv(x)}　⭐ ${lvTotal(x, curLv(x))}　ステージ ${cleared(x)}/${MAIN_STAGES.length}　🪙 ${x.coins}</small><small>${nx ? `つぎは ${sl(nx)}` : 'ぜんぶ クリア！'}・${ago(x.lastPlay)}</small></span></button>`; }).join('')}
      <button class="whocard add" data-act="players"><span class="wav">＋</span><span class="wbody"><b>あたらしい プレイヤー</b><small>なまえと ランクを えらぶ</small></span></button></div>`, 'home', true);
}
// ---------- きろく ----------
function record() {
  const p = player(); const tiers = [0, 0, 0, 0, 0]; SKILL_IDS.forEach((k) => { tiers[tierOf(mastery(p, k))]++; });
  show(`<div class="card"><h2>📒 ${avHTML(p.avatar)} ${esc(p.name)} の きろく</h2>
      <div class="stats"><div><b>R${p.rank}</b><small>${RANKS[p.rank].n}${p.verified[p.rank - 1] ? ' ✅' : ''}</small></div><div><b>${cleared(p)}/${MAIN_STAGES.length}</b><small>R${curLv(p)} クリアした ステージ</small></div><div><b>⭐${lvTotal(p, curLv(p))}</b><small>/${MAIN_STAGES.length * 3}</small></div><div><b>${p.stamps || 0}にち</b><small>あそんだひ</small></div><div><b>${p.plays || 0}かい</b><small>プレイ</small></div><div><b>${p.friends.length}</b><small>なかま</small></div></div></div>
    <div class="card"><h2>🌱 せいちょう</h2>${(() => { const g = growOf(p); const nx = GROW[g + 1]; return `<div class="res-lines"><span>いま：<b>${GROW[g].n}</b></span><span>${nx ? `${nx.n}まで あと ${nx.at - p.plays}かい` : 'さいこうの すがた！'}</span><span>🔥 さいこう れんぞく ${p.streakBest || 0}にち</span></div>`; })()}
      ${p.rec && p.rec.camPlays ? `<div class="res-lines"><span>📷 カメラで ${p.rec.camPlays}かい</span><span>さいだい ${p.rec.combo || 0} コンボ</span><span>1かいで ドリブル ${p.rec.dribbles || 0}かい</span><span>いちばん はやい ${p.rec.speed || 0}かい/びょう</span></div>` : '<p class="hint">📷 カメラで あそぶと、コンボや ドリブルの はやさの きろくが のこるよ。</p>'}</div>
    <div class="card"><h2>🏆 ランキング</h2>${RK.canRank(p) ? '' : '<p class="hint">いまは ランキングに さんか していないよ（せってい で オンに できる）。</p>'}
      <div class="seg ztabs"><button class="${rkTab === 'week' ? 'on' : ''}" data-rk="week">💪 こんしゅうの れんしゅうかいすう</button><button class="${rkTab === 'stage' ? 'on' : ''}" data-rk="stage">⚡ ステージの スコア</button></div>
      ${rkTab === 'stage' ? `<select id="rksel" class="rksel">${MAIN_STAGES.map((x) => `<option value="${x.id}" ${x.id === rkStage ? 'selected' : ''}>${sl(x)} ${MISSIONS[x.mission].n}</option>`).join('')}</select><small class="hint">（いまの レベル R${curLv(p)} の ランキング）</small>` : ''}
      <div id="rklist" class="rklist"><p class="hint">よみこみちゅう…</p></div></div>
    <div class="card"><h2>🗺️ ステージ</h2>${WORLDS.map((w, wi) => `<div class="recrow"><b style="color:${w.pal.a}">${wi + 1} ${w.name}</b><span>${STAGES.filter((x) => x.wi === wi && !x.sp).map((x) => { const v = lvStars(p, curLv(p))[x.id] || 0; return `<i class="${v ? 'on' : ''}" title="${sl(x)}">${v ? '★'.repeat(v) : '・'}</i>`; }).join('')}</span></div>`).join('')}</div>
    <div class="card"><h2>🥋 れんしゅうランク</h2><div class="res-lines">${TIERS.map((t, i) => `<span style="color:${t.c}">${t.i} ${t.n} ${tiers[i]}</span>`).join('')}</div>
      <div class="ups">${SKILL_IDS.filter((k) => mastery(p, k) > 0).sort((a, b) => mastery(p, b) - mastery(p, a)).map((k) => `<div class="up" style="--c:${SKILLS[k].c}"><b>${SKILLS[k].i} ${SKILLS[k].n}</b><span>${mastery(p, k)}</span><small>${TIERS[tierOf(mastery(p, k))].n}</small></div>`).join('') || '<p class="hint">まだ ありません</p>'}</div>
      <p class="hint">ひだりて ${p.leftReps || 0}かい ／ みぎて ${p.rightReps || 0}かい</p></div>
    <div class="card"><h2>🕒 さいきんの きろく</h2>${(p.log || []).map((e) => { const st = e.t === 'stage' ? STAGES.find((x) => x.id === e.id) : null; return `<div class="logrow"><small>${e.d} ${e.h}</small><b>${e.t === 'stage' && st ? `${sl(st)} ${MISSIONS[st.mission].n}` : e.t === 'dojo' ? `🥋 ${SKILLS[e.id]?.n || ''}` : `🎓 しょうきゅうテスト ${e.id}`}</b><span>${e.t === 'stage' ? '★'.repeat(e.stars) + `　⚡${e.score}` : ''}</span></div>`; }).join('') || '<p class="hint">まだ ありません</p>'}</div>
    <p class="hint">きろくは この たんまつの なかに、プレイヤーごとに ほぞんされます。</p>`, 'home');
  app.querySelectorAll('[data-rk]').forEach((b) => b.addEventListener('click', () => { rkTab = b.dataset.rk; record(); }));
  const sel = $('#rksel'); if (sel) sel.addEventListener('change', () => { rkStage = sel.value; record(); });
  (async () => { const el = () => document.getElementById('rklist'); const me = RK.myId(p);
    try { const L = curLv(p); const rows = rkTab === 'stage' ? await RK.topStage(rkStage || MAIN_STAGES[0].id, L) : await RK.topWeek();
      if (!el()) return; el().innerHTML = rows.length ? rows.map((x, i) => `<div class="rkrow ${`${x.uid}_${x.pid}` === me ? 'me' : ''}"><b>${['🥇', '🥈', '🥉'][i] || i + 1}</b><span>${esc(x.name)}</span><em>${rkTab === 'stage' ? `⚡${x.score} ${'★'.repeat(x.stars || 0)}` : `${x.plays}かい`}</em></div>`).join('') : '<p class="hint">まだ だれも いないよ。いちばんのりを めざそう！</p>';
    } catch (e) { if (el()) el().innerHTML = '<p class="hint">ランキングに つながりませんでした（インターネットを たしかめてね）。</p>'; } })();
}
let rkTab = 'week', rkStage = '';
function players(first) {
  let av = AVATARS[S.players.length % AVATARS.length]; let rank = 1;
  show(`${first === true ? '<div class="hero"><div class="logo"><span>めざせ！ドリブルキング</span><b>ドリバト！</b></div></div>' : ''}<div class="card"><h2>${first === true ? 'はじめに プレイヤーを つくろう' : 'あたらしい プレイヤー'}</h2>
    <h3>なまえ</h3><input id="pname" maxlength="8" placeholder="なまえ" autocomplete="off">
    <div class="avatars">${AVATARS.map((a) => `<button class="av ${a === av ? 'on' : ''}" data-av="${a}">${avHTML(a)}</button>`).join('')}</div>
    <p class="hint">スタートの レベル（ここから はじまります。つぎの レベルは ステージを クリアして しょうきゅうテストに ごうかくすると ひらく）</p><div class="seg" id="rk">${[1, 2, 3, 4, 5, 6].map((r) => `<button class="${r === 1 ? 'on' : ''}" data-r="${r}">R${r} ${RANKS[r].n}</button>`).join('')}</div>
    <button class="big" id="psave">つくる</button>${first === true ? '' : '<button class="mini" data-act="who">← もどる</button>'}</div>`, 'home', true);
  app.querySelectorAll('.av').forEach((b) => b.addEventListener('click', () => { av = b.dataset.av; app.querySelectorAll('.av').forEach((x) => x.classList.toggle('on', x === b)); }));
  app.querySelectorAll('#rk button').forEach((b) => b.addEventListener('click', () => { rank = +b.dataset.r; app.querySelectorAll('#rk button').forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#psave').addEventListener('click', () => { addPlayer(($('#pname').value || '').trim() || 'プレイヤー', av, rank); home(); });
}

// ---------- ボタン ----------
const tabs = { home, stages, training, friends, shop };
const acts = {
  moveSafari: async () => { try { const u = await MV.moveUrl(); location.href = u; } catch (e) { alertMsg('うまく いきませんでした。せっていの「ひっこしコードを コピー」を つかってね'); } },
  tab: (d) => tabs[d.tab](), how, settings, players: () => players(), who, record, testIntro,
  pick: (d) => { S.current = d.id; save(); home(); },
  lv: (d) => { const p = player(); if (+d.lv <= p.rank) { p.lv = +d.lv; save(); } stages(); },
  stage: (d) => stageIntro(d.id), dojo: (d) => dojoIntro(d.id), dojoGo: (d) => start({ mode: 'dojo', skill: d.id }),
  claim: (d) => { const p = player(); const day = dayState(p);
    if (d.id === 'all') { if (missionAllDone(p) && !day.allGot) { day.allGot = true; p.coins += MISSION_ALL; save(); beep([12, 16, 19, 24]); } }
    else if (!day.claimed.includes(d.id) && missionProgress(p, day.missions.find((m) => m.id === d.id) || { id: d.id }) >= (day.missions.find((m) => m.id === d.id)?.n ?? 99)) { day.claimed.push(d.id); p.coins += MISSION_COIN; save(); beep([12, 19]); } home(); },
  ztab: (d) => { zTab = d.id; friends(); },
  title: (d) => { const p = player(); if ((p.titles || []).includes(d.id)) { p.title = d.id; save(); } friends(); },
  buddy: (d) => { const p = player(); p.buddy = p.buddy === d.id ? null : d.id; save(); friends(); },
  capsule: (d) => { const p = player(); const left = FRIENDS.filter((f) => !p.friends.includes(f.id)); if (!left.length) return;
    if (d.pay === 'ticket') { if (p.tickets < 1) return; p.tickets--; } else { if (p.coins < CAPSULE_COST) return; p.coins -= CAPSULE_COST; }
    const f = left[Math.floor(Math.random() * left.length)]; p.friends.push(f.id); if (!p.buddy) p.buddy = f.id; save(); beep([0, 4, 7, 12, 16]);
    shop(`<div class="card result"><div class="rescue"><div class="rays"></div><span>${f.e}</span><b>${f.n} が なかまに なった！</b><small>なかまの タブで バディに できるよ</small></div></div>`); },
  buy: (d) => { const p = player(); const r = buyItem(p, d.kind, d.id);
    if (!r.ok) return r.reason === 'coins' ? shop('<div class="card"><p class="hint">🪙 コインが たりないよ。ミッションや ステージで あつめよう。</p></div>') : shop();
    if (r.bought) beep([7, 12]); save();
    if (r.completed === 'ball') return shop(`<div class="card result" style="--a:#9ee7ff;--b:#c8b8ff"><div class="rescue rare"><div class="rays"></div><img class="zb" src="${ballIcon(BALLS.find((b) => b.id === 'diamond'))}" alt="" style="width:5em;height:5em"><b>ボール コンプリート！ ひみつの「ダイヤモンド」ボールを ゲット！</b><small>しょうごう「ボールマスター」も ゲット</small></div></div>`);
    if (r.completed === 'shoe') return shop(`<div class="card result" style="--a:#ffe680;--b:#ffb13d"><div class="rescue rare"><div class="rays"></div><img class="zs" src="${shoeIcon(SHOES.find((b) => b.id === 'gold'))}" alt="" style="width:9em;height:auto"><b>バッシュ コンプリート！ ひみつの「ゴールド」を ゲット！</b><small>しょうごう「バッシュマスター」も ゲット</small></div></div>`);
    shop(); },
};
document.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && !b.disabled && acts[b.dataset.act] && (app.contains(b) || nav.contains(b))) acts[b.dataset.act](b.dataset); });
document.getElementById('pause').addEventListener('click', () => game && !videoMode && game.pause());
// エラーきろく（せっていの いちばん下で 見られる）
const errLog = (w, m) => { try { const L = JSON.parse(localStorage.getItem('dribble-errlog') || '[]'); L.unshift({ t: new Date().toLocaleString('ja-JP'), w, m: String(m || '').slice(0, 400), ua: navigator.userAgent.slice(0, 120) }); localStorage.setItem('dribble-errlog', JSON.stringify(L.slice(0, 8))); } catch (x) { /* noop */ } };
window.addEventListener('error', (e) => errLog('error', (e.error && e.error.stack) || e.message));
window.addEventListener('unhandledrejection', (e) => { const r = e.reason; if (r && /rank|firestore|fetch/i.test(String(r.stack || r))) return; errLog('promise', (r && (r.stack || r.message)) || r); });
// ひっこし：とどいた データを うけとる
function alertMsg(t) { const m = document.getElementById('mvmsg'); if (m) m.textContent = t; else window.alert(t); }
async function moveIn(code) {
  const clear = () => { try { history.replaceState(null, '', location.pathname); } catch (e) { /* noop */ } };
  let got; try { got = await MV.readCode(code); } catch (e) { clear(); show('<div class="card"><h2>📦 ひっこし</h2><p class="hint">ひっこしコードが よめませんでした。せっていの「ひっこしコードを コピー」で もういちど ためしてね。</p><button class="big" data-act="who">OK</button></div>', 'home', true); return; }
  const cur = S.players.filter((x) => !x.guest || x.plays > 0);
  const list = got.s.players.filter((x) => !x.guest || x.plays > 0).map((p) => `<div class="prow"><b>${avHTML(p.avatar)} ${esc(p.name)}</b><span>R${p.rank || 1}　🪙${p.coins || 0}　🏀${(p.balls || []).length}こ</span></div>`).join('');
  show(`<div class="card"><h2>📦 ひっこしデータが とどきました</h2>${list || '<p class="hint">プレイヤーなし</p>'}
    ${cur.length ? '<p class="hint">⚠️ この ブラウザに ある いまの データは、とどいた データで うわがき されます。</p>' : ''}
    <div class="btns"><button class="big" id="mvok">✅ この データで つづける</button><button class="big ghost" id="mvno">やめる</button></div></div>`, 'home', true);
  $('#mvok').addEventListener('click', () => { MV.applyCode(got.o); clear(); location.reload(); });
  $('#mvno').addEventListener('click', () => { clear(); who(); });
}
document.addEventListener('visibilitychange', () => { if (document.hidden && game && !videoMode) game.pause(); });
window.__game = () => game;
if (location.hash.startsWith('#move=')) moveIn(location.hash.slice(6)); else who();
preloadStage(null, null, !!player().girl); // プレイヤーの 絵は さいしょに 読みこんでおく
