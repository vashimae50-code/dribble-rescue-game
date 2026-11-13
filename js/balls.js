// ボールの もよう：3Dの ボールに はる 画像（よこ＝けいど、たて＝いど）と、ショップの アイコンを おなじ 絵から つくる
// ・どの ボールにも バスケットボールの みぞ（せんどう・たての 線・よこの カーブ2本）と つぶつぶの かんじを つける
// ・メーカーの ロゴや 実在の チームの もようは つかわない

const TAU = Math.PI * 2;
const W = 512, H = 256;

function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// もようを かく（2D）。g は W×H。
function drawBase(g, b) {
  const R = rnd(b.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
  const lin = (stops, vertical = true) => { const gr = vertical ? g.createLinearGradient(0, 0, 0, H) : g.createLinearGradient(0, 0, W, 0); stops.forEach((c, i) => gr.addColorStop(i / Math.max(1, stops.length - 1), c)); return gr; };
  const p = b.pat || 'solid';
  if (p === 'solid') { g.fillStyle = lin([b.c1, b.c2]); g.fillRect(0, 0, W, H); }
  else if (p === 'panels' || p === 'half') { g.fillStyle = b.cols[0]; g.fillRect(0, 0, W, H); } // いろわけは みぞに そって addSeams で ぬる
  else if (p === 'stripes') { const cs = b.cols; const n = cs.length; for (let i = 0; i < n; i++) { g.fillStyle = cs[i]; g.fillRect(0, (i * H) / n, W, H / n + 1); } }
  else if (p === 'swirl') { // タイダイ
    const cs = b.cols.map(rgb); const img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = x / W * TAU, v = y / H * Math.PI; const t = (Math.sin(u * 3 + Math.sin(v * 4) * 2.2 + v * 5) + 1) / 2 * (cs.length - 1); const i0 = Math.floor(t), f = t - i0; const a = cs[i0], c = cs[Math.min(cs.length - 1, i0 + 1)]; const k = (y * W + x) * 4; img.data[k] = a[0] + (c[0] - a[0]) * f; img.data[k + 1] = a[1] + (c[1] - a[1]) * f; img.data[k + 2] = a[2] + (c[2] - a[2]) * f; img.data[k + 3] = 255; }
    g.putImageData(img, 0, 0);
  } else if (p === 'camo') { g.fillStyle = b.cols[0]; g.fillRect(0, 0, W, H); for (let k = 1; k < b.cols.length; k++) { g.fillStyle = b.cols[k]; for (let i = 0; i < 26; i++) { const x = R() * W, y = R() * H, r = 14 + R() * 26; g.beginPath(); for (let a = 0; a < TAU; a += 0.5) { const rr = r * (0.6 + R() * 0.7); g.lineTo(x + Math.cos(a) * rr * 1.5, y + Math.sin(a) * rr); } g.fill(); } } }
  else if (p === 'galaxy') { g.fillStyle = lin(b.cols); g.fillRect(0, 0, W, H); for (let i = 0; i < 9; i++) { const x = R() * W, y = R() * H, r = 30 + R() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, i % 2 ? 'rgba(255,90,220,.45)' : 'rgba(90,180,255,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } g.fillStyle = '#fff'; for (let i = 0; i < 260; i++) { const s = R() < 0.92 ? 1 : 2.4; g.globalAlpha = 0.5 + R() * 0.5; g.fillRect(R() * W, R() * H, s, s); } g.globalAlpha = 1; }
  else if (p === 'stars') { g.fillStyle = lin([b.c1, b.c2]); g.fillRect(0, 0, W, H); g.fillStyle = b.dot || '#fff'; for (let i = 0; i < 34; i++) { const x = R() * W, y = 20 + R() * (H - 40), r = 6 + R() * 7; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr * 1.4, y + Math.sin(a) * rr); } g.fill(); } }
  else if (p === 'dots') { g.fillStyle = lin([b.c1, b.c2]); g.fillRect(0, 0, W, H); g.fillStyle = b.dot || '#fff'; for (let y = 12; y < H; y += 28) for (let x = (y / 28) % 2 ? 14 : 0; x < W; x += 28) { g.beginPath(); g.ellipse(x, y, 8, 6, 0, 0, TAU); g.fill(); } }
  else if (p === 'flame') { g.fillStyle = lin([b.c1, b.c2]); g.fillRect(0, 0, W, H); for (const [col, hh] of [['#ff3d1a', 0.62], ['#ff9a1a', 0.5], ['#ffe23d', 0.36]]) { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 16) g.lineTo(x, H - H * hh * (0.55 + 0.45 * Math.abs(Math.sin(x * 0.07 + hh * 9)) + R() * 0.12)); g.lineTo(W, H); g.fill(); } }
  else if (p === 'neon') { g.fillStyle = lin(['#14141c', '#050508']); g.fillRect(0, 0, W, H); }
  else if (p === 'metal') { g.fillStyle = lin(b.cols); g.fillRect(0, 0, W, H); for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.04 + R() * 0.08})`; g.fillRect(0, R() * H, W, 1 + R() * 3); } }
  else if (p === 'prism') { g.fillStyle = lin(b.cols, false); g.fillRect(0, 0, W, H); g.fillStyle = lin(['rgba(255,255,255,.35)', 'rgba(255,255,255,0)', 'rgba(255,255,255,.25)']); g.fillRect(0, 0, W, H); }
}

// みぞと つぶつぶ（1ピクセルずつ。たまの 上の 3D ほうこうで きめる）
function addSeams(g, b) {
  const img = g.getImageData(0, 0, W, H); const d = img.data; const sc = rgb(b.seam || '#1a1410'); const glow = b.pat === 'neon' ? b.cols.map(rgb) : null;
  const T = 0.034, CUR = 0.98; // みぞの ふとさ（ラジアン）、よこカーブの 大きさ
  const pc = (b.pat === 'panels' || b.pat === 'half') ? b.cols.map(rgb) : null;
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - (y + 0.5) / H) * Math.PI; const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * TAU; const px = cl * Math.cos(lon), py = sl, pz = cl * Math.sin(lon);
      const eq = Math.abs(Math.asin(py));                 // せきどう
      const mer = Math.abs(Math.asin(px));                // たての 大円
      const cur = Math.abs(Math.acos(Math.min(1, Math.abs(pz))) - CUR); // よこの カーブ（z じくの まわり）
      const m = Math.min(eq, mer, cur); const k = (y * W + x) * 4;
      if (pc) { // パネルごとに いろわけ（みぞで くぎる）
        const cap = Math.acos(Math.min(1, Math.abs(pz))) < CUR ? 1 : 0;
        const i = b.pat === 'half' ? (px > 0 ? 1 : 0) : pc.length === 2 ? ((py > 0) ^ (px > 0) ^ cap) : ((py > 0 ? 1 : 0) + cap * 2 + (px > 0 ? 1 : 0)) % pc.length;
        const c = pc[i]; const sh = 0.92 + 0.16 * (py * 0.5 + 0.5); d[k] = c[0] * sh; d[k + 1] = c[1] * sh; d[k + 2] = c[2] * sh; }
      // つぶつぶ
      const n = ((x * 73856093) ^ (y * 19349663)) & 255; const pb = (n / 255 - 0.5) * 18;
      d[k] = Math.max(0, Math.min(255, d[k] + pb)); d[k + 1] = Math.max(0, Math.min(255, d[k + 1] + pb)); d[k + 2] = Math.max(0, Math.min(255, d[k + 2] + pb));
      if (m < T) { const f = 1 - Math.max(0, (m - T * 0.55) / (T * 0.45));
        const c = glow ? glow[(eq === m ? 0 : mer === m ? 1 : 2) % glow.length] : sc;
        d[k] += (c[0] - d[k]) * f; d[k + 1] += (c[1] - d[k + 1]) * f; d[k + 2] += (c[2] - d[k + 2]) * f; }
      else if (glow && m < T * 3) { const f = (1 - (m - T) / (T * 2)) * 0.35; const c = glow[(eq === m ? 0 : mer === m ? 1 : 2) % glow.length]; d[k] += (c[0] - d[k]) * f; d[k + 1] += (c[1] - d[k + 1]) * f; d[k + 2] += (c[2] - d[k + 2]) * f; }
    }
  }
  g.putImageData(img, 0, 0);
}

const cache = new Map();
export function ballCanvas(b) {
  if (cache.has(b.id)) return cache.get(b.id);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
  drawBase(g, b); addSeams(g, b); cache.set(b.id, cv); return cv;
}

// ショップの アイコン：画像を たまに まいて、光と かげを つける
const icons = new Map();
export function ballIcon(b, S = 112) {
  if (icons.has(b.id)) return icons.get(b.id);
  const src = ballCanvas(b).getContext('2d').getImageData(0, 0, W, H).data;
  const cv = document.createElement('canvas'); cv.width = S; cv.height = S; const g = cv.getContext('2d'); const img = g.createImageData(S, S); const d = img.data;
  const tilt = 0.38, cs = Math.cos(tilt), sn = Math.sin(tilt), spin = 0.5;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = (x + 0.5) / S * 2 - 1, ny = 1 - (y + 0.5) / S * 2; const r2 = nx * nx + ny * ny; if (r2 > 1) continue; const nz = Math.sqrt(1 - r2);
    const qy = ny * cs - nz * sn, qz = ny * sn + nz * cs;  // すこし 上から 見る
    const lat = Math.asin(Math.max(-1, Math.min(1, qy))); let lon = Math.atan2(qz, nx) + spin; lon = ((lon % TAU) + TAU) % TAU;
    const sx = Math.min(W - 1, Math.floor(lon / TAU * W)), sy = Math.min(H - 1, Math.floor((0.5 - lat / Math.PI) * H)); const s = (sy * W + sx) * 4;
    const lam = Math.max(0, nx * -0.45 + ny * 0.55 + nz * 0.7); const sh = 0.38 + 0.72 * lam; const spec = Math.pow(Math.max(0, nx * -0.35 + ny * 0.45 + nz * 0.82), 28) * 120;
    const edge = Math.min(1, (1 - Math.sqrt(r2)) * S * 0.5); const k = (y * S + x) * 4;
    d[k] = Math.min(255, src[s] * sh + spec); d[k + 1] = Math.min(255, src[s + 1] * sh + spec); d[k + 2] = Math.min(255, src[s + 2] * sh + spec); d[k + 3] = 255 * edge;
  }
  g.putImageData(img, 0, 0); const url = cv.toDataURL(); icons.set(b.id, url); return url;
}
