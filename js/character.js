// プレイヤーの人型モデルと、バスケの動き（骨を IK で動かす）
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { comboState } from './data.js';

let cached = null;
export async function loadHuman() {
  if (cached) return cached;
  const b64 = (await import('../models/human_model.js')).default;
  const bin = atob(b64); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const gltf = await new GLTFLoader().parseAsync(buf.buffer, '');
  cached = gltf.scene; return cached;
}

// ひな型から 1体ぶんを 作る（骨と メッシュを 新しく つなぎなおす）
function cloneModel(src) {
  const dst = src.clone(true); const sm = [], dm = []; const byName = {};
  src.traverse((o) => { if (o.isSkinnedMesh) sm.push(o); }); dst.traverse((o) => { if (o.isSkinnedMesh) dm.push(o); if (o.isBone) byName[o.name] = o; });
  dm.forEach((m, i) => { const s0 = sm[i]; m.geometry = s0.geometry.clone(); const sk = new THREE.Skeleton(s0.skeleton.bones.map((b) => byName[b.name]), s0.skeleton.boneInverses); m.bind(sk, s0.bindMatrix); });
  return dst;
}

const V = () => new THREE.Vector3(); const Q = () => new THREE.Quaternion();
const lerp = (a, b, t) => a + (b - a) * t; const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (x) => x * x * (3 - 2 * x); const TAU2 = Math.PI * 2;

