// 合成音（音楽と効果音）と声
// ---------- 音 ----------
export class Audio {
  constructor(settings, base, opt = {}) {
    this.on = settings.sound; this.musicOn = settings.music; this.base = base; this.ctx = null; this.major = opt.major !== false; this.melody = MELODIES[(opt.riff || 0) % MELODIES.length]; this.style = settings.musicStyle || 'workout'; this.hookIdx = opt.riff || 0; this.bpm = opt.bpm || 104;
    try {
      this.ctx = opt.ctx || new (window.AudioContext || window.webkitAudioContext)();
      this.out = this.ctx.createDynamicsCompressor();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.92;
      this.out.connect(this.master).connect(this.ctx.destination);
      if (opt.record) { this.recDest = this.ctx.createMediaStreamDestination(); this.master.connect(this.recDest); }
      { const sr = this.ctx.sampleRate; const len = Math.floor(sr * 0.7); const ir = this.ctx.createBuffer(2, len, sr); for (let c = 0; c < 2; c++) { const d2 = ir.getChannelData(c); for (let i = 0; i < len; i++) d2[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); } this.reverb = this.ctx.createConvolver(); this.reverb.buffer = ir; const rg = this.ctx.createGain(); rg.gain.value = 0.5; this.reverb.connect(rg).connect(this.master); }
      this.music = this.ctx.createGain(); this.music.gain.value = 1; this.music.connect(this.out); this.sfxBus = this.out;
      const n = this.ctx.sampleRate; const buf = this.ctx.createBuffer(1, n, n); const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      // iPhone では 読み上げの声が出ると 合成音が「中断」されることがある。止まっていたら すぐ再開する
      const wake = () => { try { if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume(); } catch (e) { /* noop */ } };
      this.wake = wake; wake(); this.ctx.onstatechange = wake;
    } catch (e) { this.ctx = null; }
  }
  osc(type, f, dur, vol, { slide = 0, delay = 0, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus || this.out); o.start(t); o.stop(t + dur + 0.03);
  }
  noise(dur, vol, hp = 6000, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.bus || this.out); s.start(t); s.stop(t + dur + 0.02);
  }
  hz(semi) { return 440 * Math.pow(2, (this.base + semi - 69) / 12); }
  // 英語の声（あらかじめ作った音声）を 読みこむ
  async loadVoice() {
    if (!this.ctx || this.voice) return; this.voice = {};
    try { const clips = (await import('../models/voice_en.js')).default;
      await Promise.all(Object.entries(clips).map(async ([k, b64]) => { try { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); this.voice[k] = await new Promise((res, rej) => this.ctx.decodeAudioData(u.buffer, res, rej)); } catch (e) { /* noop */ } }));
    } catch (e) { /* noop */ }
  }
  say(text) {
    if (!this.ctx || !this.voice) return false; const b = this.voice[String(text).toLowerCase()]; if (!b) return false;
    try { if (this.lastSay) { try { this.lastSay.stop(); } catch (e) { /* noop */ } } const s = this.ctx.createBufferSource(); s.buffer = b; const g = this.ctx.createGain(); g.gain.value = 0.8; s.connect(g).connect(this.master); s.start(); this.lastSay = s;
      const t = this.ctx.currentTime; this.music.gain.cancelScheduledValues(t); this.music.gain.setTargetAtTime(0.6, t, 0.03); this.music.gain.setTargetAtTime(1, t + b.duration, 0.15); } catch (e) { return false; }
    return true;
  }
  // 16分音符ごとに呼ぶ
  // ---------- BGM（曲ファイル）：ゲームの 拍は 曲の 再生位置から きめる ----------
  loadBgm(song, rate = 1, half = 1) {
    if (!this.ctx || !this.musicOn || !song) return null;
    const el = new window.Audio(); el.preload = 'auto'; el.src = song.file; el.playbackRate = rate; el.defaultPlaybackRate = rate;
    el.preservesPitch = true; el.mozPreservesPitch = true; el.webkitPreservesPitch = true;
    try { const src = this.ctx.createMediaElementSource(el); const g = this.ctx.createGain(); g.gain.value = 0.85; src.connect(g).connect(this.out); this.bgmGain = g; } catch (e) { /* そのまま 鳴らす */ }
    this.bgm = { el, spb: 60 / song.bpm, t0: song.t0, half, rate, K: 0, started: false };
    try { el.load(); } catch (e) { /* noop */ }
    return this.bgm;
  }
  bgmReady() { const b = this.bgm; return !b || b.el.readyState >= 3 || b.failed; }
  playBgm(mbeatNow) { const b = this.bgm; if (!b) return; b.K = Math.round(mbeatNow); try { b.el.currentTime = b.t0; } catch (e) { /* noop */ } b.el.playbackRate = b.rate; const p = b.el.play(); if (p && p.catch) p.catch(() => { b.failed = true; }); b.started = true; }
  // いまの 曲の 拍（ゲームの 拍）。おわりに ちかづいたら 拍の きれめで 8拍目に もどして くりかえす
  bgmBeat() {
    const b = this.bgm; if (!b || !b.started || b.failed || b.el.paused) return null; const el = b.el; const unit = b.spb * b.half;
    const sb = (el.currentTime - b.t0) / unit; const end = el.duration ? Math.floor((el.duration - b.t0) / unit) - 2 : 1e9;
    if (sb >= end) { const back = 8; try { el.currentTime = b.t0 + back * unit; } catch (e) { /* noop */ } b.K += end - back; return b.K + back; }
    return b.K + sb;
  }
  pauseBgm(v) { const b = this.bgm; if (!b || !b.started) return; try { if (v) b.el.pause(); else { const p = b.el.play(); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* noop */ } }
  bgmVol(v) { if (this.bgmGain && this.ctx) this.bgmGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3); }
  tick(q, mode) {
    if (this.wake) this.wake();
    if (!this.musicOn || !this.ctx) return;
    if (this.bgm && this.bgm.started && !this.bgm.failed) return; // 曲が ながれている あいだは 合成の 音楽は ならさない
    this.bus = this.music; try { this.tickBody(q, mode); } finally { this.bus = null; }
  }
  tickBody(q, mode) { if (this.style === 'game') this.tickGame(q, mode); else this.tickWorkout(q, mode); }
  // アップテンポなダンス曲：しずかめのパート → もりあげ → サビ（ドロップ）を 8小節ごとに くりかえす
  tickWorkout(q, mode) {
    const maj = this.major; const barN = Math.floor(q / 16); const bar = barN % 4; const st = q % 16;
    const roots = maj ? [-3, 5, 0, 7] : [0, 8, 3, 10]; const third = [3, 4, 4, 4]; const root = roots[bar]; const th = third[bar];
    const pent = maj ? [0, 2, 4, 7, 9] : [0, 3, 5, 7, 10]; const pn = (d) => pent[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
    if (mode === 'safe') { if (st === 0) [0, th, 7].forEach((x) => this.osc('triangle', this.hz(root + x), 1.9, 0.07, { attack: 0.25 })); if (st % 4 === 0) this.osc('sine', 150, 0.14, 0.3, { slide: 0.3 }); if (st % 4 === 2) this.noise(0.04, 0.06, 7000); return; }
    const boss = mode === 'boss'; const intro = mode === 'intro'; const drop = boss || (!intro && Math.floor(barN / 8) % 2 === 1); const build = !drop && !intro && barN % 8 === 7;
    const kick = () => { this.osc('sine', 175, 0.2, 0.9, { slide: 0.24 }); this.osc('triangle', 380, 0.05, 0.5, { slide: 0.3 }); this.noise(0.012, 0.22, 3500); };
    // ドラム
    if (build) { if (st < 8 ? st % 4 === 0 : st < 12 ? st % 2 === 0 : true) { kick(); this.noise(0.05, 0.2 + st * 0.012, 1500); } }
    else { if (st % 4 === 0) kick(); if (st === 4 || st === 12) { this.noise(0.12, 0.45, 1300); this.noise(0.06, 0.3, 1000, 0.014); this.noise(0.09, 0.26, 1000, 0.03); } }
    if (st % 4 === 2) this.noise(0.11, drop ? 0.24 : 0.16, 6500); this.noise(0.018, st % 2 ? (drop ? 0.07 : 0.04) : 0.07, 9500);
    // ベース（うら拍で ポンプ）
    if (!build && (st % 4 === 2 || st % 4 === 3 || (drop && st % 4 === 1))) { const f = this.hz(root - 12 + (st % 8 === 7 ? 12 : 0)); this.osc('sawtooth', f, 0.13, drop ? 0.19 : 0.13); this.osc('square', f, 0.13, 0.1); this.osc('triangle', f / 2, 0.14, 0.36); }
    if (intro) { if (st % 4 === 0) this.osc('square', this.hz(root + 12), 0.08, 0.06); return; }
    // しずかめのパート：はねる アルペジオ
    if (!drop) { const ar = [0, 7, 12, th + 12, 7, 12, th + 12, 19]; if (st % 2 === 0) { const f = this.hz(root + 12 + ar[(st / 2) % 8]); this.osc('square', f, 0.11, 0.075); this.osc('triangle', f, 0.14, 0.08); this.osc('square', f, 0.08, 0.025, { delay: 0.21 }); } if (st === 0) [0, th, 7].forEach((x) => this.osc('sawtooth', this.hz(root + x), 1.6, 0.035, { attack: 0.3 })); }
    // サビ：ぶあつい シンセの きざみ ＋ 歌うような フック
    if (drop) {
      if ([0, 3, 6, 8, 11, 14].includes(st)) [0, th, 7, 12].forEach((x) => { const f = this.hz(root + 12 + x); this.osc('sawtooth', f, 0.17, 0.055); this.osc('sawtooth', f * 1.008, 0.17, 0.045); this.osc('sawtooth', f * 0.993, 0.17, 0.04); });
      const hook = HOOKS[(this.hookIdx || 0) % HOOKS.length]; const n = hook[(barN % 2) * 16 + st];
      if (n != null) { const f = this.hz(pn(n) + 12); const long = hook[(barN % 2) * 16 + st + 1] == null && hook[(barN % 2) * 16 + st + 2] == null ? 0.32 : 0.14; this.osc('square', f, long, 0.15); this.osc('sawtooth', f * 2.003, long, 0.05); this.osc('triangle', f * 2, long * 0.7, 0.07); this.osc('square', f, 0.1, 0.045, { delay: 0.2 }); }
      if (st === 15 && bar === 3) this.osc('sine', this.hz(root + 36), 0.12, 0.12, { slide: 0.5 });
    }
    // もりあげ：シュワーッ → ジャーン
    if (build && st === 0) { const t = this.ctx.currentTime; const dur = 16 * 60 / (this.bpm || 104) / 4; const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true; const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(8000, t + dur); const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15); src.connect(bp).connect(g).connect(this.music); src.start(t); src.stop(t + dur + 0.2); const o = this.ctx.createOscillator(); const og = this.ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(this.hz(12), t); o.frequency.exponentialRampToValueAtTime(this.hz(36), t + dur); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.09, t + dur); og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05); o.connect(og).connect(this.music); o.start(t); o.stop(t + dur + 0.1); }
    if (drop && barN % 8 === 0 && st === 0) { this.noise(1.0, 0.32, 5000); this.osc('sine', 120, 0.6, 0.6, { slide: 0.3 }); }
  }
  tickGame(q, mode) {
    // ゲームらしい チップチューン：かけあがるアルペジオ、はしるベース、おぼえやすいメロディ
    const maj = this.major; const barN = Math.floor(q / 16); const bar = barN % 4; const st = q % 16;
    const roots = maj ? [0, 7, 9, 5] : [0, 8, 10, 0]; const third = maj ? [4, 4, 3, 4] : [3, 4, 4, 3]; const root = roots[bar]; const th = third[bar];
    const scale = maj ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10]; const deg = (d) => scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
    if (mode === 'safe') { if (st % 4 === 0) this.osc('square', this.hz(root + [0, th, 7, 12][(st / 4) % 4] + 12), 0.5, 0.06, { attack: 0.02 }); if (st === 0) this.osc('triangle', this.hz(root - 12), 1.6, 0.25, { attack: 0.05 }); if (st % 4 === 2) this.noise(0.03, 0.05, 7000); return; }
    const boss = mode === 'boss';
    // ドラム
    if (st % 4 === 0 || (bar === 3 && st === 14) || (boss && st % 4 === 3)) { this.osc('sine', 165, 0.16, 0.7, { slide: 0.27 }); this.osc('triangle', 330, 0.05, 0.4, { slide: 0.3 }); }
    if (st === 4 || st === 12) { this.noise(0.14, 0.4, 1500); this.osc('triangle', 260, 0.08, 0.28, { slide: 0.55 }); }
    this.noise(st % 4 === 2 ? 0.06 : 0.02, st % 4 === 2 ? 0.16 : st % 2 ? 0.05 : 0.09, 8000);
    if (bar === 3 && st >= 12 && barN % 4 === 3) this.noise(0.05, 0.3, 1200);                    // フィル
    // ベース（オクターブで はしる）
    if (st % 2 === 0 || boss) { const f = this.hz(root - 12 + (st % 4 >= 2 ? 12 : 0) + (st === 14 ? 7 : 0)); this.osc('square', f, 0.1, 0.15); this.osc('triangle', f / 2, 0.12, 0.32); }
    // アルペジオ
    { const ar = [0, th, 7, 12, 7, th, 12, 7]; const f = this.hz(root + 12 + ar[st % 8] + (boss && st % 2 ? 12 : 0)); this.osc('square', f, 0.055, mode === 'intro' ? 0.075 : 0.05); }
    if (mode === 'intro') return;
    // メロディ（8分音符）。2回目は 3度下の ハモリつき
    if (st % 2 === 0) {
      const i = (Math.floor(q / 2)) % 32; const d = this.melody[i];
      if (d != null) { const f = this.hz(deg(d) + 12); const long = this.melody[(i + 1) % 32] == null ? 0.34 : 0.17; this.osc('square', f, long, 0.15); this.osc('triangle', f * 2, long * 0.8, 0.07); this.osc('square', f, 0.12, 0.045, { delay: 0.2 });
        if (Math.floor(barN / 4) % 2 === 1) this.osc('square', this.hz(deg(d - 2) + 12), long, 0.07); }
    }
    if (st === 0 && bar === 0 && barN % 8 === 0) [0, 4, 7, 12, 16].forEach((x, i) => this.osc('triangle', this.hz(x + 24), 0.08, 0.1, { delay: i * 0.045 }));   // きらきら
  }
  // バスケットボールが 体育館の ゆかに つく音（ドン＋ボールの ひびき＋ゆかの パン）
  bounce(power = 1) {
    this.bn = (this.bn || 0) + 1;
    if (!this.on || !this.ctx) return; const c = this.ctx; const t = c.currentTime; const out = c.createGain(); out.gain.value = 1.25 * power; out.connect(this.out); if (this.reverb) out.connect(this.reverb);
    const tone = (type, f0, f1, dur, vol) => { const o = c.createOscillator(); const g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02); };
    tone('sine', 190, 70, 0.16, 0.9);            // ゆかの ドン
    tone('sine', 520, 300, 0.11, 1.0);           // ボールの ひびき（スマホでも 聞こえる高さ）
    tone('triangle', 900, 520, 0.06, 0.5);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7; const g = c.createGain(); g.gain.setValueAtTime(1.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); s.connect(bp).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + 0.09);
    // その しゅんかんだけ 音楽を 下げる
    try { this.music.gain.cancelScheduledValues(t); this.music.gain.setValueAtTime(0.5, t); this.music.gain.linearRampToValueAtTime(1, t + 0.14); } catch (e) { /* noop */ }
  }
  sfx(name, n = 0) {
    if (!this.on || !this.ctx) return;
    if (name === 'orb') { const f = 880 * Math.pow(2, Math.min(n, 12) / 12); this.osc('sine', f, 0.07, 0.07); }
    else if (name === 'gate') { this.noise(0.25, 0.3, 900); this.osc('triangle', 300, 0.25, 0.3, { slide: 3 }); }
    else if (name === 'good') { this.osc('triangle', 784, 0.1, 0.32); this.osc('triangle', 1175, 0.16, 0.32, { delay: 0.08 }); }
    else if (name === 'bad') { this.osc('sawtooth', 160, 0.3, 0.14, { slide: 0.5 }); }
    else if (name === 'warn') { this.osc('square', 880, 0.08, 0.12); this.osc('square', 660, 0.08, 0.12, { delay: 0.1 }); }
    else if (name === 'count') this.osc('square', 880, 0.1, 0.16);
    else if (name === 'go') this.osc('square', 1320, 0.3, 0.18);
    else if (name === 'shot') { this.osc('sawtooth', 900, 0.18, 0.1, { slide: 0.25 }); }
    else if (name === 'hit') { this.noise(0.2, 0.2, 400); this.osc('square', 110, 0.2, 0.16, { slide: 0.5 }); }
    else if (name === 'boom') { this.noise(1.2, 0.4, 120); this.osc('sine', 90, 1.0, 0.5, { slide: 0.3 }); }
    else if (name === 'fanfare') [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => this.osc('triangle', 523 * Math.pow(2, s / 12), 0.22, 0.2, { delay: i * 0.12 }));
    else if (name === 'bounce') this.bounce(n || 1);
    else if (name === 'jump') { this.osc('sine', 300, 0.18, 0.14, { slide: 2 }); }
    else if (name === 'land') { this.noise(0.1, 0.2, 300); this.osc('sine', 120, 0.12, 0.3, { slide: 0.5 }); }
    else if (name === 'whoosh') { this.noise(0.4, 0.2, 1500); }
    else if (name === 'coin') { this.osc('square', 1320, 0.06, 0.1); this.osc('square', 1760, 0.12, 0.1, { delay: 0.06 }); }
    else if (name === 'caught') { this.osc('sawtooth', 220, 0.5, 0.2, { slide: 0.4 }); this.noise(0.4, 0.2, 300); }
  }
  close() { try { if (this.bgm) { this.bgm.el.pause(); this.bgm.el.removeAttribute('src'); this.bgm.el.load(); this.bgm = null; } } catch (e) { /* noop */ } try { this.ctx && this.ctx.close(); } catch (e) { /* noop */ } }
}

