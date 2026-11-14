// ドリバト！（めざせ！ドリブルキング） ゲームの進行（ステージ・トレーニングルーム・しょうきゅうテスト）
import { SKILLS, MISSIONS, poolFor, rankSkills, tierOf, comboState, SONGS } from './data.js';
import { Audio, speak, MELODIES } from './audio.js';
import { createScene, LW } from './scene.js';

const V = 6;                     // 1拍で進む距離
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const frac = (v) => v - Math.floor(v);
const TIER_MULT = [0.7, 1, 1.4];
const DOJO_PAL = { a: '#7dffb0', b: '#3df5ff', bg: '#0a2030', floor: '#0e3346' };

// opts: { gl, hud, overlay, mode:'stage'|'dojo'|'test', stage, skill, player, settings, pose, look, onEnd, onQuit }
export function runStage(opts) {
  const { gl, hud, overlay, mode, stage, player: pl, settings, pose, onEnd, onQuit } = opts;
  const dojo = mode === 'dojo'; const test = mode === 'test';
  const world = stage ? stage.world : null; const pal = dojo ? DOJO_PAL : world.pal;
  const mission = stage ? MISSIONS[stage.mission] : { w: {} };
  const g = hud.getContext('2d');
  const wi = stage ? (stage.wi ?? 0) : 0; const video = !!opts.video;
  const audio = new Audio(settings, dojo ? 48 : world.base, { ctx: opts.actx, major: dojo || ['village', 'sunset', 'snow'].includes(world.theme), riff: dojo ? 2 : wi, bpm: dojo ? 86 : stage.bpm, record: video });
  const scene = createScene(gl, { pal, theme: dojo ? 'gym' : world.theme, stageId: stage ? stage.id : 'dojo', bloom: settings.bloom, video, ...opts.look });
  const cam = !!pose;
  let bps = (dojo ? 76 : stage.bpm) / 60;
  // ドリブルの音：ワールド（ゆか）ごとに かえる
  audio.loadBounce(`sound/bounce_${{ village: 'd', night: 'b', sunset: 'c', snow: 'a', castle: 'e', gym: 'e' }[dojo ? 'gym' : world.theme] || 'd'}.wav`);
  const useSong = !dojo && !video && stage && stage.song && SONGS[stage.song]; // 曲ファイルの BGM（ゲームの 拍は 曲に あわせる）
  const sRate = (stage && stage.rate || 1) * (opts.speedK || 1); if (!useSong && opts.speedK) bps *= opts.speedK;
  if (useSong) { audio.loadBgm(SONGS[stage.song], sRate, stage.half || 1); bps = (SONGS[stage.song].bpm * sRate / (stage.half || 1)) / 60; }
  let W = 0, H = 0, DPR = 1;
  function resize() { const r = hud.getBoundingClientRect(); DPR = Math.min(window.devicePixelRatio || 1, 2); hud.width = Math.round(r.width * DPR); hud.height = Math.round(r.height * DPR); W = hud.width; H = hud.height; scene.resize(); }
  resize(); window.addEventListener('resize', resize);
  let recorder = null;
  if (video && audio.recDest) {
    const comp = document.createElement('canvas'); comp.width = W; comp.height = H; const cctx = comp.getContext('2d');
    const vTrack = comp.captureStream(30).getVideoTracks(); const aTrack = audio.recDest.stream.getAudioTracks();
    const mr = new MediaRecorder(new MediaStream([...vTrack, ...aTrack]), { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 9000000 });
    const chunks = []; mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => { const blob = new Blob(chunks, { type: 'video/webm' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${opts.videoName || stage.id}.webm`; document.body.appendChild(a); a.click(); window.__videoDone = true; };
    mr.start(250); recorder = { mr, comp, cctx };
  }

  // ---------- 進行表 ----------
  const cues = []; const orbs = []; const safes = [];
  let endBeat = 0, zEnd = 0, lane = 0, curHand = 'R', lastSkill = null, bossStart = 1e9, finaleBeat = 1e9;
  let tier = 1; const tiers = [];
  const RK = opts.level || pl.rank; // あそぶ レベル
  const pool = dojo ? [opts.skill] : test ? [...new Set([...rankSkills(pl.rank), 'right', 'left'])] : mission.pool || (mission.plan ? [...new Set(mission.plan.flat().map((x) => x[0]))] : poolFor(RK));
  const has = (k) => pool.includes(k);
  const leftBias = mission.leftBias ?? ((pl.leftReps || 0) <= (pl.rightReps || 0) ? 0.6 : 0.45);

  function addCue(id, o = {}) {
    const sk = SKILLS[id]; const len = o.len || sk.len; const sp = o.sp ?? sk.sp ?? 1;
    const c = { skill: id, b0: endBeat, b1: endBeat + len, z0: zEnd, z1: zEnd + len * V * Math.max(sp, 0.05), sp, lane0: lane, lane1: lane, boss: !!o.boss, ballMode: o.ballMode, noGate: o.noGate, bpm: o.bpm, tier,
      st: { n: 0, R: 0, L: 0, sw: 0, last: null, late: 0, lowF: 0, f: 0, tr: 0, hx0: null, move: 0, rise: 0, hy0: null } };
    if (sk.lane) { const dir = o.dir || (lane === 0 ? (Math.random() < 0.5 ? -1 : 1) : -lane); c.dir = dir; c.lane1 = clamp(lane + dir, -1, 1); lane = c.lane1; c.guard = !!o.guard; }
    else if (o.dir) c.dir = o.dir;
    if (sk.hand === 'R' || sk.hand === 'L') c.hand = sk.hand;
    else if (sk.hand === 'cur') c.hand = o.hand || (id === 'rest' ? curHand : (Math.random() < leftBias ? 'L' : 'R'));
    else if (sk.hand === 'side') c.hand = c.dir > 0 ? 'R' : 'L';
    else if (sk.hand === 'alt') { c.hand = 'alt'; c.hand0 = curHand; }
    else if (sk.hand === 'alt1') { c.hand = 'alt1'; c.hand0 = c.dir ? (c.dir > 0 ? 'L' : 'R') : curHand; }
    else if (sk.hand === 'combo') { c.hand = 'combo'; c.hand0 = curHand; if (sk.reps === 1 && Math.floor(len / (sk.cyc || 4)) % 2 === 1) curHand = curHand === 'R' ? 'L' : 'R'; }
    else if (sk.hand === 'two') c.hand = 'two';
    else c.hand = 'hold';
    if (c.hand === 'R' || c.hand === 'L') curHand = c.hand;
    if (c.hand === 'alt1') curHand = c.hand0 === 'R' ? 'L' : 'R';
    if (c.hand === 'alt' && len % 2 === 1) curHand = curHand === 'R' ? 'L' : 'R';
    cues.push(c); endBeat = c.b1; zEnd = c.z1;
    // ⚡
    if (id !== 'rest' && c.ballMode !== 'none') {
      const hold = c.hand === 'hold'; const step = sk.dbl ? 0.5 : 1;
      for (let b = step; b <= len - 0.01; b += step) {
        if (hold && !sk.lane && b % 2) continue;
        const k = Math.round(b / step); const lx = (c.lane0 + (c.lane1 - c.lane0) * clamp(b / 1.5, 0, 1)) * LW;
        let hx = 0; if (c.hand === 'combo') hx = Math.sign(comboState(sk, c.hand0, b).x || 1) * 0.5; else if (c.hand === 'two') hx = k % 2 ? 0.5 : -0.5; else if (c.hand === 'R') hx = 0.5; else if (c.hand === 'L') hx = -0.5; else if (c.hand === 'alt') hx = (k % 2 ? -1 : 1) * (c.hand0 === 'L' ? -0.5 : 0.5); else if (c.hand === 'alt1') hx = c.hand0 === 'L' ? 0.5 : -0.5;
        const oz = c.z0 + b * V * Math.max(sp, 0.05), oy = sk.low ? 0.45 : hold ? 1.1 : 0.85;
        if (c.hand === 'two') { for (const sx of [-0.5, 0.5]) { const dz = sk.two === 'alt' && sx > 0 ? 0.5 * step * V * Math.max(sp, 0.05) : 0; orbs.push({ z: oz + dz, x: lx + sx, y: oy, c: sk.c, cue: c, got: false, missed: false, big: false }); } continue; } // 2ボールは 左右 2こ（こうごは すこし ずらす）
        orbs.push({ z: oz, x: lx + hx, y: oy, c: sk.c, cue: c, got: false, missed: false, big: c.skill === 'pound' }); // つよく ドリブルは ●を 2ばいに
      }
    }
    return c;
  }
  function weightOf(k) {
    let w = mission.w[k] ?? 1; const sk = SKILLS[k];
    if (tierOf(pl.m[k] || 0) < 2) w *= 1.4;
    if (sk.r === RK && RK > 1) w *= tier === 0 ? 0.5 : tier === 2 ? 1.6 : 1;
    if (sk.handle && !test) w = 0;               // ハンドリングは ドリブルの あいだに はさむ
    if (k === 'jab') w = 0;                      // ジャブは ドライブと セット
    if (k === 'drive' && tier === 0) w *= 0.5;
    return w;
  }
  function pick() {
    let cand = pool.filter((k) => k !== lastSkill && weightOf(k) > 0);
    // サイドステップの あとは かならず ドリブル
    if (lastSkill === 'step') { const d = cand.filter((k) => SKILLS[k].hand !== 'hold'); cand = d.length ? d : pool.filter((k) => SKILLS[k].hand !== 'hold'); }
    const list = cand.length ? cand : pool;
    let tot = list.reduce((a, k) => a + weightOf(k), 0) || 1; let r = Math.random() * tot;
    for (const k of list) { r -= weightOf(k); if (r <= 0) return k; }
    return list[list.length - 1];
  }
  function addSection(beats, boss = false) {
    let left = beats; tiers.push(tier);
    if (mission.plan) {
      const idx = boss ? 3 : Math.min(2, tiers.length - 1); const first = cues.length;
      for (const [k, len] of mission.plan[idx]) { addCue(k, { len, boss }); lastSkill = k; }
      cues[first].stepName = mission.steps[idx]; cues[first].stepIdx = idx; return;
    }
    const handles = pool.filter((k) => SKILLS[k].handle); let mixed = 0;
    while (left > 0) {
      let k = pick(); const sk = SKILLS[k];
      if (k === 'drive' && left >= 8 && has('jab')) { const dir = lane === 0 ? (Math.random() < 0.5 ? -1 : 1) : -lane; addCue('jab', { dir: -dir, boss }); addCue('drive', { dir, boss, guard: true }); addCue('jstop', { boss }); lastSkill = 'drive'; left -= 8; continue; }
      if (k === 'drive') k = has('slide') ? 'slide' : 'right';
      if (k === 'hesi' && !has('fast')) k = pool[0];
      let len = SKILLS[k].len; if (len === 8) len = boss ? 4 : tier === 0 ? 8 : tier === 1 ? (Math.random() < 0.5 ? 8 : 4) : 4;
      len = Math.max(2, Math.min(len, left));
      addCue(k, { len, boss, guard: !!mission.guards && !!SKILLS[k].lane }); left -= len; lastSkill = k;
      // ドリブル → ハンドリング（4はく）→ ドリブル と つなぐ
      if (!test && !boss && handles.length && mixed < 2 && left >= 8 && SKILLS[k].hand !== 'hold' && !SKILLS[k].lane && Math.random() < 0.4) { const h = handles[Math.floor(Math.random() * handles.length)]; addCue(h, { len: 4 }); left -= 4; mixed++; }
      if (k === 'hesi' && left >= 2) { const l2 = Math.min(4, left); addCue('fast', { len: l2, boss, hand: curHand }); left -= l2; lastSkill = 'fast'; }
    }
  }
  const SECTIONS = dojo ? 0 : test ? 2 : video ? Math.max(4, Math.round(((stage.bpm / 60) * 130 - 6) / 40)) : 3; let sectionIdx = 1; const secStarts = [0]; const hasBoss = !dojo && (test || mission.boss || mission.fin);
  const dojoSets = [];
  if (dojo) {
    const sk = SKILLS[opts.skill]; const foot = (sk.hand === 'hold' && !sk.handle) || sk.lane; const len = Math.min(4, sk.len);
    [[70, foot ? 'none' : undefined, 'ゆっくり'], [86, undefined, 'ふつう'], [102, undefined, 'ゲームの はやさ']].forEach(([bpm, bm, name], i) => {
      const r = addCue('rest', { len: 4, bpm, hand: curHand }); r.setName = `${i + 1}/3　${name}${bm === 'none' ? '（ボールなしで 足だけ）' : ''}`; dojoSets.push(r);
      for (let j = 0; j < 4; j++) addCue(opts.skill, { len, ballMode: bm });
      if (lane !== 0) addCue(opts.skill, { len, ballMode: bm });
    });
    addCue('rest', { len: 2, noGate: true });
  } else {
    addCue('rest', { len: 4 });
    addCue(mission.pool ? mission.pool[0] : RK === 1 && !test ? 'stance' : 'right', { len: 4 }); lastSkill = mission.pool ? mission.pool[0] : 'right';
    addSection(36); safes.push(endBeat);
  }
  const cueAt = (b) => { for (let i = cues.length - 1; i >= 0; i--) if (b >= cues[i].b0) return cues[i]; return cues[0]; };
  const zAt = (b) => { const c = cueAt(b); return c.z0 + clamp(b - c.b0, 0, c.b1 - c.b0) * V * Math.max(c.sp, 0.05) + Math.max(0, b - c.b1) * V; };

  // ---------- 状態 ----------
  let beat = video ? -7 : -4, mbeat = 0, offset = video ? 7 : 4, lastQ = -1, last = performance.now();
  let loaded = false, waitT = 0;
  let phase = 'count'; let paused = false, dead = false, raf = 0;
  let score = 0, combo = 0, maxCombo = 0, hearts = 3, chaser = 0.3, chaserShow = 0.3, progShow = 0;
  let cuesOk = 0, cuesAll = 0, orbsGot = 0, dribbles = 0, leftReps = 0, rightReps = 0, speedMax = 0;
  const counts = {}; const okCounts = {}; const failCounts = {};
  let shake = 0, flash = 0, flashCol = '#fff', redFlash = 0, slow = 1;
  let curCue = cues[0], spokenFor = null, countShown = null, curLane = 0;
  const boss = { on: false, hp: 1, hit: 0, dead: false, gone: false, finale: false };
  const mid = { on: false, hp: 1, hit: 0, dead: false, gone: false }; let rushExt = 0; const rushT = [];
  // れんだ（ボス・ちゅうボス）：そのステージの ドリブルの ワザで はやく つよく
  const rushSkill = (list) => { const n = {}; for (const c of list) { const k = c.skill; const sk = SKILLS[k]; if (!sk || sk.hand === 'hold' || sk.hand === 'two' || sk.lane || sk.handle || sk.jump || sk.spin || sk.turn || k === 'rest') continue; n[k] = (n[k] || 0) + 1; } const k = Object.keys(n).sort((a, b) => n[b] - n[a])[0]; return k || 'fast'; };
  function rushHit() { // カメラで ドリブルを 見つけたとき：はやいほど 大ダメージ
    const tgt = phase === 'finale' ? boss : curCue && curCue.mid && mid.on && !mid.dead ? mid : null; if (!tgt) return;
    rushT.push(beat); while (rushT.length && beat - rushT[0] > 2) rushT.shift(); const rate = rushT.length / (2 / bps);
    const pow = clamp(rate / 2.4, 0.35, 1.6); tgt.hp = Math.max(0, tgt.hp - (tgt === boss ? 0.02 : 0.08) * pow); tgt.hit = 1; shake = Math.max(shake, 0.2 + 0.25 * pow);
    if (pow > 1.1 && Math.random() < 0.35) addText(['つよい！', 'はやい！', 'いいぞ！'][Math.floor(Math.random() * 3)], '#ffe03d', 0.8, 0.42, 0.6);
    if (tgt === mid && mid.hp <= 0) killMid(true); }
  function killMid(byHit) { mid.dead = true; mid.hp = 0; audio.sfx('boom'); shake = 1.2; const mp = scene.midPos(); scene.burst(mp.x, 2, mp.z, '#ffe03d', 70, 2); addText(byHit ? 'ディフェンスを ぬいた！' : 'ぬいた！', '#7dffb0', 1.2); sayBoth('ぬいた！', 'Beat him!'); setTimeout(() => { mid.gone = true; }, 800); }
  const texts = []; const shots = []; let bounceKey = -1; let pipRect = null;
  let trackedF = 0, allF = 0, lowNow = false, rescueT = 0, safeTimer = null, hxNow = 0, hyNow = 0;
  const tipIdx = { ...(pl.tipIdx || {}) };

  const sayBoth = (ja, en) => { if (settings.voice === 'en') audio.say(en); else if (settings.voice) speak(ja, 'ja'); };
  if (settings.voice === 'en') audio.loadVoice();
  const addText = (t, col = '#fff', size = 1, y = 0.34, life = 1) => texts.push({ t, col, size, y, life });
  const ballScreen = () => scene.project(scene.laneX + 0.4, 0.9, -0.3);

  // ---------- 判定（カメラ） ----------
  function onPose(res) {
    allF++; if (res.tracked) trackedF++; lowNow = !!res.low; if (res.hx != null) { hxNow = res.hx; hyNow = res.hy; }
    const c = curCue; if (!c || (phase !== 'run' && phase !== 'finale')) return; const s = c.st;
    s.f++; if (res.tracked) s.tr++; if (res.low || !res.legsVisible) s.lowF++;
    if (res.hx != null) { if (s.hx0 == null) { s.hx0 = res.hx; s.hy0 = res.hy; } s.move = Math.max(s.move, (res.hx - s.hx0) * (c.dir || 1)); s.rise = Math.max(s.rise, s.hy0 - res.hy); }
    for (const ev of res.events) {
      if (phase === 'finale' || (c.mid && mid.on)) rushHit();
      dribbles++; s.n++; if (ev.hand === 'right') { s.R++; rightReps++; } else { s.L++; leftReps++; }
      if (s.last && s.last !== ev.hand) s.sw++; s.last = ev.hand; if (beat - c.b0 > 1) s.late++;
      const want = c.hand === 'R' ? 'right' : c.hand === 'L' ? 'left' : null;
      if (c.hand !== 'hold' && (!want || want === ev.hand)) { const cz = zAt(beat); const o = orbs.find((x) => x.cue === c && !x.got && !x.missed && x.z - cz < V * 2.5); if (o) collect(o); }
    }
  }
  function judge(c) {
    if (c.judged || c.skill === 'rest') return; c.judged = true;
    counts[c.skill] = (counts[c.skill] || 0) + 1; cuesAll++;
    if (c.hand === 'L') leftReps += cam ? 0 : 1; else if (c.hand === 'R') rightReps += cam ? 0 : 1;
    if (!cam || c.ballMode === 'none') { cuesOk++; if (c.boss) bossShot(); return; }
    const s = c.st; const sk = SKILLS[c.skill]; const len = c.b1 - c.b0; const secs = len / bps; const seen = s.tr / Math.max(1, s.f) > 0.5; let ok;
    if ((c.skill === 'fast' || c.rush) && secs > 0.5) speedMax = Math.max(speedMax, s.n / secs); // はやさ（1びょうの かいすう）
    if (c.hand === 'R') ok = s.R >= 2 && s.R > s.L; else if (c.hand === 'L') ok = s.L >= 2 && s.L > s.R;
    else if (c.hand === 'alt') ok = s.sw >= Math.max(1, Math.floor(len / 4) * (sk.quick || 1)); else if (c.hand === 'combo') ok = s.n >= 3 && s.sw >= 1; else if (c.hand === 'two') ok = s.R >= 2 && s.L >= 2; else if (c.hand === 'alt1') ok = s.sw >= 1; else ok = s.late === 0;
    if (ok && sk.low) ok = s.lowF / Math.max(1, s.f) > 0.45;
    if (ok && sk.sp > 1.2 && c.skill === 'fast') ok = s.n / secs >= 2.4;
    if (ok && sk.lane && seen) ok = s.move > 0.4;
    if (ok && sk.jump && seen) ok = s.rise > 0.08;
    if (ok) {
      cuesOk++; okCounts[c.skill] = (okCounts[c.skill] || 0) + 1; chaser = Math.max(0.05, chaser - 0.07); audio.sfx('good'); addText(['ナイス！', 'いいぞ！', 'かんぺき！', 'そのちょうし！'][Math.floor(Math.random() * 4)], '#7dffb0');
      if (c.hand === 'hold') score += 30; if (c.boss) bossShot();
    } else {
      failCounts[c.skill] = (failCounts[c.skill] || 0) + 1; combo = 0; audio.sfx('bad'); shake = 0.5;
      if (dojo) addText('おしい！ もういちど', '#ffd0a0');
      else { chaser += 0.2; addText('おしい！', '#ff8da1'); if (chaser >= 1) { hearts = Math.max(0, hearts - 1); chaser = 0.45; redFlash = 1; audio.sfx('caught'); addText('つかまりそう！ にげろ！', '#ff4d6d', 1.2); shake = 1.2; } }
    }
  }
  function collect(o) {
    o.got = true; orbsGot++; combo++; maxCombo = Math.max(maxCombo, combo);
    score += Math.round(10 * (cam ? 1 + Math.min(combo, 30) / 30 : TIER_MULT[o.cue.tier ?? 1]));
    audio.sfx('orb', cam ? combo % 13 : orbsGot % 8);
    scene.burst(o.x, o.y, -Math.max(0.3, o.z - zAt(beat)), o.c, 8, 0.6);
  }
  function bossShot() { const need = cues.filter((c) => c.boss && c.skill !== 'rest').length || 1; boss.hp = Math.max(0.45, boss.hp - 0.5 / need); shots.push({ t: 0 }); audio.sfx('shot'); }

  // ---------- セーフゾーン ----------
  function hardest() { const seen = Object.keys(counts).filter((k) => SKILLS[k].tips.length); if (!seen.length) return null; return seen.sort((a, b) => (failCounts[b] || 0) - (failCounts[a] || 0) || SKILLS[b].r - SKILLS[a].r || (pl.m[a] || 0) - (pl.m[b] || 0))[0]; }
  function tipFor(k) { const i = (tipIdx[k] || 0) % SKILLS[k].tips.length; tipIdx[k] = i + 1; return SKILLS[k].tips[i]; }
  function advance(t) {
    if (t === 2) tier = Math.min(2, tier + 1); else if (t === 0) { tier = Math.max(0, tier - 1); chaser = Math.max(0.1, chaser - 0.15); }
    if (test) tier = 1;
    sectionIdx++; secStarts[sectionIdx - 1] = endBeat;
    if (sectionIdx === 2 && !dojo && !test && !mission.plan && SECTIONS >= 3) { addCue('rest', { len: 2, noGate: true }).midIntro = true; const m = addCue(rushSkill(cues), { len: 8, hand: curHand }); m.mid = true; m.rush = true; }
    addSection(sectionIdx === 2 ? 44 : 36); if (sectionIdx < SECTIONS) safes.push(endBeat);
    if (sectionIdx === SECTIONS) {
      if (hasBoss) { bossStart = endBeat; addCue('rest', { len: 4, noGate: true }).bossIntro = true; addSection(40, true); finaleBeat = endBeat; { const f = addCue(rushSkill(cues.filter((c) => c.boss)), { len: 16, boss: true, hand: curHand }); f.finale = true; f.rush = true; } }
      else addCue('rest', { len: 6, noGate: true }).goal = true;
    }
    if (t === 0) { const k = hardest(); if (k) addText(`コツ：${tipFor(k)}`, '#ffe9a8', 0.75, 0.26, 2.6); }
    else if (!mission.plan && !video) addText(['', '', 'このまま すすめ！', 'ちかみち！ とばすぞ！'][t + 1], pal.a, 1.1);
    audio.sfx('go'); offset = Math.ceil(mbeat) - beat; phase = 'run'; audio.bgmVol(0.85);
  }
  function enterSafe() {
    if (video) { advance(1); return; }   // どうが モード：せんたく がめんを 出さず そのまま つづける
    phase = 'safe'; audio.bgmVol(0.35); sayBoth('セーフゾーン！', 'Safe zone! Take a break.');
    const hit = cuesAll ? cuesOk / cuesAll : 1; const defT = cam ? (hit > 0.8 ? 2 : hit > 0.5 ? 1 : 0) : 1; const secs = cam ? 6 : 10;
    overlay.innerHTML = `<div class="safe"><div class="safe-title">🛡️ セーフゾーン <small>ボールを持って ひとやすみ</small></div>
      <div class="safe-q">${cam ? `ここまで <b>${Math.round(hit * 100)}%</b> せいこう！ つぎのルートは？` : 'いまの どうだった？ つぎのルートを えらぼう'}</div>
      <div class="safe-btns"><button data-t="2"><span>🔥</span><b>よゆう！</b><small>ちかみち（はやい・⚡多い）</small></button><button data-t="1"><span>🙂</span><b>ギリギリ</b><small>このままのルート</small></button><button data-t="0"><span>😵</span><b>むずかしい</b><small>あんぜんルート＋コツ</small></button></div>
      <div class="safe-bar"><div id="safebar"></div></div></div>`;
    const btns = [...overlay.querySelectorAll('[data-t]')];
    const choose = (t) => { if (phase !== 'safe') return; clearTimeout(safeTimer); overlay.innerHTML = ''; advance(t); };
    btns.forEach((b) => b.addEventListener('click', () => choose(+b.dataset.t)));
    btns[2 - defT].classList.add('pick'); try { btns[2 - defT].focus(); } catch (e) { /* noop */ }
    const bar = overlay.querySelector('#safebar'); bar.style.transition = `width ${secs}s linear`; requestAnimationFrame(() => { bar.style.width = '0%'; });
    safeTimer = setTimeout(() => choose(defT), secs * 1000);
  }

  // ---------- HUD ----------
  function txt(s, x, y, size, col, align = 'center') {
    const ff = '"M PLUS Rounded 1c","Hiragino Maru Gothic ProN",sans-serif'; g.font = `900 ${Math.round(size)}px ${ff}`; g.textAlign = align; g.textBaseline = 'middle';
    // 画面から はみ出す ときは 文字を 小さくして おさめる
    const m = 8 * DPR; const room = (align === 'center' ? 2 * Math.min(x, W - x) : align === 'right' ? x : W - x) - m; const tw = g.measureText(s).width;
    if (room > 40 && tw > room) { size = Math.max(9 * DPR, size * room / tw); g.font = `900 ${Math.round(size)}px ${ff}`; }
    g.lineWidth = Math.max(4, size / 5); g.strokeStyle = 'rgba(2,4,20,.9)'; g.lineJoin = 'round'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y);
  }
  function pill(x, y, w, h, col, a = 0.75) { g.globalAlpha = a; g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill(); g.globalAlpha = 1; }
  // ワザの うごきを 絵で見せる（ボールの通り道＝スワイプの線、足、手）
  function ballPath(c, b) {
    const sk = SKILLS[c.skill]; const cb = b - c.b0; const ph = frac(b); const bph = frac(b * (sk.dbl ? 2 : 1)); const hs = c.hand === 'L' ? -1 : 1;
    if (sk.handle) { // ボールまわし：2はくで 1しゅう（からだの まえを とおる ときは うすく）
      const th = frac(Math.max(0, cb) * 0.5) * TAU, sn = Math.sin(th), cs = Math.cos(th);
      if (sk.handle === 'swing') { const u = Math.sin(Math.PI * cb); return { x: u * 0.7, h: 0.4, both: true, dim: true }; }
      if (sk.handle === 'eight') return { x: 0.85 * sn, h: 0.22 + 0.06 * Math.abs(sn), both: true, dim: Math.sin(2 * th) > 0 };
      if (sk.handle === 'leg') return { x: 0.55 + 0.4 * sn, h: 0.25, both: true, dim: cs > 0 };
      const H = sk.handle === 'head' ? 1.2 : sk.handle === 'knees' ? 0.3 : 0.62; return { x: 0.8 * sn, h: H, both: true, dim: cs > 0 };
    }
    if (c.hand === 'hold') return { x: hs * 0.25, h: 0.85, hold: true };
    if (c.hand === 'combo') { const st = comboState(sk, c.hand0, cb); return { x: st.x, h: Math.abs(Math.sin(Math.PI * cb)) * (st.n ? 0.7 : 1) }; }
    if (c.hand === 'two') { // 2ボール：ひだり（x, h）と みぎ（x2, h2）
      const k = sk.dbl ? 2 : 1, a = Math.abs(Math.sin(Math.PI * b * k)) * (sk.low ? 0.45 : sk.high ? 1 : 0.8);
      if (sk.two === 'alt') return { x: -1, h: a, x2: 1, h2: Math.abs(Math.cos(Math.PI * b)) * 0.8, both: true };
      if (sk.two === 'par') { const v = Math.cos(Math.PI * b); return { x: -0.6 + 0.35 * v, h: a, x2: 0.6 + 0.35 * v, h2: a, both: true }; }
      if (sk.two === 'v') { const v = Math.cos(Math.PI * b); return { x: -0.6 - 0.4 * Math.abs(v), h: a, x2: 0.6 + 0.4 * Math.abs(v), h2: a, both: true }; }
      return { x: -1, h: a, x2: 1, h2: a, both: true };
    }
    if (sk.semi) { const a = Math.PI / 2 * (1 - Math.cos(Math.PI * cb / 2)); return { x: hs * (0.45 + 0.5 * Math.sin(a)), h: Math.abs(Math.sin(Math.PI * cb)) * 0.7, same: hs }; }
    if (sk.vmove) { const c2 = Math.cos(Math.PI * cb); return sk.vmove === 'side' ? { x: hs, h: Math.abs(c2) * 0.75 } : { x: hs * (0.05 + 0.95 * (c2 + 1) / 2), h: Math.abs(c2) * 0.75, same: hs }; } // かたて：まんなかまで
    if (c.hand === 'alt' || c.hand === 'alt1') { const k = c.hand === 'alt1' ? Math.min(1, Math.max(0, cb)) : cb * (sk.quick || 1); const s0 = c.hand0 === 'L' ? -1 : 1; if (c.hand === 'alt1' && cb >= 1) return { x: -s0, h: Math.abs(Math.sin(Math.PI * bph)) }; return { x: Math.cos(Math.PI * k) * s0, h: Math.abs(Math.cos(Math.PI * k)) * 0.75 }; }
    if (sk.inout) return { x: hs * (1 - 0.75 * Math.sin(Math.PI * ph)), h: Math.abs(Math.sin(Math.PI * bph)) };
    return { x: hs, h: Math.abs(Math.sin(Math.PI * bph)) * (sk.low ? 0.42 : 1) };
  }
  function drawArrows(c, x, y, r, b) {
    const col = SKILLS[c.skill].c; const dir = c.dir || 1; const ang = SKILLS[c.skill].lane ? (dir > 0 ? 0 : Math.PI) : c.skill === 'back' ? Math.PI / 2 : -Math.PI / 2;
    for (let i = 0; i < 3; i++) { const t = frac(b * 1.5 + i / 3); g.globalAlpha = 1 - Math.abs(t - 0.5) * 1.6; g.save(); g.translate(x + Math.cos(ang) * (t - 0.5) * r * 1.2, y + Math.sin(ang) * (t - 0.5) * r * 0.3); g.rotate(ang); g.strokeStyle = col; g.lineWidth = r * 0.09; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-r * 0.1, -r * 0.14); g.lineTo(r * 0.1, 0); g.lineTo(-r * 0.1, r * 0.14); g.stroke(); g.restore(); } g.globalAlpha = 1;
  }
  function drawGlyph(c, x, y, r, b, alpha) {
    const sk = SKILLS[c.skill]; const col = sk.c; const cb = b - c.b0; const dir = c.dir || 1;
    g.save(); g.translate(x, y);
    g.globalAlpha = 0.86 * alpha; g.fillStyle = '#040820'; g.beginPath(); g.roundRect(-r, -r, 2 * r, 2 * r, r * 0.24); g.fill(); g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = Math.max(2, r * 0.045); g.stroke();
    g.beginPath(); g.roundRect(-r, -r, 2 * r, 2 * r, r * 0.24); g.clip();
    const fy = r * 0.72; const hx = r * 0.58; const top = -r * 0.28;
    g.strokeStyle = '#ffffff30'; g.lineWidth = r * 0.03; g.beginPath(); g.moveTo(-r * 0.85, fy); g.lineTo(r * 0.85, fy); g.stroke();
    // 足
    let lf = [-0.3, 0], rf = [0.3, 0];
    if (sk.jump) { const j = cb < 1 ? Math.sin(Math.PI * Math.max(0, cb)) : 0; lf = [-0.16 - (cb >= 1 ? 0.2 : 0), -j * 0.5]; rf = [0.16 + (cb >= 1 ? 0.2 : 0), -j * 0.5]; }
    if (sk.jab) { const j = Math.sin(Math.min(1, frac(Math.max(0, cb)) * 1.7) * Math.PI); if (dir > 0) rf = [0.3 + j * 0.42, -j * 0.12]; else lf = [-0.3 - j * 0.42, -j * 0.12]; }
    if (sk.lane) { const t = clamp(cb / 1.5, 0, 1); const off = (1 - t) * -dir * 0.35; const hop = Math.sin(Math.PI * clamp(cb, 0, 1)) * 0.1; lf = [-0.3 + off, dir > 0 ? 0 : -hop]; rf = [0.3 + off, dir > 0 ? -hop : 0]; }
    if (sk.legs) { const sg = Math.tanh(Math.cos(Math.PI * cb) * 3) * (c.hand0 === 'L' ? -1 : 1); lf = [-0.3, sg * -0.08]; rf = [0.3, sg * 0.08]; }
    if (sk.turn) { const psi = Math.sin(Math.max(0, cb) * Math.PI * 0.5) * 1.25; rf = [-0.3 + 0.6 * Math.cos(psi), -0.25 * Math.abs(Math.sin(psi))]; g.strokeStyle = col; g.lineWidth = r * 0.04; g.beginPath(); g.arc(-0.3 * r, fy, r * 0.6, -0.1, -1.3, true); g.stroke(); }
    for (const f of [lf, rf]) { g.fillStyle = '#e8eeff'; g.beginPath(); g.roundRect(f[0] * r - r * 0.13, fy + f[1] * r - r * 0.09, r * 0.26, r * 0.11, r * 0.05); g.fill(); }
    if (sk.legs) { g.strokeStyle = '#e8eeff'; g.lineWidth = r * 0.07; g.lineCap = 'round'; g.beginPath(); g.moveTo(lf[0] * r, fy - r * 0.1); g.lineTo(0, top + r * 0.1); g.lineTo(rf[0] * r, fy - r * 0.1); g.stroke(); }
    if (sk.behind) { g.fillStyle = '#e8eeff'; g.globalAlpha = 0.5 * alpha; g.beginPath(); g.roundRect(-r * 0.22, top - r * 0.2, r * 0.44, r * 0.8, r * 0.1); g.fill(); g.globalAlpha = alpha; }
    // 手
    const p = ballPath(c, b);
    for (const s of [-1, 1]) { const on = p.hold || p.both || (p.same ? p.same === s : Math.sign(p.x || 1) === s); g.strokeStyle = on ? col : '#ffffff40'; g.fillStyle = on ? col + '55' : 'transparent'; g.lineWidth = r * 0.035; g.beginPath(); g.arc(s * hx, top - r * 0.22, r * 0.13, 0, TAU); g.fill(); g.stroke(); g.fillStyle = on ? '#fff' : '#ffffff55'; g.font = `900 ${Math.round(r * 0.16)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s < 0 ? 'ひ' : 'み', s * hx, top - r * 0.21); }
    // よこへ・まえへ・うしろへ の やじるし
    const chev = (cx0, cy0, ang, n) => { for (let i = 0; i < n; i++) { const t = frac(b * 1.5 + i / n); g.globalAlpha = alpha * (1 - Math.abs(t - 0.5) * 1.6); g.save(); g.translate(cx0 + Math.cos(ang) * (t - 0.5) * r * 1.2, cy0 + Math.sin(ang) * (t - 0.5) * r * 1.2); g.rotate(ang); g.strokeStyle = col; g.lineWidth = r * 0.09; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-r * 0.1, -r * 0.16); g.lineTo(r * 0.1, 0); g.lineTo(-r * 0.1, r * 0.16); g.stroke(); g.restore(); } g.globalAlpha = alpha; };
    if (sk.lane) chev(0, -r * 0.72, dir > 0 ? 0 : Math.PI, 3);
    if (c.skill === 'back') chev(0, -r * 0.7, Math.PI / 2, 2); if (c.skill === 'fast' || c.skill === 'drive') chev(-dir * r * 0.0, r * 0.1, -Math.PI / 2, 3);
    if (c.skill === 'stance' || sk.low) { g.strokeStyle = col; g.lineWidth = r * 0.05; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * r * 0.82, -r * 0.1); g.lineTo(s * r * 0.82, r * 0.3); g.lineTo(s * r * 0.72, r * 0.2); g.moveTo(s * r * 0.82, r * 0.3); g.lineTo(s * r * 0.92, r * 0.2); g.stroke(); } }
    // ボールと スワイプの線
    if (c.ballMode !== 'none') {
      const pos = (q) => [q.x * hx, fy - r * 0.14 - q.h * (fy - r * 0.14 - top)];
      if (!p.hold) { g.lineCap = 'round'; const N = 12; let prev = pos(p); for (let i = 1; i <= N; i++) { const q = pos(ballPath(c, b - i * 0.045)); g.globalAlpha = alpha * (1 - i / N) * (sk.behind ? 0.5 : 0.95); g.strokeStyle = col; g.lineWidth = r * 0.2 * (1 - i / N) + 1; g.beginPath(); g.moveTo(prev[0], prev[1]); g.lineTo(q[0], q[1]); g.stroke(); prev = q; } if (p.x2 !== undefined) { let pv = pos({ x: p.x2, h: p.h2 }); for (let i = 1; i <= N; i++) { const o2 = ballPath(c, b - i * 0.045); const q = pos({ x: o2.x2, h: o2.h2 }); g.globalAlpha = alpha * (1 - i / N) * 0.95; g.strokeStyle = col; g.lineWidth = r * 0.2 * (1 - i / N) + 1; g.beginPath(); g.moveTo(pv[0], pv[1]); g.lineTo(q[0], q[1]); g.stroke(); pv = q; } } g.globalAlpha = alpha; }
      const bp = pos(p); const strong = c.skill === 'pound'; const br = r * (strong ? 0.24 : 0.15); const gr = g.createRadialGradient(bp[0] - br * 0.3, bp[1] - br * 0.3, br * 0.1, bp[0], bp[1], br); gr.addColorStop(0, '#ffc27a'); gr.addColorStop(1, '#e8590c'); const dBall = (q, dim) => { const gq = g.createRadialGradient(q[0] - br * 0.3, q[1] - br * 0.3, br * 0.1, q[0], q[1], br); gq.addColorStop(0, '#ffc27a'); gq.addColorStop(1, '#e8590c'); g.globalAlpha = alpha * (dim ? 0.55 : 1); g.fillStyle = gq; g.beginPath(); g.arc(q[0], q[1], br, 0, TAU); g.fill(); g.strokeStyle = '#5c2000'; g.lineWidth = Math.max(1, r * 0.015); g.beginPath(); g.moveTo(q[0] - br, q[1]); g.lineTo(q[0] + br, q[1]); g.stroke(); g.globalAlpha = alpha; };
      dBall(bp, sk.behind || p.dim); if (p.x2 !== undefined) dBall(pos({ x: p.x2, h: p.h2 }), false); void gr;
      if (strong) { // つよく：ゆかに つく たびに 大きな わ と しょうげき線
        const hit = Math.max(0, 1 - p.h * 5); if (hit > 0) { g.globalAlpha = alpha * hit; g.strokeStyle = '#fff'; g.lineWidth = r * 0.045; g.beginPath(); g.ellipse(bp[0], fy, r * (0.25 + 0.45 * (1 - hit)), r * (0.07 + 0.1 * (1 - hit)), 0, 0, TAU); g.stroke();
          for (let i = -3; i <= 3; i++) { if (!i) continue; g.beginPath(); g.moveTo(bp[0] + i * r * 0.11, fy - r * 0.02); g.lineTo(bp[0] + i * r * 0.2, fy - r * 0.2); g.stroke(); } g.globalAlpha = alpha; }
        g.fillStyle = '#fff'; g.font = `900 ${Math.round(r * 0.2)}px sans-serif`; g.textAlign = 'center'; g.fillText('ドン！', bp[0], bp[1] - br - r * 0.08); }
    }
    if (c.skill === 'freeze') { g.strokeStyle = '#ff2d55'; g.lineWidth = r * 0.08; g.beginPath(); g.arc(0, 0, r * 0.7, 0, TAU); g.stroke(); }
    if (c.skill === 'hesi') { g.fillStyle = col; for (let i = 0; i < 3; i++) { g.globalAlpha = alpha * (frac(b) > i / 3 ? 1 : 0.25); g.beginPath(); g.arc((i - 1) * r * 0.22, -r * 0.72, r * 0.06, 0, TAU); g.fill(); } g.globalAlpha = alpha; }
    g.restore();
  }
  const enLabel = (c) => { const sk = SKILLS[c.skill]; const d = (sk.lane || sk.jab) && c.dir ? (c.dir > 0 ? ' right' : ' left') : ''; const h = sk.hand === 'cur' && c.skill !== 'rest' ? (c.hand === 'L' ? 'Left hand, ' : 'Right hand, ') : ''; return `${h}${sk.en}${d}`; };
  const cueLabel = (c) => { const sk = SKILLS[c.skill]; const dirT = (sk.lane || sk.jab) && c.dir ? (c.dir > 0 ? 'みぎへ ' : 'ひだりへ ') : ''; const handT = sk.hand === 'cur' && c.skill !== 'rest' ? (c.hand === 'L' ? 'ひだりで ' : 'みぎで ') : ''; return `${sk.i} ${dirT}${handT}${sk.n}`; };
  function drawHUD(c, next) {
    g.clearRect(0, 0, W, H);
    const pad = 14 * DPR; const fs = clamp(H * 0.036, 13 * DPR, 30 * DPR); const cx = W / 2; const tall = W < H;
    if (!dojo) {
      pill(pad * 0.6, pad * 0.5, fs * 5.2, fs * 1.6, '#040820'); txt(`⚡ ${score}`, pad * 1.4, pad * 0.5 + fs * 0.85, fs, '#fff', 'left');
      if (cam && combo >= 3) txt(`${combo} コンボ`, pad * 1.4, pad + fs * 2.4, fs * 0.9, combo >= 15 ? '#ffe03d' : pal.a, 'left');
      if (cam) txt('❤️'.repeat(hearts) + '🖤'.repeat(3 - hearts), W - pad - 50 * DPR, pad * 0.5 + fs * 0.85, fs * 0.8, '#fff', 'right');
      chaserShow += (chaser - chaserShow) * 0.08;
      // すすみぐあい：エリアごとに くぎり、さいごは ボス（🏃 が 🏁 に むかって すすむ）
      const nSeg = SECTIONS + (hasBoss ? 1 : 0); let seg, a0, a1;
      if (beat >= bossStart) { seg = SECTIONS; a0 = bossStart; a1 = Math.max(finaleBeat + 16, endBeat); }
      else { seg = Math.min(SECTIONS, sectionIdx) - 1; a0 = secStarts[seg] || 0; a1 = seg === sectionIdx - 1 ? Math.min(endBeat, bossStart) : (secStarts[seg + 1] || endBeat); }
      progShow += ((seg + clamp((beat - a0) / Math.max(1, a1 - a0), 0, 1)) / nSeg - progShow) * 0.1; if (beat < 0) progShow = 0;
      const mw = Math.min(W * (tall ? 0.5 : 0.3), 360 * DPR), mx = cx - mw / 2, my = pad + fs * (tall ? 2.6 : 0.6);
      pill(mx - 6 * DPR, my - 7 * DPR, mw + 12 * DPR, 14 * DPR, '#040820'); pill(mx, my - 4 * DPR, Math.max(8 * DPR, mw * progShow), 8 * DPR, beat >= bossStart ? '#ff2d55' : pal.a, 1);
      g.fillStyle = '#ffffffaa'; for (let i = 1; i < nSeg; i++) g.fillRect(mx + mw * i / nSeg - DPR, my - 6 * DPR, 2 * DPR, 12 * DPR); // エリアの くぎり
      g.font = `${Math.round(fs)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(hasBoss ? '👾' : '🏁', mx + mw + fs * 0.75, my); g.fillText('🏃', mx + mw * progShow, my - fs * 0.15);
      txt(beat >= bossStart ? 'BOSS' : test ? 'しょうきゅうテスト' : `エリア ${Math.min(SECTIONS, sectionIdx)}/${SECTIONS}`, cx, my + fs * 1.05, fs * 0.62, '#cfd8ff');
      if (mid.on && !mid.dead) { const bw = Math.min(W * 0.4, 420 * DPR), bh = 12 * DPR, bx = cx - bw / 2, by = my + fs * 2.3; pill(bx - 4, by - 4, bw + 8, bh + 8, '#040820'); pill(bx, by, Math.max(bh, bw * mid.hp), bh, '#ff8a28', 1); txt('ちゅうボス ディフェンス', cx, by + bh + fs * 0.6, fs * 0.6, '#ffe0c0'); }
      if (boss.on && !boss.dead) { const bw = Math.min(W * 0.5, 520 * DPR), bh = 14 * DPR, bx = cx - bw / 2, by = my + fs * 2.3; pill(bx - 4, by - 4, bw + 8, bh + 8, '#040820'); pill(bx, by, Math.max(bh, bw * boss.hp), bh, '#ff2d55', 1); txt(test ? 'しけんかん' : world.boss, cx, by + bh + fs * 0.6, fs * 0.6, '#ffd0d8'); }
    } else {
      const set = [...dojoSets].reverse().find((s) => beat >= s.b0); const sk = SKILLS[opts.skill];
      pill(cx - Math.min(W * 0.46, 520 * DPR), pad * 0.6, Math.min(W * 0.92, 1040 * DPR), fs * 3.5, '#040820', 0.82);
      txt(`トレーニングルーム　${set ? set.setName : ''}`, cx, pad * 0.6 + fs * 0.9, fs * 0.7, '#7dffb0');
      txt(`💡 ${sk.tips[(tipBase + dojoSets.indexOf(set || dojoSets[0])) % sk.tips.length]}`, cx, pad * 0.6 + fs * 2.3, Math.min(fs * 0.95, W / 22), '#fff');
    }
    if (c && phase !== 'count' && phase !== 'rescue') {
      const r = clamp(Math.min(W, H) * (tall ? 0.17 : 0.21), 50 * DPR, 190 * DPR); const gx = W - pad - r, gy = H - pad - r - fs * 1.5;
      pipRect = { x: (gx - r) / DPR, y: (gy - r) / DPR, w: (2 * r) / DPR, h: (2 * r) / DPR };
      g.strokeStyle = SKILLS[c.skill].c; g.lineWidth = Math.max(3, r * 0.04); g.strokeRect(gx - r, gy - r, 2 * r, 2 * r);
      if (SKILLS[c.skill].lane || c.skill === 'back' || c.skill === 'fast' || c.skill === 'drive') drawArrows(c, gx, gy - r * 0.78, r, beat);
      if (settings.voice === 'en' && SKILLS[c.skill].en) { const e = enLabel(c).toUpperCase() + '!'; txt(e, W - pad, gy - r - fs * 0.75, Math.min(fs * 1.25, (W * 0.5) / Math.max(4, e.length) * 1.7), '#fff', 'right'); }
      if (c.b1 - c.b0 >= 2) { const pr = clamp((beat - c.b0) / (c.b1 - c.b0), 0, 1); pill(gx - r, gy + r + 4 * DPR, 2 * r * pr, 5 * DPR, SKILLS[c.skill].c, 0.95); }
      const s = cueLabel(c); txt(s, W - pad, gy + r + fs * 0.95, Math.min(fs * 1.05, (W * 0.6) / Math.max(4, s.length) * 1.5), SKILLS[c.skill].c, 'right');
      if (next && next.skill !== 'rest') { const rem = next.b0 - beat; if (rem <= 4 && rem > 0) { const r2 = r * 0.56; const nx = gx - r - r2 - 10 * DPR, ny = gy + r - r2; g.globalAlpha = 0.9; drawGlyph(next, nx, ny, r2, next.b0 + frac(beat) + Math.floor(beat) % 2, 0.9); g.globalAlpha = 1; txt(`つぎ ${Math.ceil(rem)}`, nx, ny - r2 - fs * 0.5, fs * 0.7, SKILLS[next.skill].c); } }
    }
    if (cam) { const ok = allF ? trackedF / allF : 0; txt(ok > 0.5 ? '📷 OK' : '📷 からだを うつしてね', W - pad, H - pad - fs * 0.5, fs * 0.6, ok > 0.5 ? '#7dffb0' : '#ffe03d', 'right'); }
    // ボスへの ショットとビーム
    const bp = scene.bossPos(); const bs = scene.project(bp.x, bp.y, bp.z).map((v) => v * DPR); const ps = ballScreen().map((v) => v * DPR);
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.t += 0.06; const t = Math.min(1, s.t); const x = ps[0] + (bs[0] - ps[0]) * t, y = ps[1] + (bs[1] - ps[1]) * t - Math.sin(t * Math.PI) * H * 0.08; const r = (1 - t * 0.6) * H * 0.022;
      g.globalAlpha = 0.4; g.fillStyle = pal.a; g.beginPath(); g.arc(x, y, r * 2.2, 0, TAU); g.fill(); g.globalAlpha = 1; g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      if (s.t >= 1) { shots.splice(i, 1); boss.hit = 1; audio.sfx('hit'); scene.burst(bp.x, bp.y, bp.z + 2, '#ffe03d', 30, 1.6); shake = Math.max(shake, 0.5); } }
    if (phase === 'finale') { const t = clamp((beat - finaleBeat) / 8, 0, 1); g.globalAlpha = 0.6 + 0.3 * Math.sin(mbeat * 40); g.strokeStyle = '#3df5ff'; g.lineWidth = (8 + t * 26) * DPR; g.lineCap = 'round'; g.beginPath(); g.moveTo(ps[0], ps[1]); g.lineTo(bs[0], bs[1]); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = (3 + t * 8) * DPR; g.stroke(); g.globalAlpha = 1; }
    // けいこく・フラッシュ
    const danger = Math.max(redFlash, clamp((chaserShow - 0.6) * 2, 0, 0.6) * (0.6 + 0.4 * Math.sin(mbeat * TAU * 2)));
    if (danger > 0.02) { const v = g.createRadialGradient(cx, H / 2, H * 0.3, cx, H / 2, Math.max(W, H) * 0.7); v.addColorStop(0, 'rgba(255,0,60,0)'); v.addColorStop(1, `rgba(255,0,60,${danger})`); g.fillStyle = v; g.fillRect(0, 0, W, H); }
    if (flash > 0.01) { g.globalAlpha = flash * 0.35; g.fillStyle = flashCol; g.fillRect(0, 0, W, H); g.globalAlpha = 1; flash *= 0.85; }
    if (phase === 'count' && video && -beat > 3.1) { g.globalAlpha = Math.min(1, (-beat - 3.1) * 2); txt('ドリブル練習', cx, H * 0.4, Math.min(H * 0.07, W / 15), pal.a); const vTitle = (mission.vt || mission.n) + (stage && !stage.sp ? `【レベル${wi + 1}】` : ''); txt(vTitle, cx, H * 0.53, Math.min(H * 0.13, W / 8.5), '#fff'); g.globalAlpha = 1; }
    if (phase === 'count') { const n = Math.ceil(-beat); if (n > 0 && n <= 3) txt(String(n), cx, H * 0.42, H * 0.28 * (1 + frac(-beat) * 0.3), '#fff'); if (!video || -beat <= 3.1) txt(dojo ? `${SKILLS[opts.skill].i} ${SKILLS[opts.skill].n}` : test ? 'しょうきゅうテスト' : `${stage.name}　${mission.i} ${mission.n}`, cx, H * 0.17, Math.min(H * 0.065, W / 16), pal.a); }
    if (phase === 'rescue') txt(hasBoss ? 'BOSS げきは！' : dojo ? 'れんしゅう おわり！' : 'ゴール！', cx, H * 0.4, Math.min(H * 0.12, W / 9) * Math.min(1, rescueT * 3), '#ffe03d');
    for (let i = texts.length - 1; i >= 0; i--) { const t = texts[i]; t.life -= 0.013; if (t.life <= 0) { texts.splice(i, 1); continue; } g.globalAlpha = Math.min(1, t.life * 2.5); txt(t.t, cx, H * (t.y - (1 - Math.min(1, t.life)) * 0.05), Math.min(H * 0.06 * t.size, (W * 0.92) / Math.max(6, t.t.length) * 1.4), t.col); g.globalAlpha = 1; }
  }
  const tipBase = (pl.tipIdx && pl.tipIdx[opts.skill]) || 0;

  // ---------- 毎フレーム ----------
  function frame(now) {
    if (dead) return; raf = requestAnimationFrame(frame);
    const rdt = Math.min(video ? 0.5 : (window.__dtcap || 0.05), (now - last) / 1000);
    if (video) { (window.__ft || (window.__ft = [])).push(now - last); if (window.__ft.length > 2000) window.__ft.shift(); }
    last = now; if (paused) return;
    slow += (1 - slow) * 0.06; let dt = rdt * slow;
    // コートと プレイヤーの 絵が そろうまで カウントを はじめない（さいだい 8びょう）
    if (!loaded && phase === 'count') { waitT += rdt; loaded = ((!scene.ready || scene.ready()) && audio.bgmReady()) || waitT > 8; if (!loaded) dt = 0; else if (useSong) audio.playBgm(mbeat); }
    { const mb = useSong ? audio.bgmBeat() : null; if (mb != null) mbeat = Math.max(mbeat - 0.25, mb); else mbeat += dt * bps; } const prevBeat = beat;
    if (phase === 'count' || phase === 'run' || phase === 'finale') beat = Math.max(beat, mbeat - offset);
    const q = Math.floor(mbeat * 4);
    if (q !== lastQ) { lastQ = q; audio.tick(q, phase === 'safe' || phase === 'rescue' || dojo ? 'safe' : phase === 'count' ? 'intro' : beat >= bossStart ? 'boss' : 'run'); if (dojo && q % 4 === 0) audio.sfx('count'); }
    if (phase === 'count') { const n = Math.ceil(-beat); if (n !== countShown && n >= 0) { countShown = n; if (n > 0 && n <= 3) { audio.sfx('count'); sayBoth(String(n), ['', 'one', 'two', 'three'][n]); } } if (beat >= 0) { phase = 'run'; audio.sfx('go'); addText(dojo ? 'スタート！' : 'GO!', pal.a, 2); } }
    if (pose) { const r = pose.poll(); if (r) onPose(r); }
    const camZ = zAt(Math.max(0, beat)) + Math.min(0, beat) * V;

    if (phase === 'run' || phase === 'finale') {
      if (safes.length && beat >= safes[0]) { beat = safes[0]; safes.shift(); judge(curCue); enterSafe(); }
      else {
        const c = cueAt(beat);
        if (c !== curCue) {
          const prevC = curCue; judge(curCue); curCue = c; if (prevC && prevC.mid && mid.on && !mid.dead) killMid(false); curLane = c.lane1; const sk = SKILLS[c.skill];
          if (c.bpm) bps = c.bpm / 60;
          if (c.skill !== 'rest') { audio.sfx(sk.sp > 1.2 ? 'whoosh' : 'gate'); flash = 0.4; flashCol = sk.c; shake = Math.max(shake, sk.sp > 1.2 ? 0.6 : 0.25); scene.burst(c.lane1 * LW, 1.5, -1, sk.c, 26, 1.3); if (sk.jump) { audio.sfx('jump'); setTimeout(() => !dead && audio.sfx('land'), 500 / bps); } if (c.skill === 'drive') slow = 0.55; }
          if (c.stepName) { texts.length = 0; addText(c.stepName, '#ffe9a8', 0.8, 0.3, 2.4); sayBoth(c.stepName.split('　')[0], ['Step one', 'Step two', 'Step three', 'Final step'][c.stepIdx]); }
          if (c.goal) { texts.length = 0; addText('🏁 ゴールは すぐそこ！', '#ffe03d', 1.1, 0.3, 1.6); sayBoth('ゴールは すぐそこ', 'Go!'); }
          if (c.setName) { addText(c.setName, '#7dffb0', 0.8, 0.4, 1.6); sayBoth(c.setName.split('　')[1] || '', ['Slow', 'Normal speed', 'Game speed'][dojoSets.indexOf(c)]); }
          if (c.bossIntro) { boss.on = true; addText(`⚠️ ${test ? 'しけんかん' : world.boss} があらわれた！`, '#ff4d6d', 1.2); audio.sfx('warn'); sayBoth('ボスだ！', 'Boss incoming!'); }
          if (c.finale) { phase = 'finale'; boss.finale = true; rushT.length = 0; addText(`いまだ！ ${SKILLS[c.skill].n}で れんだ！！`, '#3df5ff', 1.4, 0.34, 1.8); sayBoth('いまだ！はやく つよく！', 'Now! Fast and hard!'); }
          if (c.rushMore) { addText('まだまだ！ もっと はやく つよく！', '#ff8da1', 1.2); sayBoth('まだまだ！', 'Keep going!'); }
          if (c.midIntro) { mid.on = true; mid.hp = 1; mid.dead = false; mid.gone = false; texts.length = 0; addText('🛡️ ちゅうボス！ はやい ドリブルで ぬけ！', '#ff8a28', 1.15, 0.34, 1.6); audio.sfx('warn'); sayBoth('ちゅうボスだ！はやく ドリブル！', 'Mini boss! Dribble fast!'); }
          if (c.mid) rushT.length = 0;
        }
        const next = cues[cues.indexOf(curCue) + 1];
        if (next && next.skill !== 'rest' && spokenFor !== next && next.b0 - beat <= 2) { spokenFor = next; const sk = SKILLS[next.skill]; sayBoth(((sk.lane || sk.jab) && next.dir ? (next.dir > 0 ? 'みぎへ ' : 'ひだりへ ') : '') + sk.say, enLabel(next) + '!'); audio.sfx('warn'); }
        // ボールが ゆかに つく音
        if (curCue.hand !== 'hold' && curCue.ballMode !== 'none') { const skc = SKILLS[curCue.skill]; const dbl = (skc.dbl ? 2 : 1) * (curCue.rush ? 2 : 1) * (skc.quick || 1) * (skc.fig8 ? 2 : 1) * (skc.two === 'alt' ? 2 : 1); const alt = skc.vmove || curCue.hand === 'alt' || (curCue.hand === 'alt1' && beat - curCue.b0 < 1); const key = Math.floor(beat * dbl + (alt ? 0.5 : 0)); if (key !== bounceKey) { bounceKey = key; const k = curCue.skill; audio.sfx('bounce', k === 'pound' || k === 'drive' ? 1.25 : SKILLS[k].low ? 0.7 : k === 'fast' ? 0.85 : 1); } }
        for (const o of orbs) { if (o.got || o.missed) continue; if (o.z <= camZ + 0.4) { if (cam && o.cue.hand !== 'hold') { o.missed = true; combo = 0; } else collect(o); } }
        if (phase === 'finale' && boss.hp <= 0.001 && endBeat > beat) endBeat = beat; // たおしたら すぐ おわり
        if (beat >= endBeat && (dojo || sectionIdx >= SECTIONS) && phase === 'finale' && cam && boss.hp > 0.03 && rushExt < 2) { rushExt++; const f = addCue(curCue.skill, { len: 8, boss: true, hand: curHand }); f.rush = true; f.rushMore = true; }
        if (beat >= endBeat && (dojo || sectionIdx >= SECTIONS)) {
          judge(curCue); phase = 'rescue'; rescueT = 0; flash = 1; flashCol = '#fff';
          if (hasBoss) { boss.dead = true; boss.hp = 0; audio.sfx('boom'); shake = 2; const bp = scene.bossPos(); scene.burst(bp.x, bp.y, bp.z + 2, '#ffe03d', 120, 3); scene.burst(bp.x, bp.y, bp.z + 2, '#ff4d6d', 90, 2.2); slow = 0.3; sayBoth('やったー！', 'You did it!'); setTimeout(() => { boss.gone = true; }, 700); }
          else { audio.sfx('fanfare'); scene.burst(0, 2, -3, pal.a, 80, 2); scene.burst(0, 2, -3, '#ffe03d', 60, 1.6); }
        }
        if (dojo) chaser = 0;
        else if (!cam) { const target = (curCue.sp || 1) > 1.2 ? 0.12 : 0.3 + 0.35 * frac((beat % 48) / 48); chaser += (target - chaser) * dt * 0.8; }
        else chaser = Math.min(1, chaser + dt * 0.004);
        if (phase === 'finale') { if (!cam) { if (boss.hp0 == null) boss.hp0 = boss.hp; const t = clamp((beat - finaleBeat) / 16, 0, 1); boss.hp = Math.max(0.005, boss.hp0 * (1 - t)); boss.hit = Math.max(boss.hit, 0.5 + 0.5 * Math.abs(Math.sin(beat * Math.PI * 2))); } shake = Math.max(shake, 0.25 + (1 - boss.hp) * 0.4); }
        if (curCue.mid && mid.on && !mid.dead && !cam) { mid.hp = Math.max(0, 1 - (beat - curCue.b0) / (curCue.b1 - curCue.b0)); mid.hit = Math.max(mid.hit, Math.abs(Math.sin(beat * Math.PI * 2))); }
      }
    }
    if (phase === 'rescue') { rescueT += rdt; if (rescueT > (hasBoss ? 2.4 : 2.2)) { finish(); return; } }
    redFlash = Math.max(0, redFlash - rdt * 1.5); boss.hit = Math.max(0, boss.hit - rdt * 3); mid.hit = Math.max(0, mid.hit - rdt * 3);
    const spd = phase === 'safe' || phase === 'rescue' || phase === 'count' ? (phase === 'count' ? 1 : 0) : (curCue.sp || 1);
    // よこステップは ディフェンスに ぶつかる 手前で うごきはじめる（つぎのキューを 少し 先読み）
    let visLane = curLane; if (phase === 'run') { const nx = cues.find((c) => c.b0 > beat && c.b0 - beat < 0.7 && c.lane1 !== c.lane0); if (nx) visLane = nx.lane1; }
    scene.render({ camZ, dt, beat: Math.max(0, beat), mbeat, lane: visLane, cue: phase === 'count' ? null : curCue, speed: spd, cues, orbs: orbs.filter((o) => !o.got && !o.missed), boss, mid, shake, chaser: dojo ? 0 : (window.__chaser ?? chaserShow), pip: phase === 'run' || phase === 'finale' ? pipRect : null });
    shake *= 0.86;
    drawHUD(curCue, cues[cues.indexOf(curCue) + 1]);
    if (!loaded) { g.fillStyle = 'rgba(7,11,36,.82)'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = `900 ${Math.round(Math.min(W, H) * 0.06)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('じゅんびちゅう' + '.'.repeat(1 + Math.floor(waitT * 3) % 3), W / 2, H / 2); }
    if (recorder) { recorder.cctx.drawImage(gl, 0, 0, recorder.comp.width, recorder.comp.height); recorder.cctx.drawImage(hud, 0, 0, recorder.comp.width, recorder.comp.height); }
  }

  function finish() {
    if (video) { if (recorder) recorder.mr.stop(); window.__videoRecorded = true; dead = true; cancelAnimationFrame(raf); clearTimeout(safeTimer); return; }
    const par = orbs.length * 10; const hit = cuesAll ? cuesOk / cuesAll : 1; let stars;
    if (cam) stars = hit >= 0.85 && hearts === 3 ? 3 : hit >= 0.55 ? 2 : 1; else stars = score >= par * 1.12 ? 3 : score >= par * 0.85 ? 2 : 1;
    const res = { mode, score, stars, cam, hit, maxCombo, hearts, dribbles, orbsGot, speed: speedMax, counts, okCounts, failCounts, leftReps, rightReps, tiers: tiers.slice(0, 3), tracked: allF ? trackedF / allF : 0, tipIdx, hardest: hardest() };
    try { stop(); } catch (e) { console.error(e); } // かたづけで エラーが でても けっかは かならず だす
    try { onEnd(res); } catch (e) { console.error(e); overlay.innerHTML = `<div class="safe"><div class="safe-title">けっかを ひょうじ できませんでした</div><div class="safe-btns"><button id="errback"><span>🏠</span><b>もどる</b></button></div></div>`; const bt = document.getElementById('errback'); if (bt) bt.onclick = () => location.reload(); }
  }
  function stop() {
    dead = true; cancelAnimationFrame(raf); clearTimeout(safeTimer); window.removeEventListener('resize', resize); document.removeEventListener('keydown', onKey);
    overlay.innerHTML = ''; audio.close(); scene.dispose(); try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) { /* noop */ }
  }
  function setPause(v) {
    if (dead || phase === 'safe' || phase === 'rescue') return; paused = v; last = performance.now(); audio.pauseBgm(v);
    if (v) {
      try { audio.ctx && audio.ctx.suspend(); } catch (e) { /* noop */ }
      const sk = SKILLS[curCue.skill]; const tips = sk.tips.length ? `<div class="tipbox"><b>${sk.i} ${sk.n} の コツ</b>${sk.tips.map((t) => `<span>・${t}</span>`).join('')}</div>` : '';
      overlay.innerHTML = `<div class="safe"><div class="safe-title">⏸ ひとやすみ</div>${tips}<div class="safe-btns"><button id="resume"><span>▶️</span><b>つづける</b></button><button id="quit"><span>🏠</span><b>やめる</b></button></div></div>`;
      overlay.querySelector('#resume').addEventListener('click', () => setPause(false)); overlay.querySelector('#quit').addEventListener('click', () => { stop(); onQuit(); });
    } else { overlay.innerHTML = ''; try { audio.ctx && audio.ctx.resume(); } catch (e) { /* noop */ } }
  }
  function onKey(e) { if (!video && (e.key === 'Escape' || e.key === 'p')) setPause(!paused); }
  document.addEventListener('keydown', onKey);
  raf = requestAnimationFrame((t) => { last = t; frame(t); });
  return { stop, pause: () => setPause(true), debug: () => ({ bgm: audio.bgm ? { t: audio.bgm.el.currentTime, paused: audio.bgm.el.paused, failed: !!audio.bgm.failed, rs: audio.bgm.el.readyState, K: audio.bgm.K } : null, mbeat, bps, beat, phase, score, tier, endBeat, cues: cues.length, skill: curCue.skill, steps: cues.filter((c) => c.stepName).map((c) => [c.skill, c.stepIdx, c.b0]), bounces: audio.bn || 0, actx: audio.ctx && audio.ctx.state }) };
}
