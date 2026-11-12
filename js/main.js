// ドリブルレスキュー！ メニュー・成長・ごほうび
import { SKILLS, SKILL_IDS, RANKS, TIERS, tierOf, rankSkills, poolFor, WORLDS, MISSIONS, STAGES, sl, FRIENDS, BOSS_FRIENDS, ALL_FRIENDS, BALLS, SUITS, CAPSULE_COST, AVATARS,
  S, save, avHTML, addPlayer, renamePlayer, player, totalStars, mastery, canTest, dayState, missionProgress, stamp, esc } from './data.js';
import { runStage } from './run.js';

const app = document.getElementById('app'); const nav = document.getElementById('nav'); const gameEl = document.getElementById('game');
const gl = document.getElementById('gl'); const hud = document.getElementById('hud'); const overlay = document.getElementById('overlay'); const video = document.getElementById('pip');
let game = null, pose = null, wake = null, tab = 'home', videoMode = false;
const $ = (s) => app.querySelector(s);
const friend = (id) => ALL_FRIENDS.find((f) => f.id === id);

async function awake(on) { try { if (on && navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } else if (!on && wake) { await wake.release(); wake = null; } } catch (e) { wake = null; } }
function beep(notes, type = 'triangle') { if (!S.settings.sound) return; try { const c = new (window.AudioContext || window.webkitAudioContext)(); notes.forEach((sm, i) => { const o = c.createOscillator(); const g = c.createGain(); o.type = type; o.frequency.value = 523 * Math.pow(2, sm / 12); const t = c.currentTime + i * 0.11; g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.3); }); setTimeout(() => c.close(), 2500); } catch (e) { /* noop */ } }
function show(html, t, bare) {
  try { if (unmuteEl) unmuteEl.pause(); } catch (e) { /* noop */ }
  if (game) { game.stop(); game = null; } if (pose) { pose.stop(); pose = null; } awake(false);
  if (t) tab = t; gameEl.hidden = true; app.hidden = false; nav.hidden = !!bare; app.innerHTML = (bare ? '' : topbar()) + html; window.scrollTo(0, 0);
  nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
}
function topbar() {
  const p = player(); const r = RANKS[p.rank];
  return `<div class="topbar"><button class="who" data-act="who">${avHTML(p.avatar)}<span>${esc(p.name)}</span></button>
    <span class="rank" style="--c:${r.c}">R${p.rank} ${r.n}${p.verified[p.rank - 1] ? ' ✅' : ''}</span>
    <span class="cur">⭐ ${totalStars(p)}</span><span class="cur coin">🪙 ${p.coins}</span></div>`;
}
const badge = (pts) => { const t = TIERS[tierOf(pts)]; const nx = TIERS[tierOf(pts) + 1]; const pr = nx ? (pts - t.at) / (nx.at - t.at) : 1; return `<span class="badge" style="--c:${t.c}">${t.i} ${t.n}</span><span class="mbar"><i style="width:${Math.round(pr * 100)}%;background:${nx ? nx.c : t.c}"></i></span>`; };

// ---------- ホーム ----------
function home() {
  const p = player(); const d = dayState(p); const r = RANKS[p.rank];
  const ms = d.missions.map((m) => { const v = Math.min(m.n, missionProgress(p, m)); const done = v >= m.n; const got = d.claimed.includes(m.id);
    return `<div class="ms ${done ? 'done' : ''}"><div><b>${m.text}</b><span class="mbar"><i style="width:${(v / m.n) * 100}%"></i></span><small>${v}/${m.n}</small></div>
      ${got ? '<span class="got">✔</span>' : done ? `<button class="claim" data-act="claim" data-id="${m.id}">🪙20 もらう</button>` : '<span class="rw">🪙20</span>'}</div>`; }).join('');
  const st = p.stamps % 7; const testReady = canTest(p);
  const weak = poolFor(p.rank).slice().sort((a, b) => mastery(p, a) - mastery(p, b))[0];
  show(`
    <div class="hero">
      <div class="logo"><span>ドリブル</span><b>レスキュー！</b></div>
      ${(() => { const nx = STAGES.find((x) => !(p.stars[x.id] > 0)); return nx ? `<button class="play" data-act="stage" data-id="${nx.id}">▶ つづきから<small>${sl(nx)} ${MISSIONS[nx.mission].n}</small></button>` : '<button class="play" data-act="tab" data-tab="stages">▶ ステージへ</button>'; })()}
    </div>
    ${testReady ? `<button class="banner test" data-act="testIntro"><b>🎓 しょうきゅうテストに ちょうせんできる！</b><small>R${p.rank} ${r.n} → R${p.rank + 1} ${RANKS[p.rank + 1].n}</small></button>` : ''}
    <div class="card"><h2>📅 きょうの ミッション</h2>${ms}</div>
    <div class="card stampcard"><h2>🗓️ スタンプカード <small>あそんだ日に 1こ。7こで カプセルけん 🎟️（とぎれても きえない）</small></h2>
      <div class="stamps">${Array.from({ length: 7 }, (_, i) => `<i class="${i < st || (st === 0 && p.stamps > 0 && p.lastDay === d.date && i < 7) ? 'on' : ''}">${i === 6 ? '🎟️' : '⭐'}</i>`).join('')}</div>
      <small>カプセルけん：${p.tickets}まい</small></div>
    <button class="banner" data-act="dojo" data-id="${weak}"><b>💡 おすすめ れんしゅう：${SKILLS[weak].i} ${SKILLS[weak].n}</b><small>トレーニングルームで ゆっくり れんしゅうしよう</small></button>
    <div class="row2"><button class="mini" data-act="record">📒 きろく</button><button class="mini" data-act="how">❓ あそびかた</button><button class="mini" data-act="settings">⚙️ せってい（おうちの人）</button></div>
  `, 'home');
}