// リフ：ペンタトニックの音の番号（32ステップ＝2小節）。[呼びかけ, こたえ]
const R = (o) => { const a = new Array(32).fill(null); for (const k in o) a[k] = o[k]; return a; };
export const RIFFS = [
  [R({ 0: 5, 2: 4, 3: 5, 6: 3, 8: 4, 11: 3, 14: 2, 16: 5, 18: 4, 19: 5, 22: 7, 24: 6, 26: 5 }), R({ 0: 2, 3: 3, 6: 5, 8: 4, 10: 3, 12: 2, 16: 0, 19: 2, 22: 3, 24: 5, 27: 4, 30: 5 })],
  [R({ 0: 7, 3: 7, 4: 6, 6: 5, 10: 5, 11: 6, 14: 7, 16: 8, 19: 7, 22: 5, 24: 4, 28: 5 }), R({ 2: 5, 3: 4, 6: 5, 8: 2, 11: 3, 14: 4, 18: 5, 19: 4, 22: 5, 24: 7, 26: 8, 28: 7 })],
  [R({ 0: 5, 1: 5, 3: 4, 6: 5, 8: 7, 12: 5, 14: 4, 16: 3, 19: 4, 22: 5, 26: 3, 28: 2 }), R({ 0: 2, 2: 3, 4: 4, 6: 5, 8: 7, 11: 5, 14: 4, 16: 5, 20: 5, 22: 7, 24: 8, 28: 10 })],
];
// サビのフック（ペンタトニックの番号、2小節＝32ステップ）
export const HOOKS = [
  R({ 0: 7, 3: 7, 6: 5, 8: 7, 11: 8, 14: 7, 16: 5, 19: 5, 22: 4, 24: 5, 27: 7, 30: 5 }),
  R({ 0: 5, 2: 7, 4: 8, 6: 7, 10: 5, 12: 7, 16: 8, 18: 10, 20: 8, 22: 7, 26: 5, 28: 4, 30: 5 }),
  R({ 0: 10, 3: 8, 6: 7, 8: 8, 11: 7, 14: 5, 16: 7, 19: 5, 22: 4, 24: 5, 26: 7, 28: 8 }),
  R({ 0: 5, 3: 5, 4: 7, 6: 8, 10: 7, 11: 8, 14: 10, 16: 8, 19: 7, 22: 5, 24: 7, 28: 5 }),
  R({ 0: 8, 2: 7, 3: 8, 6: 10, 8: 8, 11: 7, 14: 5, 16: 7, 18: 8, 19: 7, 22: 5, 24: 4, 27: 5, 30: 7 }),
];
export const MELODIES = [
  [0, 2, 4, 2, 5, 4, 2, 0, 4, null, 4, 5, 7, 5, 4, 2, 0, 2, 4, 2, 5, 4, 7, 5, 4, 2, 0, 2, 4, null, null, null],
  [4, null, 4, 2, 0, null, 2, 4, 5, null, 4, 2, 4, null, null, null, 7, null, 7, 5, 4, null, 5, 7, 8, 7, 5, 4, 2, null, null, null],
  [0, 4, 7, 4, 2, 5, 9, 5, 4, 7, 11, 7, 9, 7, 5, 4, 0, 4, 7, 4, 2, 5, 9, 5, 7, 5, 4, 2, 0, null, 0, null],
  [7, null, 5, 4, null, 2, 4, null, 7, null, 5, 4, null, 2, 0, null, 4, 5, 7, null, 9, 7, 5, null, 4, 2, 4, null, 0, null, null, null],
  [0, null, 0, 2, 3, null, 2, 0, 4, null, 4, 5, 6, 5, 4, null, 0, null, 0, 2, 3, null, 5, 7, 6, 5, 4, 2, 0, null, null, null],
];
let enVoice = null; let jaVoice = null;
function pickVoices() { try { const vs = window.speechSynthesis.getVoices(); const pref = ['Samantha', 'Google US English', 'Ava', 'Allison', 'Karen', 'Daniel', 'Aaron']; enVoice = pref.map((n) => vs.find((v) => v.name.includes(n) && v.lang.startsWith('en'))).find(Boolean) || vs.find((v) => v.lang === 'en-US') || vs.find((v) => v.lang.startsWith('en')) || null; jaVoice = vs.find((v) => v.lang.startsWith('ja')) || null; } catch (e) { /* noop */ } }
try { if (window.speechSynthesis) { pickVoices(); window.speechSynthesis.onvoiceschanged = pickVoices; } } catch (e) { /* noop */ }
// mode: 'en' | 'ja' | false。en / ja の両方の文を渡す
export function speak(ja, mode, en) {
  if (!mode) return; const useEn = mode === 'en'; const text = useEn ? en : ja; if (!text) return;
  try { const ss = window.speechSynthesis; if (!ss) return; if (!enVoice && !jaVoice) pickVoices(); ss.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = useEn ? 'en-US' : 'ja-JP'; const v = useEn ? enVoice : jaVoice; if (v) u.voice = v; u.rate = useEn ? 1.05 : 1.2; u.pitch = useEn ? 1.15 : 1; u.volume = 1; ss.speak(u); } catch (e) { /* noop */ }
}
