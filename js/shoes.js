// バッシュの よこ顔を データ（data.js の SHOES）から SVG で かく。くつは 左むき（つまさきが 左）。
// ロゴなしの オリジナル。サイドの マークは ドリバトの ボール。
const OUT = '#1b1b28';
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const rnd = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function blob(r, cx, cy, rad, n = 9) {
  const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const k = rad * (0.6 + r() * 0.6); pts.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k]); }
  let d = ''; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; d += (i ? '' : `M ${m[0].toFixed(1)} ${m[1].toFixed(1)} `); const q2 = pts[(i + 1) % n], m2 = [(q2[0] + pts[(i + 2) % n][0]) / 2, (q2[1] + pts[(i + 2) % n][1]) / 2]; d += `Q ${q2[0].toFixed(1)} ${q2[1].toFixed(1)} ${m2[0].toFixed(1)} ${m2[1].toFixed(1)} `; }
  return d + 'Z';
}
function flames(r, x0, x1, base, h, n) {
  let d = `M ${x0} ${base + 20} L ${x0} ${base} `; const w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) { const a = x0 + i * w, pk = h * (0.55 + r() * 0.6); d += `C ${a + w * 0.15} ${base - pk * 0.4} ${a + w * 0.2} ${base - pk * 0.8} ${a + w * 0.55} ${base - pk} C ${a + w * 0.45} ${base - pk * 0.55} ${a + w * 0.85} ${base - pk * 0.35} ${a + w} ${base} `; }
  return d + `L ${x1} ${base + 20} Z`;
}

