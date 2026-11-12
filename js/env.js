// 背景の世界（道・家・木・空）を、絵の素材なしで その場で作る
import * as THREE from '../vendor/three.module.min.js';

const C = (c) => new THREE.Color(c);
const TAU = Math.PI * 2;

export const THEMES = {
  village: { sky: ['#2f8fff', '#8fd0ff', '#e8f6ff'], fog: '#dff1ff', sun: '#fff6c8', sunY: 46, moon: false, stars: false, cloud: '#ffffff', road: 'dirt', side: '#5fb84a', side2: '#4a9e3a', hill: ['#6cc46a', '#4aa85a'],
    walls: ['#fff4e0', '#ffe9c9', '#f6f0ff'], roofs: ['#d9432f', '#2f6fd9', '#e08a2a'], house: 'plaster', tree: ['#3fae4a', '#59c85a'], trunk: '#7a5230', hemi: ['#cfe8ff', '#7fae6a', 1.25], dir: ['#fff2d0', 2.0], bloom: [0.22, 0.92], lamp: false, glow: 0 },
  night: { sky: ['#0d0a2e', '#2c2270', '#6a58b8'], fog: '#3a3180', sun: '#f4f0ff', sunY: 40, moon: true, stars: true, cloud: '#8a7bd6', road: 'cobble', side: '#2a2a52', side2: '#23234a', hill: ['#221c55', '#191442'],
    walls: ['#8a5a3c', '#6f6a8a', '#9a7b5a'], roofs: ['#3a2f6a', '#5a2f3a', '#2f4a6a'], house: 'timber', tree: ['#2a2450', '#3a2f66'], trunk: '#241c3a', hemi: ['#8f86ff', '#2a2050', 1.0], dir: ['#b8b0ff', 1.3], bloom: [0.6, 0.72], lamp: true, glow: 1 },
  sunset: { sky: ['#3a2a7a', '#e0608a', '#ffc36a'], fog: '#f2a57a', sun: '#ffe08a', sunY: 12, moon: false, stars: false, cloud: '#ffb3a0', road: 'plank', side: '#2f7fb8', side2: '#2a6fa8', hill: ['#7a3f7a', '#5a2f6a'], water: true,
    walls: ['#ffe2c4', '#f7c9a0', '#fff0dc'], roofs: ['#b8402f', '#7a3f8a', '#2f7a8a'], house: 'plaster', tree: ['#2f8a5a', '#3fa06a'], trunk: '#6a4028', hemi: ['#ffd0b0', '#6a5a9a', 1.15], dir: ['#ffb070', 1.9], bloom: [0.4, 0.82], lamp: true, glow: 0.5 },
  snow: { sky: ['#5f9fe0', '#bfe0ff', '#f4fbff'], fog: '#eaf5ff', sun: '#ffffff', sunY: 34, moon: false, stars: false, cloud: '#ffffff', road: 'stone', side: '#f4f9ff', side2: '#e2eefc', hill: ['#dbe9f8', '#c4d8f0'],
    walls: ['#a8683c', '#8a5230', '#c08a5a'], roofs: ['#f8fcff', '#eef6ff', '#ffffff'], house: 'log', tree: ['#2f7a5a', '#3a8f6a'], trunk: '#5a3a24', pine: true, hemi: ['#e8f4ff', '#b8cce8', 1.3], dir: ['#fffaf0', 1.7], bloom: [0.25, 0.92], lamp: true, glow: 0.2 },
  castle: { sky: ['#1c0612', '#6a1420', '#ff7a2a'], fog: '#7a2418', sun: '#ffb04a', sunY: 8, moon: false, stars: true, cloud: '#a03a2a', road: 'stone', side: '#3a1410', side2: '#2c0e0c', hill: ['#3a1016', '#26080e'], lava: true,
    walls: ['#6a6470', '#59545f', '#7a7482'], roofs: ['#3a2a40', '#4a2030', '#2a2a44'], house: 'stone', tree: ['#3a1a1a', '#4a2020'], trunk: '#1c0c0c', hemi: ['#ff9a6a', '#3a1018', 1.0], dir: ['#ffb070', 1.5], bloom: [0.65, 0.7], lamp: true, glow: 1 },
  gym: { sky: ['#14203a', '#1c2c50', '#2a3c66'], fog: '#1c2c50', sun: '#ffffff', sunY: 60, moon: false, stars: false, cloud: null, road: 'court', side: '#c08a4a', side2: '#b47f40', hill: null,
    walls: [], roofs: [], house: null, tree: null, trunk: null, hemi: ['#ffffff', '#8a6a4a', 1.35], dir: ['#fff8e8', 1.6], bloom: [0.3, 0.88], lamp: false, glow: 0.3, indoor: true },
};