// アニメ風の セルシェーディング用の グラデーション（3だんかい の あかるさ）
let toonGrad = null;
function gradientMap3() {
  if (toonGrad) return toonGrad;
  const data = new Uint8Array([80, 80, 80, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1); t.needsUpdate = true; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  toonGrad = t; return t;
}

export function makeHuman(template, suit = '#3df5ff', opt = {}) {
  const model = cloneModel(template);
  const root = new THREE.Group(); const holder = new THREE.Group(); holder.rotation.y = Math.PI; holder.add(model); root.add(holder);
  const B = {}; let skinned = null;
  model.traverse((o) => { if (o.isBone) B[o.name.replace('mixamorig', '')] = o; if (o.isSkinnedMesh) { skinned = o; o.frustumCulled = false; } });
  // 見た目：骨ごとに 色を ぬりわけて、ユニフォーム・はだ・くつ に見せる
  const suitC = new THREE.Color(suit); const SKIN = new THREE.Color(opt.skin || '#e8b48a'); const JERSEY = suitC.clone().lerp(new THREE.Color('#ffffff'), 0.06); const SHORTS = suitC.clone().multiplyScalar(0.82); const TRIM = new THREE.Color(opt.trim || '#ffffff'); const SHOE = new THREE.Color(opt.shoe || '#f6f8ff'); const SOCK = new THREE.Color('#ffffff'); const HAIR = new THREE.Color('#2a1c14');
  // ユニフォーム：そでなしの ジャージ（わきに ライン）＋ ひざ上までの ゆったり パンツ（よこに ライン）＋ ハイカットの くつ
  const regionOf = (name, x, y) => { const n = name.replace('mixamorig', ''); const ax = Math.abs(x);
    if (/Foot|Toe/.test(n)) return y > 0.085 && y < 0.12 ? TRIM : SHOE;
    if (/UpLeg|Hips/.test(n)) return y > 1.075 ? TRIM : y < 0.555 ? TRIM : ax > 0.185 && y < 0.95 ? TRIM : SHORTS;
    if (/^(Left|Right)Leg/.test(n)) return y < 0.2 ? SHOE : y < 0.33 ? SOCK : SKIN;
    if (/Spine/.test(n)) return y > 1.47 && ax < 0.075 ? SKIN : ax > 0.15 && y < 1.36 ? TRIM : JERSEY;
    if (/Shoulder/.test(n)) return ax < 0.15 ? JERSEY : SKIN;
    if (/Neck/.test(n)) return SKIN; if (/Head/.test(n)) return y > 1.62 ? HAIR : SKIN; return SKIN; };
  const cloth = (c) => c === JERSEY || c === SHORTS || c === TRIM;
  const meshes = []; const mats = []; const outlines = []; const outlineMats = []; const tmpV = new THREE.Vector3(); const geos = []; let zBack = -1, zFront = 1;
  root.updateMatrixWorld(true);
  model.traverse((o) => { if (!o.isSkinnedMesh) return; const g = o.geometry; geos.push(g); const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, pos = g.attributes.position, nor = g.attributes.normal; const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      const bn = o.skeleton.bones[best].name; tmpV.fromBufferAttribute(pos, i); const x = tmpV.x, y = tmpV.y, z = tmpV.z; const c = regionOf(bn, x, y);
      // うらがわ・つなぎ目を ほんの少し くらくして、のっぺりしすぎないように（かんいAO）
      const ao = nor ? 0.86 + 0.14 * clamp(nor.getY(i) * 0.5 + 0.5, 0, 1) : 1;
      col[i * 3] = c.r * ao; col[i * 3 + 1] = c.g * ao; col[i * 3 + 2] = c.b * ao;
      // 服の ところは 少し ふくらませて、ぴったり しすぎない ように
      if (nor && cloth(c) && !/Foot|Toe/.test(bn)) { const legs = /UpLeg|Hips/.test(bn); const k = legs ? 0.02 + 0.035 * clamp((0.95 - y) / 0.35, 0, 1) : 0.014; pos.setXYZ(i, x + nor.getX(i) * k, y + nor.getY(i) * k, z + nor.getZ(i) * k); }
      if (/Spine/.test(bn) && Math.abs(x) < 0.06 && y > 1.2 && y < 1.4) { zBack = Math.max(zBack, -z); zFront = Math.max(zFront === 1 ? -1 : zFront, z); } }
    pos.needsUpdate = true; g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // アニメっぽい セルシェーディング（段々の 色わけ）に
    const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap3(), emissive: 0x1a1410, emissiveIntensity: 0.22 }); o.material = m; meshes.push(o); mats.push(m);
    // ふちどり（アウトライン）：ひとまわり 大きい 黒の うらめんメッシュを かさねる
    const om = new THREE.MeshBasicMaterial({ color: 0x120e0c, side: THREE.BackSide }); om.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * 0.013;'); };
    const ol = new THREE.SkinnedMesh(g, om); ol.bind(o.skeleton, o.bindMatrix); ol.frustumCulled = false;
    ol.userData.par = o.parent || model; outlines.push(ol); outlineMats.push(om); });
  outlines.forEach((ol) => { ol.userData.par.add(ol); if (opt.guide !== false) ol.layers.enable(1); });
  // ヘッドバンド
  const band = new THREE.MeshBasicMaterial({ color: suitC }); const tor = new THREE.TorusGeometry(1, 0.22, 8, 20);
  const attach = (bone, r, y, rx) => { if (!bone) return; const t = new THREE.Mesh(tor, band); const ws = bone.getWorldScale(new THREE.Vector3()).x || 1; t.scale.setScalar(r / ws); t.position.y = y / ws; t.rotation.x = rx; bone.add(t); meshes.push(t); };
  // せばんごう（せなか と むね）
  const numMats = [];
  if (B.Spine2) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g2 = cv.getContext('2d'); g2.font = '900 104px Arial, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.lineWidth = 10; g2.strokeStyle = 'rgba(0,0,0,.55)'; g2.strokeText(String(opt.num ?? 7), 64, 70); g2.fillStyle = '#' + TRIM.getHexString(); g2.fillText(String(opt.num ?? 7), 64, 70);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const nm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }); numMats.push(nm, tex); const pg = new THREE.PlaneGeometry(1, 1); geos.push(pg);
    const inv = new THREE.Matrix4().copy(B.Spine2.matrixWorld).invert(); const mw = new THREE.Matrix4();
    for (const [zz, ry, sz, yy] of [[-(zBack + 0.03), Math.PI, 0.25, 1.3], [zFront + 0.03, 0, 0.13, 1.36]]) { const pl = new THREE.Mesh(pg, nm); const lm = new THREE.Matrix4().compose(new THREE.Vector3(0, yy, zz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sz, sz, sz)); mw.multiplyMatrices(model.matrixWorld, lm); mw.premultiply(inv); mw.decompose(pl.position, pl.quaternion, pl.scale); pl.userData.mat0 = nm; B.Spine2.add(pl); meshes.push(pl); } }
  const sil = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const setSilhouette = (on, color) => { if (on) sil.color.set(color); let i = 0; for (const m of meshes) { if (m.isSkinnedMesh) m.material = on ? sil : mats[i++]; else if (m.userData.mat0) m.visible = !on; else m.material = on ? sil : band; } outlines.forEach((ol) => { ol.visible = !on; }); };
  if (opt.guide !== false) meshes.forEach((m) => m.layers.enable(1));
  const dispose = () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); numMats.forEach((m) => m.dispose()); band.dispose(); tor.dispose(); sil.dispose(); outlineMats.forEach((m) => m.dispose()); if (faceMat) { faceMat.dispose(); faceTex.dispose(); } };
  root.updateMatrixWorld(true);
  const wp = (b) => b.getWorldPosition(V());
  const L = { up: wp(B.LeftUpLeg).distanceTo(wp(B.LeftLeg)), lo: wp(B.LeftLeg).distanceTo(wp(B.LeftFoot)), ua: wp(B.LeftArm).distanceTo(wp(B.LeftForeArm)), fa: wp(B.LeftForeArm).distanceTo(wp(B.LeftHand)) };
  const hipsBind = wp(B.Hips).y; const ankleH = wp(B.LeftFoot).y; const hipW = Math.abs(wp(B.LeftUpLeg).x);
  const t1 = V(), t2 = V(), t3 = V(), q1 = Q(), q2 = Q(), q3 = Q();

  function preWorld(bone, qW) { bone.getWorldQuaternion(q2); q2.premultiply(qW); bone.parent.getWorldQuaternion(q3).invert(); bone.quaternion.copy(q3.multiply(q2)); bone.updateMatrixWorld(true); }
  function aim(bone, child, target) { bone.getWorldPosition(t1); child.getWorldPosition(t2); t2.sub(t1).normalize(); t3.copy(target).sub(t1).normalize(); q1.setFromUnitVectors(t2, t3); preWorld(bone, q1); }
  const ka = V(), kd = V(), kp = V(), kj = V();
  function ik(b0, b1, b2, target, pole, l1, l2) {
    b0.getWorldPosition(ka); kd.copy(target).sub(ka); let d = kd.length(); d = clamp(d, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.005); kd.normalize();
    const proj = (l1 * l1 + d * d - l2 * l2) / (2 * d); const h = Math.sqrt(Math.max(0, l1 * l1 - proj * proj));
    kp.copy(pole).addScaledVector(kd, -pole.dot(kd)).normalize(); kj.copy(ka).addScaledVector(kd, proj).addScaledVector(kp, h);
    aim(b0, b1, kj); kj.copy(ka).addScaledVector(kd, d); aim(b1, b2, kj);
  }
  const axisQ = (ax, ang) => Q().setFromAxisAngle(ax, ang);
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);

  // なめらかに つなぐための 状態
  const mkS = () => ({ fl: V().set(-0.2, 0, 0), fr: V().set(0.2, 0, 0), hl: V().set(-0.3, 0.9, -0.2), hr: V().set(0.3, 0.9, -0.2), hip: V().set(0, hipsBind, 0), pitch: 0.2, roll: 0, twist: 0, ball: V().set(0.4, 0.8, -0.3), ball2: V().set(-0.4, 0.8, -0.3), has2: false });
  const SM = mkS(), SG = mkS(); let S = SM;
  const T = { fl: V(), fr: V(), hl: V(), hr: V(), hip: V() };
  const w = V(), pole = V();

  // st: { dt, beat, cue, sk, vx, noBall }
  function animate(st) {
    const { dt, beat, cue, sk } = st; const G = !!st.guide; S = G ? SG : SM; const cb = cue ? beat - cue.b0 : 99; const ph = beat - Math.floor(beat);
    const hold = !cue ? false : (cue.hand === 'hold' || cue.ballMode === 'hold' || cue.ballMode === 'none');
    const hs = cue && cue.hand === 'L' ? -1 : 1; const dir = (cue && cue.dir) || 1; const id = cue ? cue.skill : 'rest';
    const sp = cue ? (cue.sp ?? 1) : 1; const dbl = sk.dbl ? 2 : 1; const bph = (beat * dbl) % 1; const bounce = Math.abs(Math.sin(Math.PI * bph));
    // --- もとになる しせい ---
    let comboStag = 0; let handleMode = null; let two1x = 0.42;
    let crouch = 0.35, Wd = 0.2, pitch, roll = 0, twist = 0, hipX = 0, hipZ = 0, rootY = 0, stride = 0.24, lift = 0.11, cad = 1, runDir = 1;
    let bx = hs * 0.4, by = 0.2, bz = -0.3, handSide = hs, both = false, guard = false, amp = 0.62;
    const moving = !G && !hold && sp > 0.3;
    if (sk.low) { crouch = 0.95; Wd = 0.3; amp = 0.3; stride = 0.12; lift = 0.06; guard = true; }
    if (id === 'pound') { crouch = 0.55; amp = 0.8; guard = true; }
    if (id === 'fast') { crouch = 0.5; stride = 0.42; lift = 0.2; cad = 2; amp = 0.5; }
    if (id === 'hesi') { crouch = 0.02; stride = 0.07; lift = 0.04; amp = 0.78; }
    if (id === 'back') { runDir = -1; stride = 0.2; twist = -hs * 0.55; crouch = 0.6; bz = 0.12; bx = hs * 0.46; guard = true; }
    if (id === 'drive') { crouch = 0.75; stride = 0.5; lift = 0.2; cad = 2; bz = -0.55; bx = hs * 0.5; amp = 0.55; guard = true; }
    if (id === 'rest') { handSide = Math.floor(beat / 2) % 2 ? 1 : -1; bx = handSide * 0.4; }
    by = 0.13 + bounce * amp * (1 - crouch * 0.25);
    if (sk.inout) { const io = Math.sin(Math.PI * ph); bx = hs * (0.46 - 0.34 * io); roll = -hs * 0.1 * io; hipX = -hs * 0.06 * io; crouch = 0.6; Wd = 0.28; }
    if (sk.vmove) { const c = Math.cos(Math.PI * cb); crouch = 0.72; Wd = 0.3; stride = 0; guard = true; by = 0.13 + Math.abs(c) * 0.42;
      if (sk.vmove === 'front') { bx = c * 0.4 + hs * 0.06; bz = -0.4; hipX = c * 0.04; twist = -c * 0.15 * 1; }
      else if (sk.vmove === 'side') { bx = hs * 0.44; bz = -0.02 - c * 0.34; twist = hs * c * 0.12; }
      else { bx = c * 0.34 + hs * 0.05; bz = 0.36; twist = hs * 0.25 + c * 0.2; crouch = 0.5; } }
    if (cue && (cue.hand === 'alt' || cue.hand === 'alt1')) {
      const k = cue.hand === 'alt1' ? Math.min(1, cb) : cb * (sk.quick || 1); const s0 = cue.hand0 === 'L' ? -1 : 1; const c = Math.cos(Math.PI * k); const xx = c * s0;
      crouch = 0.72; Wd = 0.32; stride = 0; hipX = xx * 0.07; bx = xx * 0.42; by = 0.13 + Math.abs(c) * 0.42; bz = -0.36; handSide = xx >= 0 ? 1 : -1; guard = true;
      if (sk.legs) { bz = -0.02; bx = xx * 0.36; by = 0.13 + Math.abs(c) * 0.36; }
      if (sk.behind) { bz = 0.34; bx = xx * 0.4; twist = xx * 0.3; crouch = 0.5; by = 0.13 + Math.abs(c) * 0.5; }
      if (sk.fig8) { crouch = 0.95; Wd = 0.4; bx = xx * 0.42; bz = Math.sin(TAU2 * k) * 0.24; by = 0.12 + Math.abs(Math.sin(TAU2 * k)) * 0.16; hipX = xx * 0.05; }
      if (cue.hand === 'alt1' && cb >= 1) { handSide = -s0; bx = -s0 * 0.42; by = 0.13 + bounce * 0.5; }
    }
    let spinExtra = 0; let ball2 = null; let twoHands = false;
    if (sk.pocket) { const up = Math.abs(Math.sin(Math.PI * ph)); const hang = smooth(clamp((up - 0.55) / 0.4, 0, 1)); crouch = 0.68; Wd = 0.28; guard = true; by = 0.13 + Math.pow(up, 0.45) * 0.6; bx = hs * (0.42 + 0.06 * hang); bz = -0.3 + 0.5 * hang; twist = hs * 0.3 * hang; }
    if (cue && cue.hand === 'combo') {
      const cs = comboState(sk, cue.hand0, cb); const w = Math.sin(Math.PI * cs.chg) * (cs.n ? 1 : 0); crouch = 0.6 + 0.15 * w; Wd = 0.3; stride = 0; guard = true; handSide = cs.x >= 0 ? 1 : -1; hipX = cs.x * 0.05;
      bx = cs.x * 0.42; by = 0.13 + Math.abs(Math.sin(Math.PI * cb)) * (cs.n ? 0.42 : 0.6); bz = -0.32;
      if (sk.combo === 'cross') bz = -0.32 - 0.08 * w;
      if (sk.combo === 'legs') { bz = -0.32 + 0.3 * w; const tl = (sk.cyc || 4) - cs.t; comboStag = -cs.start * (sk.reps === 1 && tl < 0.5 ? tl * 4 - 1 : 1); }
      if (sk.combo === 'behind') { bz = -0.32 + 0.68 * w; twist = cs.x * 0.3 * w; }
      if (sk.combo === 'roll') { spinExtra = cs.n ? smooth(cs.chg) * Math.PI * 2 * cs.start : 0; bx = cs.x * 0.3; bz = -0.28; by = 0.13 + Math.abs(Math.sin(Math.PI * cb)) * (cs.n ? 0.3 : 0.6); }
    }
    if (sk.semi) { const a = Math.PI / 2 * (1 - Math.cos(Math.PI * cb / 2)); crouch = 0.75; Wd = 0.3; stride = 0; guard = true; bx = hs * (0.16 + 0.32 * Math.sin(a)); bz = -0.06 - 0.36 * Math.cos(a); by = 0.13 + Math.abs(Math.sin(Math.PI * cb)) * 0.4; twist = hs * 0.3 * Math.max(0, -Math.cos(a)); }
    if (cue && cue.hand === 'two') { twoHands = true; stride = 0; Wd = 0.3; const m = sk.low ? 2 : 1; const amp2 = sk.high ? 0.95 : sk.low ? 0.24 : 0.55; crouch = sk.low ? 0.95 : sk.high ? 0.2 : 0.62;
      const p1 = Math.abs(Math.sin(Math.PI * cb * m)); let p2 = sk.two === 'alt' ? Math.abs(Math.cos(Math.PI * cb)) : p1; let x1 = 0.42, x2 = -0.42;
      if (sk.two === 'v') { const c = Math.cos(Math.PI * cb); x1 = 0.42 + 0.17 * c; x2 = -0.42 - 0.17 * c; p2 = Math.abs(c) * 0.8; bx = x1; by = 0.13 + Math.abs(c) * 0.8 * amp2; }
      else if (sk.two === 'par') { const c = Math.cos(Math.PI * cb); x1 = 0.42 + 0.17 * c; x2 = -0.42 + 0.17 * c; p2 = Math.abs(c) * 0.8; bx = x1; by = 0.13 + Math.abs(c) * 0.8 * amp2; } // 2つ いっしょに おなじ むきへ
      else { bx = x1; by = 0.13 + p1 * amp2; }
      bz = -0.3; ball2 = S.ball2.set(x2, 0.13 + p2 * amp2, -0.3); two1x = x1; }
    pitch = 0.16 + crouch * 0.4 + (id === 'drive' ? 0.25 : 0) + (id === 'fast' ? 0.15 : 0) - (id === 'back' ? 0.2 : 0);
    // --- 足 ---
    T.fl.set(-Wd, 0, 0); T.fr.set(Wd, 0, 0);
    if (moving && stride > 0) {
      const phi = beat * Math.PI * cad * runDir;
      for (const [f, s] of [[T.fl, 0], [T.fr, Math.PI]]) { const th = phi + s; f.z = stride * Math.cos(th); f.y = Math.max(0, Math.sin(th)) * lift; f.x *= guard || crouch >= 0.6 ? 0.7 : 0.5; }
      rootY += Math.abs(Math.sin(beat * Math.PI * cad)) * 0.035;
    } else if (!hold) { rootY -= bounce * 0.02; }
    if (sk.legs) { const sg = -Math.tanh(Math.cos(Math.PI * cb) * 3) * (cue.hand0 === 'L' ? -1 : 1); T.fl.z = 0.3 * sg; T.fr.z = -0.3 * sg; const hop = Math.pow(Math.abs(Math.sin(Math.PI * cb)), 6) * 0.07; T.fl.y = T.fr.y = hop; Wd = 0.22; T.fl.x = -0.22; T.fr.x = 0.22; }
    if (comboStag) { T.fl.z = 0.3 * comboStag; T.fr.z = -0.3 * comboStag; T.fl.x = -0.24; T.fr.x = 0.24; }
    // お手本（右下）は その場で つく しせい：はんたいの足を 前に、こしを おとして 前かがみ
    if (G && cue && !hold && (cue.hand === 'R' || cue.hand === 'L') && !sk.lane) {
      const fb = hs > 0 ? T.fr : T.fl, ff = hs > 0 ? T.fl : T.fr; Wd = Math.max(Wd, 0.25); fb.set(hs * Wd, 0, 0.13); ff.set(-hs * Wd, 0, -0.17);
      crouch = Math.max(crouch, 0.62); pitch += 0.2; guard = true; if (!twist) twist = hs * 0.12;
      if (!sk.vmove && !sk.inout && !sk.semi && !sk.pocket && id !== 'back') { bx = hs * 0.4; bz = -0.2; }
      by = Math.min(by, 0.13 + (by - 0.13) * 0.8);
    }
    // 敵（ディフェンス／おいかける）の うごき
    // ディフェンスの しせい：ひざを 深く おとし、足を 広く、うでを 大きく 広げる（本物の ディフェンスの かまえを イメージ）
    if (st.mode === 'defend') { const sh = Math.sin(beat * Math.PI); crouch = 0.98; pitch = 0.38; T.fl.set(-0.46 + sh * 0.07, Math.max(0, sh) * 0.05, 0); T.fr.set(0.46 + sh * 0.07, Math.max(0, -sh) * 0.05, 0); hipX = sh * 0.06; rootY = 0; }
    if (st.mode === 'chase') { const phi = beat * Math.PI * 2; crouch = 0.5; pitch = 0.5; T.fl.set(-0.14, Math.max(0, Math.sin(phi)) * 0.2, 0.42 * Math.cos(phi)); T.fr.set(0.14, Math.max(0, -Math.sin(phi)) * 0.2, -0.42 * Math.cos(phi)); }
    // よこへの うごき（ステップ）
    const lat = Math.min(1, Math.abs(st.vx) / 2.2);
    if (lat > 0.08) { const t = performance.now() / 1000 * Math.PI * 6; T.fl.y += Math.max(0, Math.sin(t)) * 0.1 * lat; T.fr.y += Math.max(0, -Math.sin(t)) * 0.1 * lat; T.fl.x -= 0.08 * lat; T.fr.x += 0.08 * lat; roll += clamp(-st.vx * 0.06, -0.3, 0.3); crouch = Math.max(crouch, 0.65); }
    // --- ボールを持つ ワザ ---
    if (hold) {
      both = true; crouch = 0.6; Wd = 0.3; T.fl.set(-Wd, 0, 0); T.fr.set(Wd, 0, 0); bx = hs * 0.2; bz = -0.26; by = -1; guard = false; pitch = 0.4;
      if (sk.jump) { if (cb < 1) { rootY = Math.sin(Math.PI * cb) * 0.32; crouch = 0.15; T.fl.x = -0.13; T.fr.x = 0.13; T.fl.y = T.fr.y = 0.08 * Math.sin(Math.PI * cb); } else { crouch = 0.95 - Math.min(0.3, (cb - 1) * 0.4); Wd = 0.34; T.fl.x = -Wd; T.fr.x = Wd; } }
      if (sk.turn) { const psi = Math.sin(cb * Math.PI * 0.5) * 1.25; twist = psi * 0.75; T.fl.set(-0.2, 0, 0); T.fr.set(-0.2 + 0.5 * Math.cos(psi), Math.abs(Math.sin(cb * Math.PI)) * 0.07, -0.5 * Math.sin(psi)); bx = Math.sin(psi) * -0.1 + 0.15; }
      if (sk.jab) { const j = Math.sin(Math.min(1, (cb % 1) * 1.7) * Math.PI); const f = dir > 0 ? T.fr : T.fl; f.x += dir * 0.34 * j; f.z -= 0.28 * j; f.y += Math.sin(Math.min(1, (cb % 1) * 1.7) * Math.PI * 2) > 0 ? 0.06 * j : 0; hipX = dir * 0.1 * j; roll = -dir * 0.08 * j; bx = -dir * 0.24; crouch = 0.7; }
      if (id === 'stance') { crouch = 0.75 + Math.sin(beat * Math.PI) * 0.05; }
      if (sk.handle) { handleMode = sk.handle; crouch = 0.45; pitch = 0.25; const hy = hipsBind - crouch * 0.24;
        if (sk.handle === 'wrap') { const th = cb * Math.PI; bx = Math.sin(th) * 0.33; bz = -Math.cos(th) * 0.27 + 0.02; by = hy + 0.02; both = false; handSide = bx >= 0 ? 1 : -1; if (Math.abs(bx) < 0.1) both = true; }
        if (sk.handle === 'head') { const th = cb * Math.PI; crouch = 0.25; bx = Math.sin(th) * 0.24; bz = -Math.cos(th) * 0.24 + 0.02; by = hipsBind + 0.66; both = false; handSide = bx >= 0 ? 1 : -1; if (Math.abs(bx) < 0.08) both = true; }
        if (sk.handle === 'knees') { const th = cb * Math.PI; crouch = 1.0; pitch = 0.75; T.fl.x = -0.1; T.fr.x = 0.1; bx = Math.sin(th) * 0.3; bz = -Math.cos(th) * 0.28; by = 0.5; both = false; handSide = bx >= 0 ? 1 : -1; if (Math.abs(bx) < 0.1) both = true; }
        if (sk.handle === 'leg') { const side = Math.floor(cb / 4) % 2 ? -1 : 1; const th = cb * Math.PI * side; crouch = 1.0; pitch = 0.7; T.fl.x = -0.36; T.fr.x = 0.36; bx = side * 0.36 + Math.sin(th) * 0.22; bz = -Math.cos(th) * 0.24; by = 0.45; both = false; handSide = bx >= side * 0.36 ? 1 : -1; }
        if (sk.handle === 'eight') { const th = cb * Math.PI * 0.5; crouch = 1.0; pitch = 0.7; T.fl.x = -0.38; T.fr.x = 0.38; bx = Math.sin(th) * 0.5; bz = Math.sin(2 * th) * 0.24; by = 0.42; both = false; handSide = bx >= 0 ? 1 : -1; if (Math.abs(bx) < 0.08) both = true; }
        if (sk.handle === 'swing') { const u = Math.sin(Math.PI * cb); bx = u * 0.36; bz = 0.3; by = hy - 0.08 + Math.abs(u) * 0.06; both = false; handSide = bx >= 0 ? 1 : -1; if (Math.abs(bx) < 0.08) both = true; }
        if (sk.handle === 'pull') { const u = Math.sin(Math.PI * cb); const a = smooth(Math.abs(u)); bx = Math.sign(u) * 0.3 * a; bz = -0.55 + 0.6 * a; by = hy + 0.22 - 0.2 * a; twist = Math.sign(u) * 0.35 * a; crouch = 0.6; both = true; }
      }
    }
    const hipY = hipsBind - crouch * 0.24 + rootY;
    if (by < 0) by = hipY - 0.06;
    T.hip.set(hipX, hipY, hipZ - (pitch - 0.2) * 0.12);
    // --- なめらかに ---
    const kf = 1 - Math.exp(-dt * 16), kh = 1 - Math.exp(-dt * 22), kb = 1 - Math.exp(-dt * 12);
    S.fl.lerp(T.fl, kf); S.fr.lerp(T.fr, kf); S.hip.lerp(T.hip, kb); S.pitch = lerp(S.pitch, pitch, kb); S.roll = lerp(S.roll, roll, kb); S.twist = lerp(S.twist, twist, kb);
    const spinA = sk.spin ? smooth(clamp(cb / 1.6, 0, 1)) * Math.PI * 2 * dir : spinExtra; holder.rotation.y = Math.PI + spinA;
    const lbx = bx, lbz = bz;
    if (spinA) { const ca = Math.cos(spinA), sa = Math.sin(spinA); bx = lbx * ca + lbz * sa; bz = -lbx * sa + lbz * ca; }
    S.ball.set(bx, by, bz); S.has2 = !!ball2;
    // 手の ねらい
    if (st.mode) { handSide = 0; both = false; guard = false; twoHands = false; }
    bx = lbx; bz = lbz;
    const handY = Math.max(by + 0.13, S.hip.y - 0.36);
    for (const [h, s] of [[T.hl, -1], [T.hr, 1]]) {
      if (st.mode === 'defend') h.set(s * 0.76, S.hip.y + 0.44 + Math.sin(beat * Math.PI * 2 + s) * 0.16, -0.3);
      else if (st.mode === 'chase') { const sw = Math.sin(beat * Math.PI * 2 + (s > 0 ? 0 : Math.PI)); h.set(s * 0.3, S.hip.y + 0.25 + Math.max(0, sw) * 0.15, -0.3 - sw * 0.25); }
      else if (twoHands) h.set(s > 0 ? two1x : S.ball2.x, Math.max((s > 0 ? by : S.ball2.y) + 0.13, S.hip.y - 0.36), -0.28);
      else if (both) h.set(bx + s * 0.13, by + 0.02, bz);
      else if (s === handSide) h.set(bx + s * 0.02, handY, bz + 0.02);
      else if (guard) h.set(s * 0.3, S.hip.y + 0.16, -0.36);
      else { const sw = moving ? Math.sin(beat * Math.PI * cad + (s > 0 ? 0 : Math.PI)) * 0.2 : 0; h.set(s * 0.3, S.hip.y - 0.02 + Math.abs(sw) * 0.1, -0.08 + sw); }
    }
    S.hl.lerp(T.hl, kh); S.hr.lerp(T.hr, kh);
    // ひざの むき：はしっているときは まっすぐ、かまえ・その場の ワザ・ディフェンスのときは 外に ひらく
    { const run = moving && stride > 0 && !guard && !hold && !st.mode && crouch < 0.6; S.knee = lerp(S.knee ?? 1, run ? 0 : 1, 1 - Math.exp(-dt * 8)); }

    // --- 骨に あてはめる ---
    model.traverse((o) => { if (o.isBone) { o.position.copy(o.userData.p0 || (o.userData.p0 = o.position.clone())); o.quaternion.copy(o.userData.q0 || (o.userData.q0 = o.quaternion.clone())); } });
    root.updateMatrixWorld(true);
    const yq = Q().setFromAxisAngle(Y, spinA); const rq = root.getWorldQuaternion(Q()).multiply(yq); const toW = (v) => root.localToWorld(w.copy(v).applyQuaternion(yq)); const dirW = (x, y, z) => pole.set(x, y, z).applyQuaternion(rq);
    B.Hips.parent.worldToLocal(toW(S.hip)); B.Hips.position.copy(w); B.Hips.updateMatrixWorld(true);
    const rx = X.clone().applyQuaternion(rq), ry = Y.clone().applyQuaternion(rq), rz = Z.clone().applyQuaternion(rq);
    preWorld(B.Hips, axisQ(ry, S.twist * 0.35).multiply(axisQ(rz, S.roll * 0.5)).multiply(axisQ(rx, -S.pitch * 0.35)));
    for (const b of [B.Spine, B.Spine1, B.Spine2]) preWorld(b, axisQ(ry, S.twist * 0.22).multiply(axisQ(rz, S.roll * 0.17)).multiply(axisQ(rx, -S.pitch * 0.22)));
    preWorld(B.Neck, axisQ(rx, S.pitch * 0.45)); preWorld(B.Head, axisQ(ry, -S.twist * 0.5).multiply(axisQ(rx, S.pitch * 0.3)));
    // 足
    const foot = (up, lo, ft, toe, tgt, s) => { const a = V().copy(tgt); a.y += ankleH; ik(up, lo, ft, toW(a).clone(), dirW(s * (0.06 + 0.36 * S.knee), 0.1, -1), L.up, L.lo); const tt = V().copy(tgt); tt.z -= 0.2; tt.x += s * 0.03; tt.y = Math.max(0.02, tgt.y * 0.6 + 0.02); aim(ft, toe, toW(tt).clone()); };
    foot(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, B.LeftToeBase, S.fl, -1); foot(B.RightUpLeg, B.RightLeg, B.RightFoot, B.RightToeBase, S.fr, 1);
    // うで
    const behind = lbz > 0.2;
    ik(B.LeftArm, B.LeftForeArm, B.LeftHand, toW(S.hl).clone(), dirW(-0.8, -0.3, behind ? -0.6 : 0.7), L.ua, L.fa);
    ik(B.RightArm, B.RightForeArm, B.RightHand, toW(S.hr).clone(), dirW(0.8, -0.3, behind ? -0.6 : 0.7), L.ua, L.fa);
    if (faceSp) { B.Head.getWorldPosition(t1); root.worldToLocal(t1); faceSp.position.copy(t1); }
    return S.ball;
  }
  // かお：イラストの スプライトを 頭の 位置に のせる（もとの 頭は 小さく たたむ）
  let faceSp = null, faceTex = null, faceMat = null;
  if (opt.bigHead && B.Head) B.Head.scale.setScalar(opt.bigHead); // イラストの 顔と 同じ テイスト（頭 大きめ）
  const setFace = (tex, i) => { if (!tex || !B.Head) return;
    if (!faceSp) { faceTex = tex.clone(); faceTex.repeat.set(0.1, 0.2); faceTex.needsUpdate = true; faceMat = new THREE.SpriteMaterial({ map: faceTex, transparent: true, alphaTest: 0.4 }); faceSp = new THREE.Sprite(faceMat); faceSp.center.set(0.5, 0.2); faceSp.scale.set(0.66, 0.66, 1); root.add(faceSp); B.Head.scale.setScalar(0.02); }
    faceTex.offset.set((i % 10) * 0.1, 1 - (Math.floor(i / 10) + 1) * 0.2); };
  // メインの画面では かくす（お手本の 小まど だけに 出す）。絵の スプライトで プレイヤーを 出すとき用
  const setMainVisible = (on) => { for (const m of [...meshes, ...outlines]) { if (on) m.layers.enable(0); else m.layers.disable(0); } };
  return { root, animate, setSilhouette, setFace, setMainVisible, dispose, ball2: () => (S.has2 ? S.ball2 : null), height: hipsBind / 0.53 };
}