// 1足ぶん。s：その足の いろ（左右ちがいは L/R で うわがき）
function shoe(s, cut, uid) {
  const cY = { low: 88, mid: 62, high: 36 }[cut] ?? 88; const hY = Math.max(cY + 66, 128);
  const r = rnd(hash(uid));
  const upper = `M 56 168 C 42 158 44 130 80 122 C 110 116 140 110 162 100 C 190 88 210 ${cY + 22} 224 ${cY} L 244 ${cY - 6} C 280 ${cY - 2} 310 ${cY + 2} 334 ${cY + 4} C 352 ${cY + 8} 360 ${cY + 36} 360 ${hY} L 360 166 Z`;
  const toe = `M 56 168 C 42 158 44 130 80 122 C 92 119 100 118 108 117 C 94 134 92 154 98 168 Z`;
  const heel = `M 360 166 L 360 ${hY} C 360 ${cY + 36} 352 ${cY + 10} 334 ${cY + 5} C 318 ${cY + 40} 308 130 312 166 Z`;
  const mid = `M 46 160 C 34 172 40 193 62 194 L 352 194 C 372 194 378 178 370 154 C 300 158 140 164 46 160 Z`;
  const outs = `M 62 194 L 352 194 C 368 194 372 200 362 206 L 70 206 C 50 206 46 200 62 194 Z`;
  const tongue = `M 218 ${cY + 8} C 214 ${cY - 16} 238 ${cY - 26} 252 ${cY - 14} L 248 ${cY + 6} Z`;
  const wave = `M 108 156 C 170 150 240 138 316 ${cY + 32} L 324 ${cY + 54} C 250 154 180 164 114 166 Z`;
  const cl = `cl${uid}`, sh = `sh${uid}`;
  let pat = '';
  const p = s.pat || 'solid', cols = s.cols || [];
  if (p === 'knit') pat = `<pattern id="k${uid}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="7" height="7" fill="none"/><line x1="0" y1="0" x2="0" y2="7" stroke="#000" stroke-opacity=".09" stroke-width="2.4"/></pattern>`;
  let deco = '';
  if (p === 'knit') deco = `<rect x="0" y="0" width="400" height="220" fill="url(#k${uid})"/>`;
  if (p === 'fire') deco = cols.map((c, i) => `<path d="${flames(r, 40, 370, 166, 92 - i * 26, 7 + i * 2)}" fill="${c}"/>`).join('');
  if (p === 'dots') { for (let i = 0; i < 70; i++) { const c = cols[Math.floor(r() * cols.length)]; deco += `<circle cx="${(40 + r() * 330).toFixed(1)}" cy="${(30 + r() * 150).toFixed(1)}" r="${(1.5 + r() * 3.6).toFixed(1)}" fill="${c}"/>`; } }
  if (p === 'splash') { for (let i = 0; i < 14; i++) deco += `<path d="${blob(r, 50 + r() * 320, 50 + r() * 130, 16 + r() * 22)}" fill="${cols[i % cols.length]}" opacity=".95"/>`; for (let i = 0; i < 40; i++) deco += `<circle cx="${(40 + r() * 330).toFixed(1)}" cy="${(40 + r() * 140).toFixed(1)}" r="${(1 + r() * 3).toFixed(1)}" fill="${cols[i % cols.length]}"/>`; }
  if (p === 'gloss' || p === 'metal') deco = `<path d="M 66 140 C 96 128 130 120 156 110" stroke="#fff" stroke-opacity=".7" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M 246 ${cY + 10} C 284 ${cY + 14} 314 ${cY + 18} 330 ${cY + 22}" stroke="#fff" stroke-opacity=".55" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  // ひも
  const A = [142, 108], B = [226, cY + 10]; const len = Math.hypot(B[0] - A[0], B[1] - A[1]); const n = Math.max(4, Math.round(len / 19));
  const tx = (B[0] - A[0]) / len, ty = (B[1] - A[1]) / len; const nx = ty, ny = -tx;
  let lace = '', eye = '';
  for (let i = 0; i < n; i++) { const k = (i + 0.5) / n, x = A[0] + (B[0] - A[0]) * k, y = A[1] + (B[1] - A[1]) * k; const a = `${(x - nx * 2).toFixed(1)} ${(y - ny * 2).toFixed(1)}`, b = `${(x + nx * 11 - tx * 5).toFixed(1)} ${(y + ny * 11 - ty * 5).toFixed(1)}`;
    lace += `<path d="M ${a} L ${b}" stroke="${OUT}" stroke-width="8" stroke-linecap="round"/><path d="M ${a} L ${b}" stroke="${s.lace}" stroke-width="5" stroke-linecap="round"/>`; eye += `<circle cx="${(x - nx * 3).toFixed(1)}" cy="${(y - ny * 3).toFixed(1)}" r="2.2" fill="${OUT}"/>`; }
  const stripe = s.stripe === 'none' ? '' : s.stripe === 'double'
    ? `<path d="M 124 152 C 184 140 244 ${cY + 64} 304 ${cY + 26}" stroke="${s.line}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M 144 164 C 204 154 264 ${cY + 86} 318 ${cY + 48}" stroke="${s.line}" stroke-width="9" fill="none" stroke-linecap="round"/>`
    : `<path d="${wave}" fill="${s.line}" stroke="${OUT}" stroke-width="2"/>`;
  const emb = `<g transform="translate(270 ${Math.min(138, cY + 58)})"><circle r="11" fill="${s.emb || s.line}" stroke="${OUT}" stroke-width="2"/><path d="M -11 0 L 11 0 M 0 -11 L 0 11 M -7 -8.5 C -2 -3 -2 3 -7 8.5 M 7 -8.5 C 2 -3 2 3 7 8.5" stroke="${s.embLine || OUT}" stroke-width="1.6" fill="none"/></g>`;
  const win = s.window ? `<ellipse cx="284" cy="180" rx="38" ry="6" fill="${s.window}" stroke="${OUT}" stroke-width="1.8"/>` : '';
  let tread = ''; for (let x = 74; x < 352; x += 12) tread += `<line x1="${x}" y1="199" x2="${x + 4}" y2="205" stroke="${OUT}" stroke-opacity=".35" stroke-width="1.5"/>`;
  const solePat = s.solePat === 'ice' ? `<path d="M 56 176 L 352 172" stroke="#fff" stroke-opacity=".7" stroke-width="3"/><path d="M 80 186 L 200 184" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>` : '';
  return `<defs>${pat}<clipPath id="${cl}"><path d="${upper}"/></clipPath>
<linearGradient id="${sh}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient>
${p === 'metal' ? `<linearGradient id="m${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cols[0]}"/><stop offset=".5" stop-color="${cols[1]}"/><stop offset="1" stop-color="${cols[2]}"/></linearGradient>` : ''}</defs>
<path d="M 244 ${cY - 6} C 280 ${cY - 2} 310 ${cY + 2} 334 ${cY + 4}" stroke="${s.lining || s.up}" stroke-width="9" fill="none"/>
<path d="${tongue}" fill="${s.tongue || s.up}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>
<path d="${upper}" fill="${p === 'metal' ? `url(#m${uid})` : s.up}"/>
<g clip-path="url(#${cl})">${deco}<path d="${toe}" fill="${s.toe || s.up}" ${s.toe && p !== 'solid' && p !== 'knit' ? '' : ''}/><path d="${heel}" fill="${s.heel || s.up}"/>${p === 'gloss' || p === 'metal' ? deco : ''}${stripe}${emb}<rect width="400" height="220" fill="url(#${sh})"/></g>
<path d="${toe}" fill="none" stroke="${OUT}" stroke-width="1.8" stroke-opacity=".7"/><path d="${heel}" fill="none" stroke="${OUT}" stroke-width="1.8" stroke-opacity=".7"/>
<path d="${upper}" fill="none" stroke="${OUT}" stroke-width="2.8" stroke-linejoin="round"/>
<path d="M ${A[0]} ${A[1]} L ${B[0]} ${B[1]}" stroke="${OUT}" stroke-width="15" stroke-linecap="round"/><path d="M ${A[0]} ${A[1]} L ${B[0]} ${B[1]}" stroke="${s.tongue || s.lining || s.up}" stroke-width="11" stroke-linecap="round"/>${lace}${eye}
<path d="M 332 ${cY + 4} C 344 ${cY - 18} 360 ${cY - 12} 356 ${cY + 14}" stroke="${OUT}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M 332 ${cY + 4} C 344 ${cY - 18} 360 ${cY - 12} 356 ${cY + 14}" stroke="${s.tab || s.line}" stroke-width="5" fill="none" stroke-linecap="round"/>
<path d="${mid}" fill="${s.sole}" stroke="${OUT}" stroke-width="2.6" stroke-linejoin="round"/><path d="M 70 182 C 150 178 250 188 352 170" stroke="${OUT}" stroke-opacity=".28" stroke-width="2" fill="none"/>${solePat}${win}
<path d="${outs}" fill="${s.out}" stroke="${OUT}" stroke-width="2.4" stroke-linejoin="round"/>${tread}`;
}

export function shoeSVG(d, size = 400) {
  const L = { ...d, ...(d.L || {}) }, R = { ...d, ...(d.R || {}) };
  if (d.L || d.R) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 470 270" width="${size}" height="${Math.round(size * 270 / 470)}">
<ellipse cx="245" cy="252" rx="200" ry="10" fill="#000" opacity=".12"/>
<g transform="translate(72 4) scale(.94)">${shoe(L, d.cut, d.id + 'L')}</g>
<g transform="translate(0 44)">${shoe(R, d.cut, d.id + 'R')}</g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 225" width="${size}" height="${Math.round(size * 225 / 400)}">
<ellipse cx="205" cy="212" rx="170" ry="8" fill="#000" opacity=".12"/>${shoe(d, d.cut, d.id)}</svg>`;
}

// ショップ・ずかんの アイコン（<img src>）。id ごとに おぼえておく
const icons = new Map();
export function shoeIcon(d) {
  if (!icons.has(d.id)) icons.set(d.id, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(shoeSVG(d, 240)));
  return icons.get(d.id);
}