function tex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function speckle(g, w, h, n, cols, size = 2, a = 0.25) { for (let i = 0; i < n; i++) { g.globalAlpha = a * rnd(); g.fillStyle = cols[Math.floor(rnd() * cols.length)]; const s = size * (0.5 + rnd()); g.fillRect(rnd() * w, rnd() * h, s, s); } g.globalAlpha = 1; }

function roadTex(kind, laneFrac) {
  return tex(512, 512, (g, w, h) => {
    if (kind === 'dirt') { g.fillStyle = '#c99a5c'; g.fillRect(0, 0, w, h); speckle(g, w, h, 5000, ['#a67a42', '#e0b97a', '#8f6a3a'], 4, 0.5); g.strokeStyle = 'rgba(120,80,40,.35)'; g.lineWidth = 10; for (const x of [0.36, 0.64]) { g.beginPath(); for (let y = 0; y <= h; y += 16) g.lineTo(x * w + Math.sin(y * 0.05) * 6, y); g.stroke(); } }
    else if (kind === 'cobble') { g.fillStyle = '#3a3552'; g.fillRect(0, 0, w, h); const n = 12; const s = w / n; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const ox = (j % 2) * s * 0.5; const c = 90 + rnd() * 70; g.fillStyle = `rgb(${c * 0.95},${c * 0.82},${c * 1.1})`; g.beginPath(); g.roundRect(i * s + ox + 3 - (i === n - 1 && j % 2 ? w : 0) * 0, j * s + 3, s - 6, s - 6, 9); g.fill(); if (j % 2 && i === n - 1) { g.beginPath(); g.roundRect(-s * 0.5 + 3, j * s + 3, s - 6, s - 6, 9); g.fill(); } } speckle(g, w, h, 1500, ['#000', '#fff'], 2, 0.15); }
    else if (kind === 'plank') { for (let j = 0; j < 8; j++) { const c = 150 + rnd() * 40; g.fillStyle = `rgb(${c},${c * 0.68},${c * 0.42})`; g.fillRect(0, j * h / 8, w, h / 8 - 3); g.fillStyle = 'rgba(60,30,10,.5)'; g.fillRect(0, (j + 1) * h / 8 - 3, w, 3); for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(40,20,5,.6)'; g.beginPath(); g.arc((k + 0.5 + (j % 2) * 0.3) * w / 4, j * h / 8 + 10, 3, 0, TAU); g.fill(); } } speckle(g, w, h, 2500, ['#5a3414', '#e8b880'], 6, 0.2); }
    else if (kind === 'court') { g.fillStyle = '#d9a25c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(${120 + rnd() * 60},${70 + rnd() * 30},20,${0.12 + rnd() * 0.12})`; g.fillRect(i * w / 16, 0, w / 16 - 1, h); } g.strokeStyle = 'rgba(90,50,10,.35)'; g.lineWidth = 2; for (let j = 0; j < 4; j++) { g.beginPath(); g.moveTo(0, j * h / 4 + rnd() * 30); g.lineTo(w, j * h / 4 + rnd() * 30); g.stroke(); } }
    else { g.fillStyle = '#8a8792'; g.fillRect(0, 0, w, h); const n = 6; const s = w / n; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const c = 120 + rnd() * 50; g.fillStyle = `rgb(${c},${c * 0.97},${c * 1.03})`; g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); } speckle(g, w, h, 3000, ['#000', '#fff'], 3, 0.12); }
    // レーンの線（うすく）
    g.globalAlpha = kind === 'court' ? 0.9 : 0.5; g.strokeStyle = '#ffffff'; g.lineWidth = kind === 'court' ? 6 : 4; g.setLineDash(kind === 'court' ? [] : [40, 30]);
    for (const f of laneFrac) { g.beginPath(); g.moveTo(f * w, 0); g.lineTo(f * w, h); g.stroke(); } g.setLineDash([]); g.globalAlpha = 1;
  }, [1, 20]);
}
function wallTex(kind, base, lit) {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    if (kind === 'plaster') speckle(g, w, h, 900, ['#000', '#fff'], 3, 0.08);
    if (kind === 'timber') { speckle(g, w, h, 800, ['#000', '#fff'], 3, 0.1); g.strokeStyle = '#2a1a10'; g.lineWidth = 9; g.strokeRect(4, 4, w - 8, h - 8); g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h); g.lineTo(w / 2, h / 2); g.moveTo(w, h); g.lineTo(w / 2, h / 2); g.stroke(); }
    if (kind === 'log') { for (let j = 0; j < 10; j++) { g.fillStyle = `rgba(0,0,0,${0.12 + (j % 2) * 0.08})`; g.fillRect(0, j * h / 10, w, 4); g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, j * h / 10 + 6, w, 5); } }
    if (kind === 'stone') { for (let j = 0; j < 8; j++) for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; g.strokeRect(i * w / 5 + (j % 2) * w / 10 - w / 10, j * h / 8, w / 5, h / 8); } speckle(g, w, h, 1200, ['#000', '#fff'], 4, 0.1); }
    // まど と とびら
    const win = (x, y, ww, hh) => { g.fillStyle = '#3a2a1c'; g.fillRect(x - 5, y - 5, ww + 10, hh + 10); const gr = g.createLinearGradient(0, y, 0, y + hh); if (lit) { gr.addColorStop(0, '#fff3a0'); gr.addColorStop(1, '#ffb040'); } else { gr.addColorStop(0, '#9fd4ff'); gr.addColorStop(1, '#4a8fd0'); } g.fillStyle = gr; g.fillRect(x, y, ww, hh); g.strokeStyle = '#3a2a1c'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + hh); g.moveTo(x, y + hh / 2); g.lineTo(x + ww, y + hh / 2); g.stroke(); };
    win(36, 40, 60, 66); win(160, 40, 60, 66); win(160, 150, 60, 66);
    g.fillStyle = '#5a341c'; g.beginPath(); g.roundRect(40, 140, 56, 116, [26, 26, 0, 0]); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(84, 204, 5, 0, TAU); g.fill();
  });
}
function roofTex(base) { return tex(128, 128, (g, w, h) => { g.fillStyle = base; g.fillRect(0, 0, w, h); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.14})`; g.beginPath(); g.arc(i * 16 + 8 + (j % 2) * 8, j * 16, 8, 0, Math.PI); g.fill(); } }, [2, 2]); }

// 空のしゃしん（ワールドごとの バリュエーション）。見つからなければ いつもの グラデーションの まま
const SKY_PHOTOS = {
  village: ['village1.jpg', 'village2.jpg', 'village3.jpg', 'village4.jpg', 'village5.jpg', 'village6.jpg'],
  night:   ['night1.jpg', 'night2.jpg', 'night3.jpg', 'night4.jpg', 'night5.jpg'],
  sunset:  ['sunset1.jpg', 'sunset2.jpg', 'sunset3.jpg', 'sunset4.jpg'],
  snow:    ['snow1.jpg', 'snow2.jpg', 'snow3.jpg', 'snow4.jpg'],
  castle:  ['castle1.jpg', 'castle2.jpg', 'castle3.jpg', 'castle4.jpg', 'castle5.jpg', 'castle6.jpg'],
};
function pickSkyPhoto(themeName, stageSeed) {
  const pool = SKY_PHOTOS[themeName]; if (!pool || !pool.length) return null;
  const n = (stageSeed == null) ? Math.floor(Math.random() * pool.length) : (stageSeed % pool.length);
  return pool[n];
}
// ステージの おくに 見える けしき（コートの絵の 上はんぶん）。空の写真と べつべつに えらぶので、ステージごとに 組み合わせが かわる
const BG_COUNT = { village: 6, sunset: 4, night: 3, snow: 2, castle: 3, gym: 4 };
function addBackdrop(scene, th, themeName, n, D) {
  const cnt = BG_COUNT[themeName]; if (!cnt) return; const img = new Image();
  img.onload = () => {
    const cw = 768, ch = Math.round(768 * img.height / img.width); const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, cw, ch);
    // 下は きりの色に とかす
    let gr = cx.createLinearGradient(0, ch * 0.8, 0, ch); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, th.fog); cx.fillStyle = gr; cx.fillRect(0, ch * 0.8, cw, ch * 0.2);
    // 上と 左右は すきとおらせて、空の写真に つなげる
    cx.globalCompositeOperation = 'destination-out'; const fade = (x0, y0, x1, y1, rx, ry, rw, rh) => { const g2 = cx.createLinearGradient(x0, y0, x1, y1); g2.addColorStop(0, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = g2; cx.fillRect(rx, ry, rw, rh); };
    const tf = th.indoor ? 0.05 : 0.3; fade(0, 0, 0, ch * tf, 0, 0, cw, ch * tf); fade(0, 0, cw * 0.14, 0, 0, 0, cw * 0.14, ch); fade(cw, 0, cw * 0.86, 0, cw * 0.86, 0, cw * 0.14, ch);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, fog: false, depthWrite: false });
    const W = th.indoor ? 86 : 165, H = W * ch / cw; const g = new THREE.PlaneGeometry(W, H); const pl = new THREE.Mesh(g, m); pl.position.set(0, H / 2 - 6, th.indoor ? -112 : -124); pl.renderOrder = -5; scene.add(pl); D.push(t, m, g);
  };
  img.onerror = () => {}; img.src = `img/bg/${themeName}${(n % cnt) + 1}.jpg`;
}
// 写真を 空の背景に なじませる（下のほうを fog の色に とかし込む）
function applySkyPhoto(scene, th, file) {
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => {
    const cw = 512, ch = 512; const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch; const cx = cv.getContext('2d');
    const ir = img.width / img.height, cr = cw / ch; let dw, dh, dx, dy;
    if (ir > cr) { dh = ch; dw = ch * ir; dx = (cw - dw) / 2; dy = 0; } else { dw = cw; dh = cw / ir; dx = 0; dy = (ch - dh) / 2; }
    cx.drawImage(img, dx, dy, dw, dh);
    const gr = cx.createLinearGradient(0, ch * 0.58, 0, ch); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, th.fog);
    cx.fillStyle = gr; cx.fillRect(0, ch * 0.5, cw, ch * 0.5);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; scene.background = t;
  };
  img.onerror = () => {}; // 読めなければ いつもの グラデーションのまま
  img.src = `img/sky/${file}`;
}

export function buildEnv(scene, o) {
  seed = 7 + (o.themeName || 'x').length * 131;
  const th = THEMES[o.themeName] || THEMES.village; const HW = o.HW; const LW = o.LW; const D = []; const add = (x) => { D.push(x); return x; };
  // 空
  const sky = add(tex(16, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, th.sky[0]); gr.addColorStop(0.45, th.sky[1]); gr.addColorStop(0.62, th.sky[2]); gr.addColorStop(1, th.sky[2]); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
  scene.background = sky; scene.fog = new THREE.Fog(C(th.fog), th.indoor ? 40 : 34, th.indoor ? 120 : 130);
  if (!th.indoor) { const seedStr = String(o.stageId || o.themeName || ''); let hs = 0; for (let i = 0; i < seedStr.length; i++) hs = (hs * 131 + seedStr.charCodeAt(i)) >>> 0; const photo = pickSkyPhoto(o.themeName, hs); if (photo) applySkyPhoto(scene, th, photo); }
  { const ss = String(o.stageId || o.themeName || '') + 'bg'; let h2 = 7; for (let i = 0; i < ss.length; i++) h2 = (h2 * 31 + ss.charCodeAt(i)) >>> 0; addBackdrop(scene, th, o.themeName, h2 >>> 3, D); }
  scene.add(new THREE.HemisphereLight(C(th.hemi[0]), C(th.hemi[1]), th.hemi[2]));
  const dl = new THREE.DirectionalLight(C(th.dir[0]), th.dir[1]); dl.position.set(-4, 9, 6); scene.add(dl);
  const glowT = o.glow;
  const far = new THREE.Group(); scene.add(far);        // カメラといっしょに うごく 遠景
  const spr = (map, color, sx, sy, x, y, z, op = 1, addBlend = false) => { const m = add(new THREE.SpriteMaterial({ map, color: C(color), transparent: true, opacity: op, depthWrite: false, fog: false, blending: addBlend ? THREE.AdditiveBlending : THREE.NormalBlending })); const s = new THREE.Sprite(m); s.scale.set(sx, sy, 1); s.position.set(x, y, z); far.add(s); return s; };
  if (!th.indoor) {
    spr(glowT, th.sun, 120, 120, th.moon ? 34 : -30, th.sunY + 10, -180, 0.55, true);
    if (th.moon) { const mt = add(tex(256, 256, (g) => { const gr = g.createRadialGradient(100, 100, 10, 128, 128, 124); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#cfc8ff'); g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 122, 0, TAU); g.fill(); for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(120,110,190,${0.15 + rnd() * 0.2})`; g.beginPath(); g.arc(40 + rnd() * 176, 40 + rnd() * 176, 6 + rnd() * 20, 0, TAU); g.fill(); } })); spr(mt, '#ffffff', 46, 46, 34, th.sunY + 10, -178); }
    else spr(glowT, '#ffffff', 26, 26, -30, th.sunY + 10, -178, 1, true);
    if (th.stars) { const sg = add(new THREE.BufferGeometry()); const p = new Float32Array(260 * 3); for (let i = 0; i < 260; i++) { p[i * 3] = (rnd() - 0.5) * 420; p[i * 3 + 1] = 22 + rnd() * 110; p[i * 3 + 2] = -190; } sg.setAttribute('position', new THREE.BufferAttribute(p, 3)); far.add(new THREE.Points(sg, add(new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, fog: false })))); }
    if (th.cloud) { const ct = add(tex(256, 128, (g) => { for (let i = 0; i < 9; i++) { const x = 50 + rnd() * 156, y = 60 + rnd() * 30, r = 22 + rnd() * 26; const gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } })); for (let i = 0; i < 9; i++) spr(ct, th.cloud, 60 + rnd() * 50, 22 + rnd() * 14, (rnd() - 0.5) * 300, 30 + rnd() * 50, -170 + rnd() * 20, 0.85).userData.drift = 0.3 + rnd(); }
    if (th.hill) th.hill.forEach((col, k) => { const ht = add(tex(1024, 128, (g, w, h) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.55 - Math.sin(x * 0.012 + k * 2) * 26 - Math.sin(x * 0.031 + k) * 12 - (k ? 0 : 18)); g.lineTo(w, h); g.fill(); if (o.themeName === 'castle' || o.themeName === 'night') { g.fillStyle = col; const cx = w * (0.5 + (k ? 0.18 : -0.02)); g.fillRect(cx - 40, 14, 80, 80); for (let i = 0; i < 5; i++) g.fillRect(cx - 40 + i * 18, 4, 10, 12); g.fillRect(cx - 62, 30, 22, 70); g.fillRect(cx + 40, 30, 22, 70); g.fillStyle = '#ffc94a'; for (let i = 0; i < 4; i++) g.fillRect(cx - 24 + i * 14, 40 + (i % 2) * 18, 6, 10); } })); const m = add(new THREE.MeshBasicMaterial({ map: ht, transparent: true, fog: false, depthWrite: false })); const pl = new THREE.Mesh(add(new THREE.PlaneGeometry(520, 50)), m); pl.position.set(0, 14 - k * 5, -160 + k * 12); pl.renderOrder = -1; far.add(pl); });
  }
  // 道と わき
  const road = add(roadTex(th.road, [0.5 - (LW * 0.5) / (HW * 2), 0.5 + (LW * 0.5) / (HW * 2)]));
  const roadM = new THREE.Mesh(add(new THREE.PlaneGeometry(HW * 2, 200)), add(new THREE.MeshLambertMaterial({ map: road }))); roadM.rotation.x = -Math.PI / 2; roadM.position.z = -88; scene.add(roadM);
  const sideT = add(tex(256, 256, (g, w, h) => { g.fillStyle = th.side; g.fillRect(0, 0, w, h); speckle(g, w, h, 2600, [th.side2, '#ffffff', '#000000'], th.water ? 14 : 4, th.water ? 0.22 : 0.14); if (th.lava) { for (let i = 0; i < 12; i++) { g.strokeStyle = `rgba(255,${120 + rnd() * 80},20,.9)`; g.lineWidth = 3 + rnd() * 4; g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 80; y += (rnd() - 0.5) * 80; g.lineTo(x, y); } g.stroke(); } } }, [26, 13]));
  const sideM = new THREE.Mesh(add(new THREE.PlaneGeometry(400, 200)), add(th.lava || th.water ? new THREE.MeshBasicMaterial({ map: sideT }) : new THREE.MeshLambertMaterial({ map: sideT }))); sideM.rotation.x = -Math.PI / 2; sideM.position.set(0, th.water ? -1.2 : -0.04, -88); scene.add(sideM);
  const curbM = add(new THREE.MeshLambertMaterial({ color: C(th.road === 'dirt' ? '#8a6a3c' : th.road === 'plank' ? '#6a4020' : '#55525f') })); const boxG = add(new THREE.BoxGeometry(1, 1, 1));
  for (const s of [-1, 1]) { const c = new THREE.Mesh(boxG, curbM); c.scale.set(0.3, th.water ? 1.3 : 0.16, 200); c.position.set(s * (HW + 0.15), th.water ? -0.55 : 0.06, -88); scene.add(c); if (th.water) { const r = new THREE.Mesh(boxG, curbM); r.scale.set(0.12, 0.12, 200); r.position.set(s * (HW + 0.15), 1.0, -88); scene.add(r); } }
  // くりかえし置くもの（家・木・あかり など）
  const items = []; const SPAN = 198;
  const put = (obj, x, z0) => { obj.userData = { x, z0 }; obj.position.x = x; scene.add(obj); items.push(obj); };
  const mats = {}; const lam = (k, mk) => mats[k] || (mats[k] = add(mk()));
  const lam2 = (k, col, flat) => lam(k, () => (flat ? new THREE.MeshBasicMaterial({ color: C(col), side: THREE.DoubleSide }) : new THREE.MeshLambertMaterial({ color: C(col) })));
  const coneG = add(new THREE.ConeGeometry(1, 1, 4)); const cylG = add(new THREE.CylinderGeometry(1, 1, 1, 8)); const icoG = add(new THREE.IcosahedronGeometry(1, 1)); const pineG = add(new THREE.ConeGeometry(1, 1, 7));
  const mesh = (geo, mat, sx, sy, sz, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.y = ry; return m; };
  if (th.house) {
    const wallsT = th.walls.map((c) => add(wallTex(th.house, c, th.glow > 0.4))); const roofsT = th.roofs.map((c) => add(roofTex(c)));
    for (let i = 0; i < 22; i++) {
      const s = i % 2 ? 1 : -1; const gp = new THREE.Group(); const w = 5 + rnd() * 3, h = 4 + rnd() * 3.5, d = 5 + rnd() * 3; const vi = Math.floor(rnd() * wallsT.length);
      const wm = lam('w' + vi, () => (th.glow > 0.4 ? new THREE.MeshBasicMaterial({ map: wallsT[vi], color: 0xb8b0d8 }) : new THREE.MeshLambertMaterial({ map: wallsT[vi] })));
      gp.add(mesh(boxG, wm, w, h, d, 0, h / 2, 0));
      const ri = Math.floor(rnd() * roofsT.length); const rm = lam('r' + ri, () => new THREE.MeshLambertMaterial({ map: roofsT[ri], flatShading: true }));
      if (th.house === 'stone') { gp.add(mesh(boxG, wm, w + 0.5, 0.6, d + 0.5, 0, h + 0.3, 0)); for (let k = 0; k < 4; k++) gp.add(mesh(boxG, wm, 0.8, 0.8, 0.8, (k % 2 ? 1 : -1) * (w / 2 - 0.2), h + 1, (k < 2 ? 1 : -1) * (d / 2 - 0.2))); if (rnd() < 0.5) { gp.add(mesh(cylG, wm, 1.6, h * 1.6, 1.6, -s * w * 0.3, h * 0.8, 0)); gp.add(mesh(pineG, rm, 2.1, 3, 2.1, -s * w * 0.3, h * 1.6 + 1.5, 0)); } }
      else { gp.add(mesh(coneG, rm, w * 0.82, 2.4 + rnd() * 1.4, d * 0.82, 0, h + 1.3, 0, Math.PI / 4)); gp.add(mesh(boxG, lam('ch', () => new THREE.MeshLambertMaterial({ color: 0x7a4a3a })), 0.6, 1.6, 0.6, w * 0.22, h + 1.6, 0)); }
      gp.rotation.y = s * -0.12 + (rnd() - 0.5) * 0.2; put(gp, s * (HW + 5 + rnd() * 4 + w / 2), i * (SPAN / 22) + rnd() * 3);
    }
  }
  if (th.tree) {
    const leaf = th.tree.map((c, i) => lam('l' + i, () => new THREE.MeshLambertMaterial({ color: C(c), flatShading: true }))); const trunk = lam('tr', () => new THREE.MeshLambertMaterial({ color: C(th.trunk) })); const snow = lam('sn', () => new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
    for (let i = 0; i < 26; i++) { const s = i % 2 ? 1 : -1; const gp = new THREE.Group(); const sc = 0.7 + rnd() * 0.6; gp.add(mesh(cylG, trunk, 0.22 * sc, 1.6 * sc, 0.22 * sc, 0, 0.8 * sc, 0));
      if (th.pine) { for (let k = 0; k < 3; k++) { gp.add(mesh(pineG, leaf[k % 2], (1.5 - k * 0.38) * sc, 1.6 * sc, (1.5 - k * 0.38) * sc, 0, (1.9 + k * 1.0) * sc, 0)); gp.add(mesh(pineG, snow, (1.1 - k * 0.3) * sc, 0.5 * sc, (1.1 - k * 0.3) * sc, 0, (2.55 + k * 1.0) * sc, 0)); } }
      else if (o.themeName === 'night' || o.themeName === 'castle') { for (let k = 0; k < 4; k++) { const b = mesh(cylG, trunk, 0.07 * sc, 1.3 * sc, 0.07 * sc, Math.cos(k * 1.7) * 0.4 * sc, 2.0 * sc, Math.sin(k * 1.7) * 0.4 * sc); b.rotation.z = Math.cos(k * 1.7) * -0.7; b.rotation.x = Math.sin(k * 1.7) * 0.7; gp.add(b); } }
      else { gp.add(mesh(icoG, leaf[0], 1.3 * sc, 1.2 * sc, 1.3 * sc, 0, 2.3 * sc, 0)); gp.add(mesh(icoG, leaf[1], 0.9 * sc, 0.9 * sc, 0.9 * sc, 0.5 * sc, 3.1 * sc, 0.2)); gp.add(mesh(icoG, leaf[1], 0.8 * sc, 0.8 * sc, 0.8 * sc, -0.6 * sc, 2.9 * sc, -0.2)); }
      put(gp, s * (HW + 2.2 + rnd() * 2.6), i * (SPAN / 26) + 4 + rnd() * 3); }
  }
  if (th.lamp) { const pole = lam('po', () => new THREE.MeshLambertMaterial({ color: 0x2a2a3a })); const bulb = lam('bu', () => new THREE.MeshBasicMaterial({ color: C(th.lava ? '#ff8a2a' : '#ffe9a0') }));
    for (let i = 0; i < 12; i++) { const s = i % 2 ? 1 : -1; const gp = new THREE.Group(); gp.add(mesh(cylG, pole, 0.07, 3.2, 0.07, 0, 1.6, 0)); gp.add(mesh(icoG, bulb, 0.24, 0.28, 0.24, 0, 3.3, 0)); const sp = new THREE.Sprite(add(new THREE.SpriteMaterial({ map: glowT, color: C(th.lava ? '#ff7a1a' : '#ffd97a'), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }))); sp.scale.set(3, 3, 1); sp.position.y = 3.3; gp.add(sp); put(gp, s * (HW + 0.6), i * (SPAN / 12) + 2); } }
  { const wood = lam('cr', () => new THREE.MeshLambertMaterial({ color: C(th.indoor ? '#3a5fc8' : '#b07a3a') })); for (let i = 0; i < (th.indoor ? 0 : 10); i++) { const s = i % 2 ? 1 : -1; const gp = new THREE.Group(); gp.add(mesh(boxG, wood, 0.9, 0.9, 0.9, 0, 0.45, 0, rnd())); if (rnd() < 0.5) gp.add(mesh(cylG, wood, 0.4, 1, 0.4, 0.9, 0.5, 0.3)); put(gp, s * (HW + 0.9 + rnd()), i * (SPAN / 10) + 9); } }
  // ランドマーク：ワールドごとに めだつ たてものを 2つ（ワールドらしさ・バリュエーションを ふやす）
  if (!th.indoor) {
    const lm = (geo, mat, sx, sy, sz, x, y, z, ry = 0) => mesh(geo, mat, sx, sy, sz, x, y, z, ry);
    const landmark = (build, side, z) => { const gp = new THREE.Group(); build(gp); put(gp, side * (HW + 7), z); };
    if (o.themeName === 'village') {
      const hub = lam2('mlhub', '#6a4020'); const blade = lam2('mlbl', '#e8e0c8');
      const build = (gp) => { gp.add(lm(cylG, hub, 1.1, 3.2, 1.1, 0, 1.6, 0)); const wheel = new THREE.Group();
        for (let k = 0; k < 6; k++) { const bl = new THREE.Mesh(boxG, blade); bl.scale.set(0.18, 2.6, 0.5); bl.position.set(Math.cos(k * Math.PI / 3) * 1.3, Math.sin(k * Math.PI / 3) * 1.3, 0); bl.rotation.z = k * Math.PI / 3; wheel.add(bl); }
        wheel.position.set(0, 3.4, 1.0); gp.add(wheel); gp.userData.spin = wheel; };
      landmark(build, -1, 36); landmark(build, 1, 132);
    } else if (o.themeName === 'night') {
      const stone = lam2('ctw', '#4a4460'); const faceT = add(tex(128, 128, (g) => { g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(64, 64, 58, 0, TAU); g.fill(); g.strokeStyle = '#2a2450'; g.lineWidth = 6; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 20); g.moveTo(64, 64); g.lineTo(96, 64); g.stroke(); }));
      const faceM = add(new THREE.SpriteMaterial({ map: faceT, transparent: true, fog: false }));
      const build = (gp) => { gp.add(lm(boxG, stone, 1.6, 7, 1.6, 0, 3.5, 0)); const face = new THREE.Sprite(faceM); face.scale.set(1.3, 1.3, 1); face.position.set(0, 6.6, 0.9); gp.add(face); };
      landmark(build, -1, 40); landmark(build, 1, 150);
    } else if (o.themeName === 'sunset') {
      const pier = lam2('pr', '#2f4a6a'); const flag = lam2('fl', '#ffb13d', true);
      const build = (gp) => { gp.add(lm(cylG, pier, 0.7, 6, 0.7, 0, 3, 0)); gp.add(lm(boxG, flag, 1.4, 0.9, 0.05, 0.8, 5.6, 0)); };
      landmark(build, -1, 44); landmark(build, 1, 138);
    } else if (o.themeName === 'snow') {
      const snow = lam2('kam', '#f4fbff');
      const build = (gp) => { gp.add(lm(icoG, snow, 2.2, 1.6, 2.2, 0, 1.0, 0)); const sp = new THREE.Sprite(add(new THREE.SpriteMaterial({ map: glowT, color: C('#ffe9a0'), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }))); sp.scale.set(1.6, 1.6, 1); sp.position.set(0, 1.0, 1.4); gp.add(sp); };
      landmark(build, -1, 50); landmark(build, 1, 160);
    } else if (o.themeName === 'castle') {
      const stone = lam2('bst', '#4a3030');
      const build = (gp) => { gp.add(lm(cylG, stone, 1.3, 5, 1.3, 0, 2.5, 0)); const sp = new THREE.Sprite(add(new THREE.SpriteMaterial({ map: glowT, color: C('#ff7a1a'), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }))); sp.scale.set(2.4, 2.4, 1); sp.position.set(0, 5.4, 0); gp.add(sp); };
      landmark(build, -1, 30); landmark(build, 1, 120);
    }
  }
  if (th.indoor) { // 体育館
    const wt = add(tex(256, 256, (g, w, h) => { g.fillStyle = '#e9e2d0'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f5fc8'; g.fillRect(0, h * 0.62, w, h * 0.38); g.fillStyle = 'rgba(0,0,0,.15)'; for (let i = 0; i < 4; i++) g.fillRect(i * 64, h * 0.62, 3, h); g.fillStyle = '#bfb8a6'; g.fillRect(0, h * 0.2, w, 6); }, [16, 1]));
    const wm = add(new THREE.MeshLambertMaterial({ map: wt })); const wg = add(new THREE.PlaneGeometry(200, 9));
    for (const s of [-1, 1]) { const w = new THREE.Mesh(wg, wm); w.rotation.y = s * -Math.PI / 2; w.position.set(s * (HW + 5), 4.5, -88); scene.add(w); }
    const lightM = add(new THREE.MeshBasicMaterial({ color: 0xffffff })); for (let i = 0; i < 10; i++) put(mesh(boxG, lightM, 3, 0.1, 0.6, 0, 9, 0), 0, i * (SPAN / 10));
    const hoop = new THREE.Group(); hoop.add(mesh(boxG, add(new THREE.MeshBasicMaterial({ color: 0xffffff })), 3.2, 2.1, 0.1, 0, 5.6, 0)); hoop.add(mesh(boxG, add(new THREE.MeshBasicMaterial({ color: 0xff4d2a })), 1.1, 0.9, 0.12, 0, 5.2, 0.02)); const rim = new THREE.Mesh(add(new THREE.TorusGeometry(0.45, 0.04, 8, 24)), add(new THREE.MeshBasicMaterial({ color: 0xff6a1a }))); rim.rotation.x = Math.PI / 2; rim.position.set(0, 4.75, 0.55); hoop.add(rim); hoop.position.set(0, 0, -70); scene.add(hoop);
  }
  function update(camZ, dt, camX) {
    road.offset.y = (camZ / 10) % 1; sideT.offset.y = (camZ / 10) % 1;
    for (const it of items) { let z = (it.userData.z0 - camZ) % SPAN; if (z < -12) z += SPAN; it.position.z = -z + 6; if (it.userData.spin) it.userData.spin.rotation.z += dt * 0.6; }
    far.position.x = camX * 0.9; far.children.forEach((c) => { if (c.userData.drift) { c.position.x += c.userData.drift * dt; if (c.position.x > 170) c.position.x = -170; } });
  }
  return { update, bloom: th.bloom, theme: th, dispose: () => D.forEach((d) => { try { d.dispose(); } catch (e) { /* noop */ } }) };
}
