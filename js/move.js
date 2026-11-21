// ひっこし：ほかの ブラウザ（LINE → Safari など）へ セーブデータを うつす
const KEYS = ['dribble-rescue-v2', 'dribbat-rank-auth'];
export const PAGES = 'https://vashimae50-code.github.io/dribble-rescue-game/';
export const inLine = () => /\bLine\//i.test(navigator.userAgent);
const b64u = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, ''); while (s.length % 4) s += '='; const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const pipe = async (u8, T) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new T('deflate-raw'))).arrayBuffer());
export async function makeCode() {
  const o = {}; for (const k of KEYS) { const v = localStorage.getItem(k); if (v) o[k] = v; }
  const u8 = new TextEncoder().encode(JSON.stringify(o));
  if (window.CompressionStream) { try { return 'z' + b64u(await pipe(u8, CompressionStream)); } catch (e) { /* つぎへ */ } }
  return 'j' + b64u(u8);
}
export async function readCode(code) {
  code = String(code || '').trim().replace(/^.*[#?&]move=/, '').replace(/[&#].*$/, ''); const t = code[0]; let u8 = unb64u(code.slice(1));
  if (t === 'z') u8 = await pipe(u8, DecompressionStream); else if (t !== 'j') throw new Error('code');
  const o = JSON.parse(new TextDecoder().decode(u8)); const s = JSON.parse(o[KEYS[0]] || 'null');
  if (!s || !Array.isArray(s.players)) throw new Error('code'); return { o, s };
}
export function applyCode(o) { for (const k of KEYS) if (o[k]) localStorage.setItem(k, o[k]); }
// データは # の うしろでは なく ?move= に 入れる（LINE から Safari へ わたす ときに # より うしろが おちる ことが ある ため）
export async function moveUrl() { return PAGES + '?openExternalBrowser=1&move=' + (await makeCode()); }
// ひらいた URL の ひっこしデータ（?move= と、むかしの #move= の どちらでも）
export function codeFromUrl() { try { const q = new URLSearchParams(location.search).get('move'); if (q) return q; } catch (e) { /* noop */ } return location.hash.startsWith('#move=') ? location.hash.slice(6) : null; }
