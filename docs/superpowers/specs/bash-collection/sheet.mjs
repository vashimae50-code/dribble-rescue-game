import { shoeSVG } from './shoes-art.mjs'; import { SHOES } from './lineup.mjs'; import fs from 'fs';
const ids = process.argv[2] ? process.argv[2].split(',') : SHOES.map(s=>s.id);
const cols = +(process.argv[3]||4), cw = 330, ch = 250;
const list = SHOES.filter(s=>ids.includes(s.id)); const rows = Math.ceil(list.length/cols);
let body = '';
list.forEach((s,i)=>{ const x=(i%cols)*cw, y=Math.floor(i/cols)*ch; const inner = shoeSVG(s, 300).replace('<svg ', `<svg x="${x+15}" y="${y+10}" `);
  body += `<rect x="${x+6}" y="${y+6}" width="${cw-12}" height="${ch-12}" rx="18" fill="#ffffff" stroke="#d8deea"/>${inner}<text x="${x+cw/2}" y="${y+ch-44}" font-family="Noto Sans CJK JP, sans-serif" font-size="19" font-weight="700" text-anchor="middle" fill="#1b1b28">${s.secret?'？ ':''}${s.n}</text><text x="${x+cw/2}" y="${y+ch-20}" font-family="Noto Sans CJK JP, sans-serif" font-size="16" text-anchor="middle" fill="#7a6a20">${s.secret?'ぜんぶ あつめると…':'コイン '+s.cost}</text>`; });
fs.writeFileSync(process.argv[4]||'sheet.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="${cols*cw}" height="${rows*ch}"><rect width="100%" height="100%" fill="#eef2f8"/>${body}</svg>`);