// ---------- ステージ ----------
function stages() {
  const p = player(); const ts = totalStars(p);
  show(WORLDS.map((w, wi) => {
    const locked = !S.settings.openAll && ts < w.need;
    return `<section class="world ${locked ? 'locked' : ''}" style="--a:${w.pal.a};--b:${w.pal.b};--bg:${w.pal.bg}">
      <h2>WORLD ${wi + 1}　${w.name} ${locked ? `<small>🔒 ⭐${w.need}こで ひらく</small>` : ''}</h2>
      <div class="sgrid">${STAGES.filter((s) => s.wi === wi && !s.sp).map((s) => { const m = MISSIONS[s.mission]; const st = p.stars[s.id] || 0;
        return `<button class="stage ${m.boss ? 'boss' : ''}" ${locked ? 'disabled' : ''} data-act="stage" data-id="${s.id}" title="${wi + 1}-${s.mi + 1}"><span class="s-i">${m.i}</span><b>${m.n}</b><small>${wi + 1}-${s.mi + 1}</small><span class="s-st">${[1, 2, 3].map((n) => `<i class="${n <= st ? 'on' : ''}">★</i>`).join('')}</span></button>`; }).join('')}</div>
    </section>`; }).join('') + `<section class="world" style="--a:#ffb86b;--b:#ff7a1a;--bg:#2a1608"><h2>スペシャル</h2><div class="sgrid">${STAGES.filter((x) => x.sp).map((x) => `<button class="stage" data-act="stage" data-id="${x.id}"><span class="s-i">${MISSIONS[x.mission].i}</span><b>${x.sp}</b><small>${MISSIONS[x.mission].n}</small><span class="s-st">${[1, 2, 3].map((n) => `<i class="${n <= (p.stars[x.id] || 0) ? 'on' : ''}">★</i>`).join('')}</span></button>`).join('')}</div><p class="hint">SP は ボールが 2つ いるよ。L1・L2・L3 は ワザを ステップで おぼえる ステージ。H1 は うごかずに ハンドリングだけ れんしゅう。</p></section>`, 'stages');
}
function stageIntro(id) {
  const s = STAGES.find((x) => x.id === id); const p = player(); const m = MISSIONS[s.mission]; const pool = poolFor(p.rank);
  const feat = pool.filter((k) => (m.w[k] || 0) > 1).slice(0, 6); const list = (m.pool && m.pool.length > 8 ? m.pool.slice(0, 8) : m.pool) || (m.plan ? [...new Set(m.plan.flat().map((x) => x[0]))].filter((k) => SKILLS[k].combo || k === m.learn) : feat.length ? feat : pool.slice(-6));
  show(`<div class="card intro" style="--a:${s.world.pal.a};--b:${s.world.pal.b}">
      <div class="intro-h"><span class="bob">${m.i}</span><div><b>${s.world.name} ${sl(s)}</b><h1>${m.n}</h1><small>${m.d}</small></div></div>
      <p class="hint">${m.plan ? m.steps.join('<br>') : m.pool && m.pool.some((k) => SKILLS[k].hand === 'two') ? 'ボールを 2つ よういしよう。' : m.pool ? 'うごかないで、ハンドリングの ワザだけ 出るよ。' : `きみの ランク（R${p.rank} ${RANKS[p.rank].n}）に 合わせた ワザが 出るよ。`}</p>
      <div class="legend">${list.map((k) => `<div class="tile" style="--c:${SKILLS[k].c}"><b>${SKILLS[k].i} ${SKILLS[k].n}</b><span>${SKILLS[k].tips[0]}</span></div>`).join('')}</div>
      <p class="hint">${S.settings.camera ? '📷 カメラはんてい ON：全身が うつる ばしょに 立とう' : '📺 がめんの お手本に 合わせて うごこう。まわりに ぶつかる物が ないか たしかめてね'}</p>
      <button class="big" id="go">▶ スタート</button><p class="hint" id="msg"></p>
      <button class="mini" data-act="tab" data-tab="stages">← もどる</button></div>`, 'stages');
  $('#go').addEventListener('click', () => start({ mode: 'stage', stage: s }));
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
    <p class="hint">3セット（ゆっくり → ふつう → ゲームの はやさ）。${(sk.hand === 'hold' && !sk.handle) || sk.lane ? 'さいしょの セットは ボールなしで 足だけ。' : ''}がめんの ロボの うごきを まねしよう。</p>
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
  let human = null; try { if (msg) msg.textContent = 'キャラクターを よみこみちゅう…'; human = await (await import('./character.js')).loadHuman(); } catch (e) { human = null; }
  const look = { human, suit: SUITS.find((x) => x.id === p.suit)?.c, ball: BALLS.find((x) => x.id === p.ball), buddy: p.buddy ? friend(p.buddy)?.e : null };
  try {
    const qVid = new URLSearchParams(location.search).get('video');
    const vid = qVid || (st.videoRec && o.mode === 'stage' && o.stage ? o.stage.id : null); videoMode = !!vid;
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
  p.leftReps = (p.leftReps || 0) + r.leftReps; p.rightReps = (p.rightReps || 0) + r.rightReps; p.tipIdx = r.tipIdx; p.plays++;
  const stamped = stamp(p); return { ups, stamped };
}
const upsHtml = (ups) => `<div class="ups">${ups.sort((a, b) => (b.to - b.from) - (a.to - a.from) || b.add - a.add).slice(0, 8).map((u) => `<div class="up ${u.to > u.from ? 'lvl' : ''}" style="--c:${SKILLS[u.k].c}"><b>${SKILLS[u.k].i} ${SKILLS[u.k].n}</b><span>+${u.add}</span>${u.to > u.from ? `<em>${TIERS[u.to].i} ${TIERS[u.to].n}に アップ！</em>` : `<small>${TIERS[u.to].n}</small>`}</div>`).join('')}</div>`;
function result(o, r, noCam) {
  const p = player();
  if (o.mode === 'dojo') return dojoResult(o, r);
  if (o.mode === 'test') return testResult(o, r);
  const s = o.stage; const m = MISSIONS[s.mission]; const d = dayState(p);
  const { ups, stamped } = applyPractice(p, r); d.clears++; addLog(p, { t: 'stage', id: s.id, stars: r.stars, score: r.score });
  const isBest = r.score > (p.best[s.id] || 0); if (isBest) p.best[s.id] = r.score; p.stars[s.id] = Math.max(p.stars[s.id] || 0, r.stars);
  let coins = 20 + (m.boss ? 10 : 0); let got = null;
  if (m.boss && !p.bossDone[s.world.id]) { p.bossDone[s.world.id] = true; const bf = BOSS_FRIENDS[s.wi]; if (!p.friends.includes(bf.id)) { p.friends.push(bf.id); got = bf; } }
  p.coins += coins; save();
  const next = STAGES[STAGES.indexOf(s) + 1]; const hk = r.hardest;
  show(`<div class="card result" style="--a:${s.world.pal.a};--b:${s.world.pal.b}">
      <div class="res-h">${sl(s)} ${m.n}　クリア！</div>
      <div class="res-stars">${[1, 2, 3].map((n) => `<i class="${n <= r.stars ? 'on' : ''}" style="animation-delay:${n * 0.3}s">★</i>`).join('')}</div>
      <div class="res-score">⚡ ${r.score}${isBest ? ' <em>じこベスト！</em>' : ''}　<span class="coinup">🪙 +${coins}</span></div>
      ${got ? `<div class="rescue rare"><div class="rays"></div><span>${got.e}</span><b>${got.n} が なかまに なった！</b><small>✨ ボスの なかま ✨</small></div>` : ''}
      <h3>れんしゅう ポイント</h3>${upsHtml(ups)}
      <div class="res-lines">${r.cam ? `<span>せいこう ${Math.round(r.hit * 100)}%</span><span>さいだい ${r.maxCombo} コンボ</span><span>ドリブル ${r.dribbles}回</span>` : `<span>ルート：${r.tiers.map((x) => ['あんぜん', 'ふつう', 'ちかみち'][x]).join(' → ')}</span>`}${stamped ? '<span>🗓️ スタンプ +1</span>' : ''}</div>
      ${noCam ? '<p class="hint">📷 この がめんでは カメラが つかえなかったので、カメラなしで あそびました。</p>' : ''}
      ${r.cam && r.tracked < 0.5 ? '<p class="hint">📷 からだが あまり うつって いなかったよ。もうすこし はなれて 全身を うつしてね。</p>' : ''}
      ${hk ? `<button class="banner" data-act="dojo" data-id="${hk}"><b>💡 ${SKILLS[hk].i} ${SKILLS[hk].n} を れんしゅうする？</b><small>コツ：${SKILLS[hk].tips[0]}</small></button>` : ''}
      ${canTest(p) ? '<button class="banner test" data-act="testIntro"><b>🎓 しょうきゅうテストに ちょうせんできる！</b></button>' : ''}
      <div class="btns"><button class="big" data-act="stage" data-id="${s.id}">もういちど</button>${next ? `<button class="big alt" data-act="stage" data-id="${next.id}">つぎへ ▶</button>` : ''}<button class="big ghost" data-act="tab" data-tab="home">ホーム</button></div></div>`, 'stages');
  beep([0, 4, 7, 12, 16, 12, 19]);
}
function dojoResult(o, r) {
  const p = player(); const d = dayState(p); const sk = SKILLS[o.skill];
  const { ups, stamped } = applyPractice(p, r, 0.5); d.dojo++; addLog(p, { t: 'dojo', id: o.skill }); const coins = d.dojo <= 3 ? 15 : 0; p.coins += coins; save();
  const tip = sk.tips[(p.tipIdx[o.skill] || 0) % sk.tips.length];
  show(`<div class="card result" style="--a:${sk.c};--b:#7dffb0"><div class="res-h">${sk.i} ${sk.n}　れんしゅう おわり！</div>
      <div class="res-score">${coins ? `<span class="coinup">🪙 +${coins}</span>` : '<small>きょうの コインは もう もらったよ（れんしゅうポイントは たまる）</small>'}</div>
      ${upsHtml(ups)}${stamped ? '<div class="res-lines"><span>🗓️ スタンプ +1</span></div>' : ''}
      ${r.cam ? `<div class="res-lines"><span>カメラで かくにん：${Math.round(r.hit * 100)}% せいこう</span></div>` : ''}
      <h3>どうだった？</h3>
      <div class="btns"><button class="big" data-act="tab" data-tab="training">😆 できた！</button><button class="big alt" id="tipbtn">💡 コツを きく</button><button class="big ghost" data-act="dojo" data-id="${o.skill}">🔁 もういちど</button></div>
      <div id="tipout"></div></div>`, 'training');
  $('#tipbtn').addEventListener('click', () => { p.tipIdx[o.skill] = (p.tipIdx[o.skill] || 0) + 1; save(); $('#tipout').innerHTML = `<div class="tipbox big"><span>💡 ${tip}</span><button class="big" data-act="dojoGo" data-id="${o.skill}">この コツで もういちど ▶</button></div>`; });
  beep([0, 7, 12]);
}

// ---------- しょうきゅうテスト ----------
function testIntro() {
  const p = player(); const ks = rankSkills(p.rank);
  show(`<div class="card intro" style="--a:${RANKS[p.rank + 1]?.c || '#fff'};--b:#ffe03d"><div class="intro-h"><span class="bob">🎓</span><div><b>しょうきゅうテスト</b><h1>R${p.rank} → R${p.rank + 1} ${RANKS[p.rank + 1].n}</h1><small>R${p.rank} の ワザだけが 出る ステージ。さいごに しけんかんと しょうぶ！</small></div></div>
    <div class="legend">${ks.map((k) => `<div class="tile" style="--c:${SKILLS[k].c}"><b>${SKILLS[k].i} ${SKILLS[k].n}</b><span>${SKILLS[k].tips[0]}</span></div>`).join('')}</div>
    <p class="hint">${S.settings.camera ? '📷 カメラで はんていします（70%いじょうで ごうかく）。' : '👀 カメラなしの ときは、おわったあとに おうちの人が ワザを かくにんします。おうちの人と いっしょに やろう。'}</p>
    <button class="big" id="go">▶ テスト スタート</button><p class="hint" id="msg"></p><button class="mini" data-act="tab" data-tab="home">← もどる</button></div>`, 'home');
  $('#go').addEventListener('click', () => start({ mode: 'test', stage: { ...STAGES[Math.min(STAGES.length - 1, (p.rank - 1) * 6 + 5)], mission: 'dodge', sections: 2 } }));
}
function testResult(o, r) {
  const p = player(); const ks = rankSkills(p.rank); applyPractice(p, r); addLog(p, { t: 'test', id: 'R' + p.rank }); save();
  const pass = () => { p.verified[p.rank] = true; p.rank++; p.coins += 100; save(); beep([0, 4, 7, 12, 16, 19, 24]);
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
    show(`<div class="card"><h2>👀 おうちの人 チェック</h2><p class="hint">お子さんの うごきを 見て、ワザごとに えらんでください。ぜんぶ「できた」で しょうきゅうします。見られなかった日は「きょうは 見られない」で、テストは もういちど うけられます。</p>
      ${ks.map((k) => `<div class="chk" style="--c:${SKILLS[k].c}"><div><b>${SKILLS[k].i} ${SKILLS[k].n}</b><small>${SKILLS[k].tips.join(' / ')}</small></div>
        <div class="seg"><button class="${marks[k] === 1 ? 'on' : ''}" data-k="${k}" data-v="1">できた</button><button class="${marks[k] === 0 ? 'on' : ''}" data-k="${k}" data-v="0">もうすこし</button></div></div>`).join('')}
      <div class="btns"><button class="big" id="decide" ${ks.every((k) => marks[k] != null) ? '' : 'disabled'}>けってい</button><button class="big ghost" data-act="tab" data-tab="home">きょうは 見られない</button></div></div>`, 'home');
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
function friends() {
  const p = player();
  show(`<div class="card"><h2>👥 なかま ${p.friends.length}/${ALL_FRIENDS.length}</h2><p class="hint">タップすると バディに なって、ステージで いっしょに 走るよ。</p>
    <div class="zukan">${ALL_FRIENDS.map((f) => (p.friends.includes(f.id) ? `<button class="z on ${f.rare ? 'rare' : ''} ${p.buddy === f.id ? 'sel' : ''}" data-act="buddy" data-id="${f.id}"><span>${f.e}</span><b>${f.n}</b><small>${p.buddy === f.id ? 'バディ' : f.rare ? 'ボスの なかま' : ''}</small></button>` : `<div class="z"><span>？</span><b>？？？</b><small>${f.rare ? 'ボスを たおすと…' : 'カプセルで 出る'}</small></div>`)).join('')}</div></div>`, 'friends');
}

// ---------- ショップ ----------
function shop(msg = '') {
  const p = player(); const left = FRIENDS.filter((f) => !p.friends.includes(f.id));
  const item = (kind, it, owned, sel) => `<button class="item ${sel ? 'sel' : ''}" data-act="buy" data-kind="${kind}" data-id="${it.id}"><span class="sw" style="background:${it.c || `linear-gradient(${it.c1},${it.c2})`}"></span><b>${it.n}</b><small>${sel ? 'つかっている' : owned ? 'もっている' : `🪙 ${it.cost}`}</small></button>`;
  show(`${msg}<div class="card capsule"><h2>🎁 なかまカプセル</h2><p class="hint">まだ いない なかまが かならず 1人 出るよ（かぶりなし）。のこり ${left.length}人</p>
      <div class="btns"><button class="big" data-act="capsule" data-pay="coin" ${left.length && p.coins >= CAPSULE_COST ? '' : 'disabled'}>🪙 ${CAPSULE_COST} で まわす</button><button class="big alt" data-act="capsule" data-pay="ticket" ${left.length && p.tickets > 0 ? '' : 'disabled'}>🎟️ けんで まわす（${p.tickets}）</button></div></div>
    <div class="card"><h2>🏀 ボール</h2><div class="items">${BALLS.map((b) => item('ball', b, p.balls.includes(b.id), p.ball === b.id)).join('')}</div></div>
    <div class="card"><h2>✨ スーツの ひかり</h2><div class="items">${SUITS.map((b) => item('suit', b, p.suits.includes(b.id), p.suit === b.id)).join('')}</div></div>
    <p class="hint">コインで かえるのは 見た目だけ。つよさは かわらないよ。</p>`, 'shop');
}

// ---------- そのほか ----------
function how() {
  show(`<div class="card"><h2>❓ あそびかた</h2><ol class="how">
    <li>テレビや iPad の前に、ボールを持って立とう。<b>まわりに ぶつかる物が ないか</b> たしかめてね。</li>
    <li>通路の おくから <b>ゲート</b> が せまってくる。くぐるときに、その ワザに きりかえる！</li>
    <li>がめんの <b>ロボ</b>が お手本。うごきを まねしよう。「みぎへ」「ひだりへ」は <b>1〜2歩</b> うごく。</li>
    <li><b>セーフゾーン</b>では ボールを持って きゅうけい。つぎの ルートを えらべる。「むずかしい」を えらぶと コツが 出る。</li>
    <li>ワザを やるたびに <b>れんしゅうポイント</b>が たまる。ランクの ワザが そだったら <b>しょうきゅうテスト</b>へ。</li>
    <li>むずかしい ワザは <b>トレーニングルーム</b>で ゆっくり れんしゅうできる。</li></ol>
    <p class="hint">📷 カメラはんてい：iPad・iPhone を 2〜3m はなして 全身を うつすと、手の左右・ひくさ・はやさ・持ちかえ・左右の うごき・ジャンプを 見ます。レッグスルーや ビハインドは「持ちかえたか」まで。カメラが つかえない がめんでは 自動で カメラなしに なります。</p></div>`, 'home');
}
function settings() {
  const st = S.settings; const tg = (k, l) => `<label class="toggle"><input type="checkbox" data-set="${k}" ${st[k] ? 'checked' : ''}><span>${l}</span></label>`;
  show(`<div class="card"><h2>⚙️ せってい（おうちの人むけ）</h2>
    ${tg('camera', '📷 カメラはんていを つかう')}<div class="prow"><b>🗣️ こえの あいず</b><div class="seg">${[['en', 'English'], ['ja', 'にほんご（iPhoneでは 音楽が 止まることが あります）'], ['', 'オフ']].map(([v, l]) => `<button class="${(st.voice || '') === v || (st.voice === true && v === 'ja') ? 'on' : ''}" data-voice="${v}">${l}</button>`).join('')}</div></div>${tg('bloom', '✨ ひかりの えんしゅつ（うごきが おもい ときは オフ）')}${tg('music', '🎵 おんがく')}${tg('sound', '🔊 こうかおん')}${tg('openAll', '🔓 すべての ワールドを ひらく（おためし用）')}${tg('swap', '📷 右手と左手を 入れかえる（ぎゃくに 数えるとき）')}${tg('videoRec', '🎬 どうが ろくがモード（つぎに あそぶ ステージを じどうで ろくがする・セーフゾーンの せんたくも スキップ）')}
    <div class="prow"><b>🎵 おんがくの スタイル</b><div class="seg">${[['workout', 'ダンス（アップテンポ）'], ['game', 'ゲーム（ピコピコ）']].map(([v, l]) => `<button class="${(st.musicStyle || 'workout') === v ? 'on' : ''}" data-ms="${v}">${l}</button>`).join('')}</div></div>
    <h3>🔊 おとの テスト</h3><p class="hint">音が 出ないときに、どの方式なら 聞こえるかを たしかめます。1つずつ おして、聞こえたものを 教えてください。</p>
    <div class="btns"><button class="big ghost" id="ta">① 合成音</button><button class="big ghost" id="tb">② 音声ファイル</button><button class="big ghost" id="tc">③ こえ → 合成音</button></div><p class="hint" id="tout"></p>
    <h3>プレイヤーと ランク</h3><p class="hint">いまの じつりょくに 合わせて、スタートの ランクを えらんでください。ランクが 上がるほど むずかしい ワザが 出ます。</p>
    ${S.players.map((p) => `<div class="prow"><b>${avHTML(p.avatar)}</b><input class="pname-edit" maxlength="10" value="${esc(p.name)}" data-pid="${p.id}" style="width:6em"><div class="seg">${[1, 2, 3, 4, 5].map((r) => `<button class="${p.rank === r ? 'on' : ''}" data-rank="${r}" data-pid="${p.id}">R${r}</button>`).join('')}</div><button class="mini danger" data-del="${p.id}">けす</button></div>`).join('')}
    <p class="hint">${[1, 2, 3, 4, 5].map((r) => `R${r} ${RANKS[r].n}：${rankSkills(r).map((k) => SKILLS[k].n).join('・')}`).join('<br>')}</p>
    <p class="hint">きろくは この たんまつの ブラウザの 中だけに ほぞんされます。</p></div>`, 'home');
  app.querySelectorAll('[data-set]').forEach((i) => i.addEventListener('change', () => { st[i.dataset.set] = i.checked; save(); }));
  const tout = $('#tout'); const say = (t) => { tout.textContent = t; };
  const wav = () => { const sr = 8000, n = sr * 0.6; const buf = new ArrayBuffer(44 + n); const v = new DataView(buf); const w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); }; w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true); for (let i = 0; i < n; i++) v.setUint8(44 + i, 128 + Math.round(Math.sin(i / sr * 6.283 * (i < n / 2 ? 660 : 880)) * 90 * (1 - i / n))); return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })); };
  const tone = (c) => { [0, 4, 7].forEach((sm, i) => { const o = c.createOscillator(); const g = c.createGain(); o.frequency.value = 523 * Math.pow(2, sm / 12); const t = c.currentTime + i * 0.15; g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.32); }); };
  $('#ta').addEventListener('click', async () => { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const s0 = c.state; try { await c.resume(); } catch (e) { /* noop */ } tone(c); say(`① 合成音：はじめ=${s0} → いま=${c.state}（ポポポと 3音 鳴るはず）`); setTimeout(() => say(`① 合成音：はじめ=${s0} → 1びょう後=${c.state} 時間=${c.currentTime.toFixed(2)}`), 1000); } catch (e) { say('① エラー：' + e.message); } });
  $('#tb').addEventListener('click', async () => { try { const a = document.createElement('audio'); a.src = wav(); a.setAttribute('playsinline', ''); await a.play(); say('② 音声ファイル：再生できた（ピポと 鳴るはず）'); } catch (e) { say('② エラー：' + e.name + ' ' + e.message); } });
  $('#tc').addEventListener('click', async () => { try { const c = new (window.AudioContext || window.webkitAudioContext)(); try { await c.resume(); } catch (e) { /* noop */ } const u = new SpeechSynthesisUtterance('Test'); u.lang = 'en-US'; window.speechSynthesis.speak(u); setTimeout(() => { const s1 = c.state; try { c.resume(); } catch (e) { /* noop */ } tone(c); setTimeout(() => say(`③ こえの あと：合成音=${s1} → ${c.state}（こえの あとに 3音 鳴るはず）`), 600); }, 1500); say('③ こえ → 合成音 を ためしちゅう…'); } catch (e) { say('③ エラー：' + e.message); } });
  app.querySelectorAll('[data-ms]').forEach((b) => b.addEventListener('click', () => { st.musicStyle = b.dataset.ms; save(); settings(); }));
  app.querySelectorAll('[data-voice]').forEach((b) => b.addEventListener('click', () => { st.voice = b.dataset.voice || false; save(); settings(); }));
  app.querySelectorAll('[data-rank]').forEach((b) => b.addEventListener('click', () => { const p = S.players.find((x) => x.id === b.dataset.pid); p.rank = +b.dataset.rank; p.day = null; save(); settings(); }));
  app.querySelectorAll('.pname-edit').forEach((i) => i.addEventListener('change', () => { const p = S.players.find((x) => x.id === i.dataset.pid); if (p) renamePlayer(p, i.value); settings(); }));
  app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.sure) { S.players = S.players.filter((x) => x.id !== b.dataset.del); if (S.current === b.dataset.del) S.current = null; save(); settings(); } else { b.dataset.sure = '1'; b.textContent = 'ほんとうに けす'; } }));
}
function addLog(p, e) { const d = new Date(); p.log = p.log || []; p.log.unshift({ ...e, d: `${d.getMonth() + 1}/${d.getDate()}`, h: `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` }); p.log = p.log.slice(0, 40); p.lastPlay = Date.now(); }
const cleared = (p) => STAGES.filter((x) => p.stars[x.id] > 0).length;
const ago = (ts) => { if (!ts) return 'まだ あそんでいない'; const dd = Math.floor((Date.now() - ts) / 86400000); return dd <= 0 ? 'きょう あそんだ' : dd === 1 ? 'きのう あそんだ' : `${dd}日まえに あそんだ`; };
// ---------- だれが あそぶ？ ----------
function who() {
  const ps = S.players.filter((x) => !x.guest || x.plays > 0);
  if (!ps.length) return players(true);
  show(`<div class="hero"><div class="logo"><span>ドリブル</span><b>レスキュー！</b></div></div>
    <h2 class="whoq">だれが あそぶ？</h2>
    <div class="wholist">${ps.map((x) => { const nx = STAGES.find((y) => !(x.stars[y.id] > 0)); return `<button class="whocard" data-act="pick" data-id="${x.id}" style="--c:${RANKS[x.rank].c}">
      <span class="wav">${avHTML(x.avatar)}</span><span class="wbody"><b>${esc(x.name)}</b><span class="rank" style="--c:${RANKS[x.rank].c}">R${x.rank} ${RANKS[x.rank].n}</span>
      <small>⭐ ${totalStars(x)}　ステージ ${cleared(x)}/${STAGES.length}　🪙 ${x.coins}</small><small>${nx ? `つぎは ${sl(nx)}` : 'ぜんぶ クリア！'}・${ago(x.lastPlay)}</small></span></button>`; }).join('')}
      <button class="whocard add" data-act="players"><span class="wav">＋</span><span class="wbody"><b>あたらしい プレイヤー</b><small>なまえと ランクを えらぶ</small></span></button></div>`, 'home', true);
}
// ---------- きろく ----------
function record() {
  const p = player(); const tiers = [0, 0, 0, 0, 0]; SKILL_IDS.forEach((k) => { tiers[tierOf(mastery(p, k))]++; });
  show(`<div class="card"><h2>📒 ${avHTML(p.avatar)} ${esc(p.name)} の きろく</h2>
      <div class="stats"><div><b>R${p.rank}</b><small>${RANKS[p.rank].n}${p.verified[p.rank - 1] ? ' ✅' : ''}</small></div><div><b>${cleared(p)}/${STAGES.length}</b><small>クリアした ステージ</small></div><div><b>⭐${totalStars(p)}</b><small>/${STAGES.length * 3}</small></div><div><b>${p.stamps || 0}日</b><small>あそんだ日</small></div><div><b>${p.plays || 0}回</b><small>プレイ</small></div><div><b>${p.friends.length}</b><small>なかま</small></div></div></div>
    <div class="card"><h2>🗺️ ステージ</h2>${WORLDS.map((w, wi) => `<div class="recrow"><b style="color:${w.pal.a}">${wi + 1} ${w.name}</b><span>${STAGES.filter((x) => x.wi === wi && !x.sp).map((x) => `<i class="${p.stars[x.id] ? 'on' : ''}" title="${sl(x)}">${p.stars[x.id] ? '★'.repeat(p.stars[x.id]) : '・'}</i>`).join('')}</span></div>`).join('')}</div>
    <div class="card"><h2>🥋 れんしゅうランク</h2><div class="res-lines">${TIERS.map((t, i) => `<span style="color:${t.c}">${t.i} ${t.n} ${tiers[i]}</span>`).join('')}</div>
      <div class="ups">${SKILL_IDS.filter((k) => mastery(p, k) > 0).sort((a, b) => mastery(p, b) - mastery(p, a)).map((k) => `<div class="up" style="--c:${SKILLS[k].c}"><b>${SKILLS[k].i} ${SKILLS[k].n}</b><span>${mastery(p, k)}</span><small>${TIERS[tierOf(mastery(p, k))].n}</small></div>`).join('') || '<p class="hint">まだ ありません</p>'}</div>
      <p class="hint">ひだりて ${p.leftReps || 0}回 ／ みぎて ${p.rightReps || 0}回</p></div>
    <div class="card"><h2>🕒 さいきんの きろく</h2>${(p.log || []).map((e) => { const st = e.t === 'stage' ? STAGES.find((x) => x.id === e.id) : null; return `<div class="logrow"><small>${e.d} ${e.h}</small><b>${e.t === 'stage' && st ? `${sl(st)} ${MISSIONS[st.mission].n}` : e.t === 'dojo' ? `🥋 ${SKILLS[e.id]?.n || ''}` : `🎓 しょうきゅうテスト ${e.id}`}</b><span>${e.t === 'stage' ? '★'.repeat(e.stars) + `　⚡${e.score}` : ''}</span></div>`; }).join('') || '<p class="hint">まだ ありません</p>'}</div>
    <p class="hint">きろくは この たんまつの 中に、プレイヤーごとに ほぞんされます。</p>`, 'home');
}
function players(first) {
  let av = AVATARS[S.players.length % AVATARS.length]; let rank = 1;
  show(`${first === true ? '<div class="hero"><div class="logo"><span>ドリブル</span><b>レスキュー！</b></div></div>' : ''}<div class="card"><h2>${first === true ? 'はじめに プレイヤーを つくろう' : 'あたらしい プレイヤー'}</h2>
    <h3>なまえ</h3><input id="pname" maxlength="8" placeholder="なまえ" autocomplete="off">
    <div class="avatars">${AVATARS.map((a) => `<button class="av ${a === av ? 'on' : ''}" data-av="${a}">${avHTML(a)}</button>`).join('')}</div>
    <p class="hint">スタートの ランク（あとで せっていから かえられます）</p><div class="seg" id="rk">${[1, 2, 3, 4, 5].map((r) => `<button class="${r === 1 ? 'on' : ''}" data-r="${r}">R${r} ${RANKS[r].n}</button>`).join('')}</div>
    <button class="big" id="psave">つくる</button>${first === true ? '' : '<button class="mini" data-act="who">← もどる</button>'}</div>`, 'home', true);
  app.querySelectorAll('.av').forEach((b) => b.addEventListener('click', () => { av = b.dataset.av; app.querySelectorAll('.av').forEach((x) => x.classList.toggle('on', x === b)); }));
  app.querySelectorAll('#rk button').forEach((b) => b.addEventListener('click', () => { rank = +b.dataset.r; app.querySelectorAll('#rk button').forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#psave').addEventListener('click', () => { addPlayer(($('#pname').value || '').trim() || 'プレイヤー', av, rank); home(); });
}

// ---------- ボタン ----------
const tabs = { home, stages, training, friends, shop };
const acts = {
  tab: (d) => tabs[d.tab](), how, settings, players: () => players(), who, record, testIntro,
  pick: (d) => { S.current = d.id; save(); home(); },
  stage: (d) => stageIntro(d.id), dojo: (d) => dojoIntro(d.id), dojoGo: (d) => start({ mode: 'dojo', skill: d.id }),
  claim: (d) => { const p = player(); const day = dayState(p); if (!day.claimed.includes(d.id)) { day.claimed.push(d.id); p.coins += 20; save(); beep([12, 19]); } home(); },
  buddy: (d) => { const p = player(); p.buddy = p.buddy === d.id ? null : d.id; save(); friends(); },
  capsule: (d) => { const p = player(); const left = FRIENDS.filter((f) => !p.friends.includes(f.id)); if (!left.length) return;
    if (d.pay === 'ticket') { if (p.tickets < 1) return; p.tickets--; } else { if (p.coins < CAPSULE_COST) return; p.coins -= CAPSULE_COST; }
    const f = left[Math.floor(Math.random() * left.length)]; p.friends.push(f.id); if (!p.buddy) p.buddy = f.id; save(); beep([0, 4, 7, 12, 16]);
    shop(`<div class="card result"><div class="rescue"><div class="rays"></div><span>${f.e}</span><b>${f.n} が なかまに なった！</b><small>なかまの タブで バディに できるよ</small></div></div>`); },
  buy: (d) => { const p = player(); const list = d.kind === 'ball' ? BALLS : SUITS; const own = d.kind === 'ball' ? p.balls : p.suits; const it = list.find((x) => x.id === d.id);
    if (!own.includes(it.id)) { if (p.coins < it.cost) return shop('<div class="card"><p class="hint">🪙 コインが たりないよ。ミッションや ステージで あつめよう。</p></div>'); p.coins -= it.cost; own.push(it.id); beep([7, 12]); }
    p[d.kind] = it.id; save(); shop(); },
};
document.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b && !b.disabled && acts[b.dataset.act] && (app.contains(b) || nav.contains(b))) acts[b.dataset.act](b.dataset); });
document.getElementById('pause').addEventListener('click', () => game && !videoMode && game.pause());
document.addEventListener('visibilitychange', () => { if (document.hidden && game && !videoMode) game.pause(); });
window.__game = () => game;
who();
