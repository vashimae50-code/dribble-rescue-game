// ドリバト！（めざせ！ドリブルキング） 3Dの世界（three.js）
import * as THREE from '../vendor/three.module.min.js';
import { SKILLS } from './data.js';
import { ballCanvas } from './balls.js';
import { makeHuman } from './character.js';
import { buildEnv } from './env.js';
import { spritePose, SHEETS } from './sprite.js';
import { spritePose7, SHEETS7 } from './sprite7.js';
import { EffectComposer } from '../vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/postprocessing/OutputPass.js';

export const LW = 1.5;          // レーンのはば
const HW = 2.9;                 // 通路の半分のはば
const CEIL = 4.2;
const RIB = 6; const RIBS = 16;
const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const C = (c) => new THREE.Color(c);

function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const glowTex = () => canvasTex(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });

export function createScene(canvas, o) {
  const pal = o.pal; const suit = o.suit || '#3df5ff';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!o.video });
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  const shared = { glow: glowTex() };
  const disposables = [renderer, shared.glow];

  const rim = new THREE.PointLight(C(pal.a), 4, 12); rim.position.set(0, 2.5, -3); scene.add(rim);
  const ballLight = new THREE.PointLight(0xff9a3d, 2.5, 4); scene.add(ballLight);

  // ---- 背景の世界 ----
  const env = buildEnv(scene, { themeName: o.theme, stageId: o.stageId, HW, LW, glow: shared.glow });
  // ---- プレイヤー（人型モデル） ----
  const human = o.human ? makeHuman(o.human, suit, { num: 7, bigHead: 1.65 }) : null;
  // 敵も バスケットマン：ディフェンス 2人、おいかけてくる 1人、ボス 1人（べつの チームの ユニフォーム）
  // プレイヤーを 絵（スプライト）で 出す：右手ドリブル と パワーポジション
  const GK = (o.grow && o.grow.k) || 1; // そだつ：からだの 大きさ
  let pspr = null, psHit = false; const psMem = {}; const psT = {}; const NEW7 = !o.girl; const PSN = NEW7 ? SHEETS7 : SHEETS; const psPre = o.girl ? 'g_' : 'n_'; const PSROWS = NEW7 ? 3 : 2; const PSS = NEW7 ? 2.2 : 1.65; // おとこのこは 7ばんの あたらしい 絵（3×3）
  const impact = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); impact.rotation.x = -Math.PI / 2; impact.visible = false; scene.add(impact); disposables.push(impact.geometry, impact.material);
  if (human && o.sprite !== false) { let n = 0; const ld = new THREE.TextureLoader(); for (const k of PSN) { const t = ld.load(`img/player/${psPre}${k}.webp`, () => { if (++n === PSN.length) { const m = new THREE.SpriteMaterial({ map: psT[PSN[0]], transparent: true, alphaTest: 0.05 }); disposables.push(m); pspr = new THREE.Sprite(m); pspr.center.set(0.5, NEW7 ? 5 / 512 : 0.01); pspr.scale.set(PSS * GK, PSS * GK, 1); scene.add(pspr); human.setMainVisible(false); } }); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; psT[k] = t; disposables.push(t); } } // おわったら かならず すてる（メモリが ふえつづけて とまるのを ふせぐ）
  const faceAtlas = o.human ? new THREE.TextureLoader().load('img/faces.png') : null; if (faceAtlas) faceAtlas.colorSpace = THREE.SRGBColorSpace;
  const mkFoe = (c, num, trim) => { const h = makeHuman(o.human, c, { num, trim, guide: false, skin: '#c98f66', shoe: '#22222a' }); h.root.visible = false; scene.add(h.root); return h; };
  const defs = o.human ? [mkFoe('#d9263c', 23, '#ffe03d'), mkFoe('#d9263c', 11, '#ffe03d'), mkFoe('#2a3a7a', 15, '#ffe03d'), mkFoe('#2a3a7a', 8, '#ffe03d')] : [];
  const rival = o.human ? mkFoe('#d9263c', 4, '#ffe03d') : null;
  const bossH = o.human ? mkFoe('#1c2450', 99, '#ffe03d') : null;
  const midH = o.human ? mkFoe('#d9263c', 5, '#ffe03d') : null; if (midH) midH.root.visible = false; // ちゅうボス（大きな ディフェンス）
  const P = human ? human.root : new THREE.Group(); scene.add(P);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; scene.add(shadow); disposables.push(shadow.geometry, shadow.material);
  const aura = (o.grow && o.grow.aura) || 0.25; const footGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: shared.glow, color: o.grow && o.grow.gold ? 0xffd23d : C(suit), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: aura })); footGlow.scale.set(2.0 * (1 + (aura - 0.25)), 0.8 * (1 + (aura - 0.25)), 1); scene.add(footGlow); disposables.push(footGlow.material);
  // ボール
  const b = o.ball || { id: 'std', pat: 'solid', c1: '#ff9a3d', c2: '#c4520a' };
  const ballTex = new THREE.CanvasTexture(ballCanvas(b.pat ? b : { id: 'std', pat: 'solid', c1: b.c1, c2: b.c2 })); ballTex.colorSpace = THREE.SRGBColorSpace; ballTex.anisotropy = 4;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 22), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.62, metalness: b.pat === 'metal' ? 0.35 : 0, emissive: b.pat === 'neon' ? 0xffffff : 0x000000, emissiveMap: b.pat === 'neon' ? ballTex : null, emissiveIntensity: b.pat === 'neon' ? 0.55 : 0 })); scene.add(ball);
  const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: shared.glow, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 })); ballGlow.scale.set(0.7, 0.7, 1); scene.add(ballGlow); ball.layers.enable(1);
  const ball2 = ball.clone(); ball2.visible = false; ball2.layers.enable(1); scene.add(ball2);
  const ballShadow = shadow.clone(); ballShadow.scale.setScalar(0.4); scene.add(ballShadow);
  disposables.push(ballTex, ball.geometry, ball.material, ballGlow.material);
  const TR = 26; const trPos = new Float32Array(TR * 3); const trCol = new Float32Array(TR * 3); const trGeo = new THREE.BufferGeometry(); trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3)); trGeo.setAttribute('color', new THREE.BufferAttribute(trCol, 3));
  const trMat = new THREE.PointsMaterial({ size: 0.17, vertexColors: true, map: shared.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); const trail = new THREE.Points(trGeo, trMat); trail.frustumCulled = false; trail.layers.enable(1); scene.add(trail); disposables.push(trGeo, trMat);
  // バディ
  let buddy = null;
  if (o.buddy) { const t = canvasTex(128, 128, (g) => { g.font = '100px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.buddy, 64, 70); }); buddy = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true })); const bs = 0.7 * (1 + 0.15 * ((o.buddyLv || 1) - 1)); buddy.scale.set(bs, bs, 1);
    if ((o.buddyLv || 1) >= 3) { const bg = new THREE.Sprite(new THREE.SpriteMaterial({ map: shared.glow, color: o.buddyLv >= 4 ? 0xffe03d : 0x7dffb0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 })); bg.scale.set(1.6, 1.6, 1); bg.position.z = -0.01; buddy.add(bg); disposables.push(bg.material); } scene.add(buddy); disposables.push(t, buddy.material); }

  // ---- ゲート・バリア・ラベル ----
  const hazTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = 'rgba(255,30,70,.55)'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,220,230,.9)'; g.lineWidth = 12; for (let i = -h; i < w + h; i += 40) { g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); } g.strokeStyle = '#ff2d55'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); });
  const hazMat = new THREE.MeshBasicMaterial({ map: hazTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const bannerTex = canvasTex(256, 128, (g, w, h) => { for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#fff4e0' : '#e8452f'; g.fillRect(0, i * h / 4, w, h / 4); } g.fillStyle = 'rgba(0,0,0,.12)'; for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 6, h); }); const bannerMat = new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide }); disposables.push(bannerTex, bannerMat);
  const G = { box: new THREE.BoxGeometry(1, 1, 1), plane: new THREE.PlaneGeometry(1, 1), ring: new THREE.TorusGeometry(1, 0.06, 8, 40) };
  const chevTex = canvasTex(128, 128, (g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = 18; g.lineJoin = 'round'; g.beginPath(); g.moveTo(20, 96); g.lineTo(64, 40); g.lineTo(108, 96); g.stroke(); });
  disposables.push(hazTex, hazMat, G.box, G.plane, G.ring, chevTex);
  const labelCache = new Map(); const colMat = new Map();
  const cm = (c, op = 1) => { const k = c + op; if (!colMat.has(k)) { const m = new THREE.MeshBasicMaterial({ color: C(c), transparent: op < 1, opacity: op, depthWrite: op >= 1, side: THREE.DoubleSide }); colMat.set(k, m); disposables.push(m); } return colMat.get(k); };
  // 文字を はばに おさめる（iPhone の Safari は fillText の はば指定が きかないので、自分で 小さくして まんなかに おく）
  function fitText(g, text, cx, cy, maxW, px) { let size = px; g.font = `900 ${size}px "M PLUS Rounded 1c","Hiragino Maru Gothic ProN",sans-serif`; let wd = g.measureText(text).width; if (wd > maxW) { size = Math.floor(px * maxW / wd); g.font = `900 ${size}px "M PLUS Rounded 1c","Hiragino Maru Gothic ProN",sans-serif`; wd = g.measureText(text).width; } g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(text, cx - wd / 2, cy); }
  // 2だんの ふだ（よこへ うごく ゲート用：レーンの わくの 上に のせる）
  function label2(l1, l2, color) {
    const k = '2|' + l1 + '|' + l2 + color; if (labelCache.has(k)) return labelCache.get(k);
    const t = canvasTex(512, 256, (g, w, h) => { g.fillStyle = 'rgba(4,8,30,.85)'; g.strokeStyle = color; g.lineWidth = 10; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 34); g.fill(); g.stroke(); g.fillStyle = color;
      fitText(g, l1, w / 2, h * 0.32, w - 50, 72); fitText(g, l2, w / 2, h * 0.7, w - 50, 64); });
    const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }); labelCache.set(k, m); disposables.push(t, m); return m;
  }
  function label(text, color) {
    const k = text + color; if (labelCache.has(k)) return labelCache.get(k);
    const t = canvasTex(768, 192, (g, w, h) => { g.fillStyle = 'rgba(4,8,30,.82)'; g.strokeStyle = color; g.lineWidth = 10; const r = 40; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, r); g.fill(); g.stroke(); g.fillStyle = color; fitText(g, text, w / 2, h / 2 + 6, w - 70, 104); });
    const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }); labelCache.set(k, m); disposables.push(t, m); return m;
  }
  const gates = new Map();
  function buildGate(cue) {
    const sk = SKILLS[cue.skill]; const gp = new THREE.Group(); const col = sk.c;
    const bar = (x, y, z, sx, sy, sz, mat) => { const m = new THREE.Mesh(G.box, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); gp.add(m); return m; };
    if (cue.goal) {   // ゴールの アーチ
      const gold = '#ffe03d'; bar(-HW + 0.3, CEIL / 2 - 0.3, 0, 0.3, CEIL - 0.6, 0.3, cm(gold)); bar(HW - 0.3, CEIL / 2 - 0.3, 0, 0.3, CEIL - 0.6, 0.3, cm(gold)); bar(0, CEIL - 0.6, 0, HW * 2 - 0.3, 0.3, 0.3, cm(gold));
      for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) { const q = new THREE.Mesh(G.plane, cm((i + j) % 2 ? '#ffffff' : '#111122')); q.rotation.x = -Math.PI / 2; q.position.set(-HW + 0.5 + (i + 0.5) * (HW * 2 - 1) / 12, 0.04, j * 0.5 - 0.25); q.scale.set((HW * 2 - 1) / 12, 0.5, 1); gp.add(q); }
      const veil = new THREE.Mesh(G.plane, cm(gold, 0.14)); veil.position.set(0, CEIL / 2 - 0.3, 0); veil.scale.set(HW * 2 - 0.6, CEIL - 0.6, 1); gp.add(veil);
      const sp = new THREE.Sprite(label('🏁 ゴール', gold)); sp.scale.set(5.4, 1.35, 1); sp.position.set(0, CEIL - 1.3, 0.1); gp.add(sp); scene.add(gp); return gp;
    }
    const laneMove = cue.lane1 !== cue.lane0;
    const lx = cue.lane1 * LW;
    if (laneMove) {
      for (let l = -1; l <= 1; l++) {
        if (l === cue.lane1) continue;
        if (cue.guard && l === cue.lane0) continue;
        addDefender(gp, cue, l * LW, false);
      }
      if (cue.guard) addDefender(gp, cue, cue.lane0 * LW, true);
      bar(lx - LW * 0.48, 1.4, 0, 0.1, 2.8, 0.1, cm(col)); bar(lx + LW * 0.48, 1.4, 0, 0.1, 2.8, 0.1, cm(col));
      { const SW = 2.4; bar(lx, 2.8, 0, SW, 0.1, 0.1, cm(col)); bar(lx, 4.05, 0, SW, 0.1, 0.1, cm(col)); bar(lx - SW / 2, 3.42, 0, 0.1, 1.35, 0.1, cm(col)); bar(lx + SW / 2, 3.42, 0, 0.1, 1.35, 0.1, cm(col)); } // ふだの わく
      const pad = new THREE.Mesh(G.plane, cm(col, 0.35)); pad.rotation.x = -Math.PI / 2; pad.position.set(lx, 0.03, 1.5); pad.scale.set(LW * 0.9, 4, 1); gp.add(pad);
      const ar = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: chevTex, color: C(col), transparent: true, depthWrite: false })); ar.rotation.x = -Math.PI / 2; ar.rotation.z = cue.lane1 > cue.lane0 ? -Math.PI / 2 : Math.PI / 2; ar.position.set((cue.lane0 + cue.lane1) / 2 * LW, 0.05, 3.2); ar.scale.set(1.3, 1.3, 1); gp.add(ar); gp.userData.mats = [ar.material];
    } else {
      bar(-HW + 0.3, CEIL / 2 - 0.3, 0, 0.14, CEIL - 0.6, 0.14, cm(col)); bar(HW - 0.3, CEIL / 2 - 0.3, 0, 0.14, CEIL - 0.6, 0.14, cm(col)); bar(0, CEIL - 0.6, 0, HW * 2 - 0.6, 0.14, 0.14, cm(col));
      const veil = new THREE.Mesh(G.plane, cm(col, 0.1)); veil.position.set(0, CEIL / 2 - 0.3, 0); veil.scale.set(HW * 2 - 0.6, CEIL - 0.6, 1); gp.add(veil);
      if (cue.skill === 'low') { const hz = new THREE.Mesh(G.plane, bannerMat); hz.position.set(0, 1.62, 0.05); hz.scale.set(HW * 2 - 0.7, 1.3, 1); gp.add(hz); } // ひくく：ひくい バーの 下を とおる（ふだに かさならない 高さ）
      if (cue.skill === 'freeze' || cue.skill === 'jstop') { const hz = new THREE.Mesh(G.plane, cm('#ff2d55', 0.28)); hz.position.set(0, CEIL / 2 - 0.3, 0.05); hz.scale.set(HW * 2 - 0.7, CEIL - 0.7, 1); gp.add(hz); gp.userData.scan = hz; }
      if (sk.sp > 1.2) for (let i = 0; i < 5; i++) { const ch = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: chevTex, color: C(col), transparent: true, depthWrite: false })); ch.rotation.x = -Math.PI / 2; ch.position.set(cue.lane1 * LW, 0.04, -2 - i * 4); ch.scale.set(1.6, 1.6, 1); gp.add(ch); (gp.userData.mats = gp.userData.mats || []).push(ch.material); }
      if (sk.hand === 'alt') { const rg = new THREE.Mesh(G.ring, cm(col)); rg.position.set(cue.lane1 * LW, 1.5, 0); rg.scale.setScalar(1.15); gp.add(rg); gp.userData.spin = rg; }
    }
    const txt = `${sk.i} ${cue.skill === 'step' || cue.skill === 'slide' || cue.skill === 'xstep' || cue.skill === 'drive' ? (cue.lane1 > cue.lane0 ? 'みぎへ ' : 'ひだりへ ') : ''}${cue.hand === 'L' && sk.hand === 'cur' ? 'ひだりで ' : cue.hand === 'R' && sk.hand === 'cur' ? 'みぎで ' : ''}${sk.n}`;
    let sp;
    if (laneMove) { const dir = txt.match(/(みぎへ|ひだりへ)/); const l1 = `${sk.i} ${dir ? dir[1] : ''}`.trim(); const l2 = txt.replace(sk.i, '').replace(/(みぎへ|ひだりへ)\s*/, '').trim(); sp = new THREE.Sprite(label2(l1, l2, col)); sp.scale.set(2.3, 1.15, 1); sp.position.set(lx, 3.42, 0.1); }
    else { sp = new THREE.Sprite(label(txt, col)); sp.scale.set(4.6, 1.15, 1); sp.position.set(0, CEIL - 1.25, 0.1); }
    sp.renderOrder = 6; gp.add(sp); // ふだは いつも いちばん 手前に
    scene.add(gp); return gp;
  }
  const robotMat = new THREE.MeshStandardMaterial({ color: 0x3a3f58, roughness: 0.35, metalness: 0.7 }); const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2d55 });
  disposables.push(robotMat, eyeMat);
  const droneGeo = new THREE.SphereGeometry(0.34, 16, 12); const droneRing = new THREE.TorusGeometry(0.5, 0.045, 8, 28); disposables.push(droneGeo, droneRing);
  function buildDrone() {
    const d = new THREE.Group(); const b = new THREE.Mesh(droneGeo, robotMat); b.scale.set(1, 0.7, 1); d.add(b);
    const e = new THREE.Mesh(droneGeo, eyeMat); e.scale.setScalar(0.42); e.position.z = 0.26; d.add(e);
    const r = new THREE.Mesh(droneRing, eyeMat); r.rotation.x = Math.PI / 2; d.add(r); d.userData.ring = r;
    const g2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: shared.glow, color: 0xff2d55, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7 })); g2.scale.set(2, 2, 1); d.add(g2); d.userData.mat = g2.material; return d;
  }
  // レーンを ふさぐ ディフェンス（人がいれば 人、いなければ ロボットで だいよう）
  function addDefender(gp, cue, x, guard) {
    const r = new THREE.Group(); r.position.set(x, 0, -0.6); gp.add(r);
    (cue._robots = cue._robots || []).push({ r, guard });
    if (human) return r;
    if (guard) {
      const add = (geo, mat, px, py, pz, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.scale.set(sx, sy, sz); r.add(m); return m; };
      add(G.box, robotMat, 0, 1.15, 0, 0.8, 0.9, 0.5); add(G.box, robotMat, 0, 1.9, 0, 0.5, 0.42, 0.42); add(G.box, eyeMat, 0, 1.92, 0.22, 0.36, 0.1, 0.02);
      add(G.box, robotMat, -0.75, 1.3, 0, 0.7, 0.16, 0.16); add(G.box, robotMat, 0.75, 1.3, 0, 0.7, 0.16, 0.16); add(G.box, eyeMat, -1.1, 1.3, 0, 0.12, 0.3, 0.3); add(G.box, eyeMat, 1.1, 1.3, 0, 0.12, 0.3, 0.3);
      add(G.box, robotMat, -0.22, 0.35, 0, 0.22, 0.7, 0.26); add(G.box, robotMat, 0.22, 0.35, 0, 0.22, 0.7, 0.26);
    } else {
      const hz = new THREE.Mesh(G.plane, hazMat); hz.position.set(x, 1.05, 0); hz.scale.set(LW * 0.9, 2.1, 1); gp.add(hz);
      const dr = buildDrone(); dr.position.set(x, 2.55, 0); gp.add(dr); (gp.userData.drones = gp.userData.drones || []).push(dr);
    }
    return r;
  }

  // ---- ⚡オーブ ----
  const ORB = 90; const orbGeo = new THREE.SphereGeometry(0.15, 12, 8);
  const orbs = new THREE.InstancedMesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), ORB); orbs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); orbs.frustumCulled = false; scene.add(orbs);
  const halo = new THREE.InstancedMesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }), ORB); halo.instanceMatrix.setUsage(THREE.DynamicDrawUsage); halo.frustumCulled = false; scene.add(halo);
  disposables.push(orbGeo, orbs.material, halo.material);
  const dummy = new THREE.Object3D(); const tmpC = new THREE.Color();

  // ---- ボス ----
  const boss = new THREE.Group(); boss.visible = false; scene.add(boss);
  { const m = new THREE.MeshStandardMaterial({ color: C(pal.b).multiplyScalar(0.35), roughness: 0.3, metalness: 0.8 }); const e = new THREE.MeshBasicMaterial({ color: 0xff2d55 }); disposables.push(m, e);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), m); core.material.flatShading = true; boss.add(core); disposables.push(core.geometry);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), e); eye.position.z = 1.8; boss.add(eye); boss.userData.eye = eye; boss.userData.eyeMat = e; disposables.push(eye.geometry);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.12, 8, 50), new THREE.MeshBasicMaterial({ color: C(pal.a) })); boss.add(ring); boss.userData.ring = ring; disposables.push(ring.geometry, ring.material);
    for (const s of [-1, 1]) { const a = new THREE.Mesh(G.box, m); a.scale.set(0.5, 3, 0.5); a.position.set(s * 3.4, -0.6, 0); boss.add(a); const c = new THREE.Mesh(G.box, e); c.scale.set(0.7, 0.4, 0.7); c.position.set(s * 3.4, -2.2, 0); boss.add(c); }
    const hg = new THREE.Sprite(new THREE.SpriteMaterial({ map: shared.glow, color: 0xff2d55, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 })); hg.scale.set(14, 14, 1); boss.add(hg); disposables.push(hg.material); }

  // ---- 追っ手のドローン ----
  const hunter = buildDrone(); hunter.scale.setScalar(2.4); hunter.position.set(-2.4, 2.4, 9); scene.add(hunter); const hunterLight = new THREE.PointLight(0xff2d55, 0, 9); scene.add(hunterLight);
  // ---- つぶ・スピード線 ----
  const PN = 400; const pPos = new Float32Array(PN * 3); const pCol = new Float32Array(PN * 3); const pVel = new Float32Array(PN * 3); const pLife = new Float32Array(PN); let pi = 0;
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.13, vertexColors: true, map: shared.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); const pts = new THREE.Points(pGeo, pMat); pts.frustumCulled = false; scene.add(pts);
  for (let i = 0; i < PN; i++) pPos[i * 3 + 1] = -50;
  const SL = 60; const sPos = new Float32Array(SL * 6); const sSeed = []; for (let i = 0; i < SL; i++) { const a = Math.random() * TAU; const r = 2.6 + Math.random() * 4; sSeed.push({ x: Math.cos(a) * r, y: 2 + Math.sin(a) * r * 0.7, z: Math.random() * 60 }); }
  const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); const sMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }); const speedLines = new THREE.LineSegments(sGeo, sMat); speedLines.frustumCulled = false; scene.add(speedLines);
  disposables.push(pGeo, pMat, sGeo, sMat);

  function burst(x, y, z, color, n = 20, pow = 1) {
    tmpC.set(color);
    for (let i = 0; i < n; i++) { const k = pi++ % PN; const a = Math.random() * TAU; const u = Math.random() * 2 - 1; const s = (2 + Math.random() * 5) * pow; const q = Math.sqrt(1 - u * u);
      pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z; pVel[k * 3] = Math.cos(a) * q * s; pVel[k * 3 + 1] = u * s + 2; pVel[k * 3 + 2] = Math.sin(a) * q * s; pLife[k] = 0.6 + Math.random() * 0.6; pCol[k * 3] = tmpC.r; pCol[k * 3 + 1] = tmpC.g; pCol[k * 3 + 2] = tmpC.b; }
  }

  let W = 1, H = 1; let laneX = 0; let fov = 60; let bossY = 9; let bossHit = 0; let camShake = 0;
  const gcam = new THREE.PerspectiveCamera(30, 1, 0.1, 30); gcam.layers.set(1);
  const gfloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 3), new THREE.MeshBasicMaterial({ color: 0x24347a, side: THREE.DoubleSide })); gfloor.rotation.x = -Math.PI / 2; gfloor.position.y = -0.005; gfloor.layers.set(1); scene.add(gfloor); disposables.push(gfloor.geometry, gfloor.material);
  const pipBall = new THREE.MeshBasicMaterial({ color: 0xff8a2a, side: THREE.DoubleSide }); disposables.push(pipBall);
  let composer = null;
  if (o.bloom !== false) { try { composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, cam)); const bl = new UnrealBloomPass(new THREE.Vector2(640, 360), env.bloom[0], 0.55, env.bloom[1]); composer.addPass(bl); composer.addPass(new OutputPass()); disposables.push(bl, composer); } catch (e) { composer = null; } }
  function resize() {
    const r = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 1600 / Math.max(1, r.width), 2);
    renderer.setPixelRatio(dpr); renderer.setSize(r.width, r.height, false); if (composer) { composer.setPixelRatio(dpr); composer.setSize(r.width, r.height); } W = r.width; H = r.height; cam.aspect = W / Math.max(1, H); cam.updateProjectionMatrix(); if (env.setAspect) env.setAspect(cam.aspect);
  }
  resize();

  // st: { camZ, dt, beat, mbeat, lane, cue, speed, cues[], orbs[], boss:{on,hit,dead,finale}, shake, hideBall }
  function render(st) {
    const dt = st.dt; const beat = st.beat; const cue = st.cue; const sk = SKILLS[cue ? cue.skill : 'rest'];
    const pulse = Math.pow(1 - (st.mbeat - Math.floor(st.mbeat)), 2);
    // 世界を うごかす
    env.update(st.camZ, dt, laneX);
    rim.intensity = 3 + 3 * pulse;

    // プレイヤーの うごき
    const tl = st.lane * LW; const prevX = laneX; laneX = lerp(laneX, tl, 1 - Math.exp(-dt * 11)); const vx = (laneX - prevX) / Math.max(dt, 0.001);
    const noBall = cue && cue.ballMode === 'none';
    P.position.set(laneX, 0, 0);
    const abeat = cue && cue.rush ? cue.b0 + (beat - cue.b0) * 2 : beat; // れんだ：ドリブルを 2ばいの はやさに
    let bp = null; if (human) bp = human.animate({ dt, beat: abeat, cue, sk, vx });
    let bx = laneX + (bp ? bp.x : 0.4), by = bp ? bp.y : 0.8, bz = bp ? bp.z : -0.3;
    let pose = null;
    if (pspr) { // 絵の コマえらび と ボールの いち（js/sprite.js）
      pose = (NEW7 ? spritePose7 : spritePose)({ sk, cue, beat: abeat, vx, bp, bp2: human && human.ball2(), mem: psMem });
      const T = psT[pose.sheet] || psT[PSN[0]]; const f = pose.f;
      if (pspr.material.map !== T) { pspr.material.map = T; pspr.material.needsUpdate = true; }
      T.repeat.set(1 / 3, 1 / PSROWS); T.offset.set((f % 3) / 3, (PSROWS - 1 - Math.floor(f / 3)) / PSROWS); pspr.position.set(laneX, pose.lift * GK, 0.02);
      if (pose.ball) { bx = laneX + pose.ball.x * GK; by = 0.17 + (pose.ball.y - 0.17) * GK; bz = pose.ball.z; }
    }
    // つよく ドリブル：ボールを 大きく、ゆかに つくたびに 大きな わ
    { ball.scale.setScalar(1); // つよい ドリブルでも ボールの 大きさは かえない（大きく するのは 流れてくる ●）
      if (pose && pose.strong) { if (by < 0.26 && !psHit) { psHit = true; impact.position.set(bx, 0.02, bz); impact.scale.setScalar(0.3); impact.material.opacity = 0.95; impact.material.color.set(sk.c); camShake = Math.max(camShake, 0.35); } if (by > 0.4) psHit = false; }
      if (impact.material.opacity > 0) { impact.scale.multiplyScalar(1 + dt * 7); impact.material.opacity = Math.max(0, impact.material.opacity - dt * 2.6); } impact.visible = impact.material.opacity > 0.01; }
    shadow.position.set(laneX, 0.012, 0); footGlow.position.set(laneX, 0.06, 0.1);
    ball.visible = ballGlow.visible = ballShadow.visible = !noBall || (!!pspr && NEW7); // 足だけの れんしゅうでも ボールは もったまま 見せる（絵の ときだけ）
    ball.position.set(bx, by, bz); ball.rotation.x -= dt * 8; ballGlow.position.copy(ball.position); ballGlow.material.color.set(sk.c); ballLight.position.copy(ball.position); ballLight.color.set(sk.c);
    { const b2 = human && human.ball2(); ball2.visible = !!b2 && !noBall; if (b2) { if (pose && pose.ball2) ball2.position.set(laneX + pose.ball2.x * GK, 0.17 + (pose.ball2.y - 0.17) * GK, pose.ball2.z); else ball2.position.set(laneX + b2.x, b2.y, b2.z); ball2.rotation.x -= dt * 8; } }
    ballShadow.position.set(bx, 0.014, bz); ballShadow.scale.setScalar(0.25 + (1 - Math.min(1, by / 1.2)) * 0.2);
    // ボールの あと（スワイプのような ひかりの線）
    for (let i = TR - 1; i > 0; i--) { trPos[i * 3] = trPos[i * 3 - 3] ; trPos[i * 3 + 1] = trPos[i * 3 - 2]; trPos[i * 3 + 2] = trPos[i * 3 - 1] + (st.speed || 0) * dt * 2.2; }
    trPos[0] = bx; trPos[1] = by; trPos[2] = bz; tmpC.set(sk.c);
    for (let i = 0; i < TR; i++) { const f = noBall ? 0 : Math.pow(1 - i / TR, 1.5); trCol[i * 3] = tmpC.r * f; trCol[i * 3 + 1] = tmpC.g * f; trCol[i * 3 + 2] = tmpC.b * f; }
    trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true;
    if (buddy) { buddy.position.set(laneX - 1.0, 0.4 + Math.abs(Math.sin(beat * Math.PI)) * 0.3, -0.6); }

    // ゲート
    const live = new Set();
    for (const c of st.cues) {
      if ((c.skill === 'rest' || c.noGate) && !c.goal) continue; const d = (c.goal ? c.z1 : c.z0) - st.camZ; if (d > 86 || d < -4) continue;
      live.add(c); let gp = gates.get(c); if (!gp) { gp = buildGate(c); gates.set(c, gp); }
      gp.position.z = -d; gp.visible = d > -0.8; if (gp.userData.drones) for (const dr of gp.userData.drones) { dr.position.y = 2.55 + Math.sin(st.mbeat * 3 + dr.position.x) * 0.12; dr.userData.ring.rotation.z += dt * 9; } if (gp.userData.spin) gp.userData.spin.rotation.z += dt * 3; if (gp.userData.scan) gp.userData.scan.material.opacity = 0.18 + 0.14 * Math.sin(st.mbeat * TAU);
      if (c._robots) for (const slot of c._robots) { if (!slot.guard) continue; const r = slot.r; const pre = st.cues[st.cues.indexOf(c) - 1]; const fake = pre && pre.skill === 'jab' && beat >= pre.b0 ? -(c.dir || 1) : 0; r.rotation.z = lerp(r.rotation.z, -fake * 0.35, 0.1); r.position.x = lerp(r.position.x, c.lane0 * LW + fake * 0.7, 0.08); if (d < 0.5 && !human) { r.rotation.y += dt * 12; r.position.y += dt * 4; } }
    }
    if (defs.length) { const gs = []; for (const [c, gp] of gates) if (c._robots && gp.position.z < 1.5 && gp.position.z > -70) for (const slot of c._robots) gs.push([slot, gp]); gs.sort((a, b) => b[1].position.z - a[1].position.z);
      defs.forEach((h, i) => { const it = gs[i]; h.root.visible = !!it; if (!it) return; const r = it[0].r; if (h._slot !== it[0]) { h._slot = it[0]; if (it[0].face == null) it[0].face = Math.floor(Math.random() * 50); h.setFace(faceAtlas, it[0].face); } h.root.position.set(r.position.x, 0, it[1].position.z + r.position.z); h.root.rotation.set(0, Math.PI, r.rotation.z * 0.6); h.animate({ dt, beat: beat + i * 0.5, cue: null, sk: SKILLS.rest, vx: 0, mode: 'defend' }); }); }
    for (const [c, gp] of gates) if (!live.has(c)) { scene.remove(gp); (gp.userData.mats || []).forEach((m) => m.dispose()); (gp.userData.drones || []).forEach((dr) => dr.userData.mat.dispose()); gates.delete(c); }
    // オーブ
    let n = 0;
    for (const ob of st.orbs) { if (n >= ORB) break; const d = ob.z - st.camZ; if (d < 0.3 || d > 80) continue;
      dummy.position.set(ob.x, ob.y + Math.sin(st.mbeat * TAU + ob.z) * 0.06, -d); const os = ob.big ? 2 : 1; dummy.scale.setScalar(os); dummy.updateMatrix(); orbs.setMatrixAt(n, dummy.matrix); tmpC.set(ob.c).lerp(new THREE.Color(0xffffff), 0.35); orbs.setColorAt(n, tmpC);
      dummy.scale.setScalar(os * (1.5 + pulse * 0.3)); dummy.updateMatrix(); halo.setMatrixAt(n, dummy.matrix); halo.setColorAt(n, tmpC.set(ob.c)); n++; }
    orbs.count = halo.count = n; orbs.instanceMatrix.needsUpdate = halo.instanceMatrix.needsUpdate = true; if (orbs.instanceColor) orbs.instanceColor.needsUpdate = true; if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
    // ボス
    // ちゅうボス：プレイヤーの まえに 大きな ディフェンス。たおれたら ちぢんで きえる
    if (midH) { const m = st.mid; midH.root.visible = !!(m && m.on && !m.gone);
      if (midH.root.visible) { if (!midH._face && faceAtlas) { midH._face = true; midH.setFace(faceAtlas, Math.floor(Math.random() * 50)); }
        const hit = m.hit || 0; const sc = m.dead ? Math.max(0.01, midH.root.scale.x * (1 - dt * 3)) : 1.75; midH.root.scale.setScalar(sc);
        midH.root.position.set(laneX + Math.sin(beat * 2.1) * 0.5 + (Math.random() - 0.5) * hit * 0.35, 0, -7.5); midH.root.rotation.set(m.dead ? -0.6 : 0, Math.PI, Math.sin(beat * 2.1) * 0.08);
        midH.animate({ dt, beat: beat * 1.2, cue: null, sk: SKILLS.rest, vx: 0, mode: 'defend' }); } }
    if (st.boss && st.boss.on) {
      boss.visible = !st.boss.gone; bossY = lerp(bossY, 2.3, 0.04); bossHit = Math.max(st.boss.hit || 0, bossHit - dt * 3);
      boss.position.set(Math.sin(st.mbeat * 0.7) * 1.2 + (Math.random() - 0.5) * bossHit * 0.5, bossY + Math.sin(st.mbeat * 1.4) * 0.25, st.boss.finale ? -24 : -34);
      boss.userData.ring.rotation.x += dt * 1.2; boss.userData.ring.rotation.y += dt * 0.8; boss.rotation.y = Math.sin(st.mbeat * 0.5) * 0.3; boss.userData.eye.scale.setScalar(1 + bossHit * 0.5 + pulse * 0.15);
      boss.userData.eyeMat.color.set(bossHit > 0.3 ? 0xffffff : 0xff2d55); if (st.boss.dead) boss.scale.multiplyScalar(0.9); else boss.scale.setScalar(0.5);
      if (bossH) { if (!bossH._face && faceAtlas) { bossH._face = true; bossH.setFace(faceAtlas, Math.floor(Math.random() * 50)); } for (const ch of boss.children) if (!ch.isSprite) ch.visible = false; bossH.root.visible = boss.visible; if (st.boss.dead) bossH.root.scale.multiplyScalar(0.9); else bossH.root.scale.setScalar(st.boss.finale ? 4.6 : 6); bossH.root.position.set(boss.position.x * 1.6, 0, boss.position.z); bossH.root.rotation.set(0, Math.PI, 0); bossH.animate({ dt, beat: beat * 0.5, cue: null, sk: SKILLS.rest, vx: 0, mode: 'defend' }); }
    }
    // つぶ
    for (let i = 0; i < PN; i++) { if (pLife[i] <= 0) continue; pLife[i] -= dt; pVel[i * 3 + 1] -= 9 * dt; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt + (st.speed || 0) * dt * 6; if (pLife[i] <= 0) pPos[i * 3 + 1] = -50; }
    pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
    // スピード線
    const spd = st.speed || 0; sMat.opacity = lerp(sMat.opacity, spd > 1.2 ? 0.6 : spd > 0.6 ? 0.1 : 0, 0.1);
    for (let i = 0; i < SL; i++) { const s = sSeed[i]; s.z -= dt * (30 + spd * 50); if (s.z < -6) s.z += 66; const len = 1 + spd * 3; sPos[i * 6] = s.x + laneX * 0.5; sPos[i * 6 + 1] = s.y; sPos[i * 6 + 2] = -s.z; sPos[i * 6 + 3] = s.x + laneX * 0.5; sPos[i * 6 + 4] = s.y; sPos[i * 6 + 5] = -s.z - len; }
    sGeo.attributes.position.needsUpdate = true;
    // 追っ手
    { const ch = st.chaser || 0; const hz = lerp(9, 2.6, Math.min(1, Math.max(0, (ch - 0.35) / 0.5))); hunter.position.set(laneX - 2.1 + Math.sin(st.mbeat * 1.7) * 0.25, 2.5 + Math.sin(st.mbeat * 2.3) * 0.15, lerp(hunter.position.z, hz, 0.05)); hunter.userData.ring.rotation.z += dt * 12; hunter.rotation.y = 0.5; hunterLight.position.copy(hunter.position); hunterLight.intensity = ch > 0.5 ? 20 + 20 * pulse : 0;
      if (rival) { hunter.visible = false; const z = hunter.position.z; rival.root.visible = z < 5.2; rival.root.position.set(laneX - 1.35 + Math.sin(st.mbeat * 1.7) * 0.15, 0, z - 1.2); if (rival.root.visible) rival.animate({ dt, beat, cue: null, sk: SKILLS.rest, vx: 0, mode: 'chase' }); hunterLight.position.set(rival.root.position.x, 1.4, rival.root.position.z); } }
    // カメラ
    fov = lerp(fov, spd > 1.2 ? 72 : spd < 0.3 ? 56 : 62, 1 - Math.exp(-dt * 4)); const portrait = cam.aspect < 1; cam.fov = fov + (portrait ? 22 : 0); cam.updateProjectionMatrix();
    camShake = Math.max(st.shake || 0, camShake * 0.86);
    cam.position.set(laneX * 0.72 + (Math.random() - 0.5) * camShake * 0.2, 2.25 + Math.sin(beat * Math.PI) * 0.025 + (Math.random() - 0.5) * camShake * 0.2, portrait ? 5.4 : 3.7);
    cam.lookAt(laneX * 0.85, 1.15, -8);
    if (composer) composer.render(); else renderer.render(scene, cam);
    // うごきガイド：同じ人を 正面から（かがみのように 左右そのまま）かげ絵で うつす
    if (st.pip && human) {
      const p = st.pip; const back = sk.behind || sk.handle === 'swing' || sk.combo === 'behind'; const legv = sk.legs || sk.combo === 'legs'; gfloor.scale.y = legv ? 14 : 1; if (legv) { const hz = human.root.position.z; gcam.position.set(laneX - 4.3, 0.95, hz - 1.5); gcam.lookAt(laneX, 0.78, hz); } else { const sd = !back && cue && (cue.hand === 'R' || cue.hand === 'L') && !sk.lane ? (cue.hand === 'L' ? -1 : 1) : 0; gcam.position.set(laneX + sd * 2.3, sd ? 0.85 : 1.0, back ? 4.3 : sd ? -3.7 : -4.3); gcam.lookAt(laneX, sd ? 0.8 : 0.92, 0); if (sd) gfloor.scale.y = 14; } gcam.updateProjectionMatrix(); // お手本は かがみに しない（右手は 右手の ほうに 見える）
      const bp0 = ball.position.clone(), b20 = ball2.position.clone(); const gb = human.animate({ dt, beat, cue, sk, vx: 0, guide: true }); ball.position.set(laneX + gb.x, gb.y, gb.z); { const g2 = human.ball2(); if (g2) ball2.position.set(laneX + g2.x, g2.y, g2.z); } trail.visible = false;
      const bg = scene.background; const fg = scene.fog; scene.background = null; scene.fog = null; human.setSilhouette(true, sk.c); const bm = ball.material; ball.material = pipBall; ball2.material = pipBall;
      renderer.setRenderTarget(null); renderer.autoClear = false; renderer.setScissorTest(true); renderer.setScissor(p.x, H - p.y - p.h, p.w, p.h); renderer.setViewport(p.x, H - p.y - p.h, p.w, p.h); renderer.setClearColor(0x050a22, 1); renderer.clear(true, true, false);
      renderer.render(scene, gcam);
      renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); renderer.autoClear = true; human.setSilhouette(false); ball.position.copy(bp0); ball2.position.copy(b20); trail.visible = true; ball.material = bm; ball2.material = bm; scene.background = bg; scene.fog = fg;
    }
  }
  const v = new THREE.Vector3();
  function project(x, y, z) { v.set(x, y, z).project(cam); return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H]; }
  function dispose() { if (human) { scene.remove(human.root); human.dispose(); } for (const h of [...defs, rival, bossH, midH]) if (h) { scene.remove(h.root); h.dispose(); } env.dispose(); for (const [, gp] of gates) (gp.userData.mats || []).forEach((m) => m.dispose()); disposables.forEach((d) => { try { d.dispose(); } catch (e) { /* noop */ } }); }
  const ready = () => (!env.ready || env.ready()) && (!human || o.sprite === false || !!pspr);
  return { render, resize, burst, project, dispose, ready, get laneX() { return laneX; }, bossPos: () => boss.position, midPos: () => midH ? midH.root.position : boss.position };
}
