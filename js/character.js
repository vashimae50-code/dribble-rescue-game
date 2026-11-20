// プレイヤーの人型モデルと、バスケの動き（骨を IK で動かす）
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { comboState } from './data.js';

// Load a replaceable, rigged GLB from our own site when present. The existing
// embedded Mixamo model remains the safe fallback for all gameplay motions.
const modelCache = new Map();
// モデルごとの クリップ（技ID → 再生する はんい）。userData に 入れると clone で JSON に なって こわれるので 別に もつ
const clipsOf = new WeakMap();
// meshy-v1 の ドリブル（mixamo.com）：右手。0.137秒（手が いちばん上）から 0.957秒まで に 2回 ドリブル（1回 約0.41秒）。
// 0.957秒 以降は クリップの つなぎ目で 手が 小さく ゆれるので 使わない
// じゆうに ドリブル（rest）も 右手の ときは 同じ クリップ（左手の ときは IK）
// h：ドリブルの 高さ（waist＝こし、knee＝ひざ）、rate：1拍に なんかい つくか（0.5・1・2・3）
const DRIBBLE_R = { name: 'mixamo.com', t0: 0.137, t1: 0.957, n: 2, hand: 'Right', cueHand: 'R' };
const CLIP_DEFS = { 'meshy-v1': {
  right: { ...DRIBBLE_R, h: 'waist', rate: 1 }, rest: { ...DRIBBLE_R, h: 'waist', rate: 1 },
  low: { ...DRIBBLE_R, h: 'knee', rate: 2 }, fast: { ...DRIBBLE_R, h: 'waist', rate: 2 }, hesi: { ...DRIBBLE_R, h: 'waist', rate: 0.5 } } };
// ためし用：?dh=waist|knee（高さ）、?ds=0.5|1|2|3（1拍に なんかい）で クリップの 技 すべてを 上書き
const DRIBBLE_Q = (() => { try { const q = new URLSearchParams(location.search); const ds = Number(q.get('ds')); return { h: /^(waist|knee)$/.test(q.get('dh') || '') ? q.get('dh') : null, rate: [0.5, 1, 2, 3].includes(ds) ? ds : null }; } catch { return { h: null, rate: null }; } })();
const REQUIRED_BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Head',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
  'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand'];
function verifyRig(scene) {
  const bones = new Set(); let skinned = false;
  scene.traverse((o) => { if (o.isBone) bones.add(o.name.replace(/^mixamorig:?/, '')); if (o.isSkinnedMesh) skinned = true; });
  const missing = REQUIRED_BONES.filter((b) => !bones.has(b));
  if (!skinned || missing.length) throw new Error('No.7 GLB incompatible rig: ' + (missing.join(', ') || 'no skinned mesh'));
  return scene;
}
// どのモデルを つかうか：3D試験版（?character3d=1 や /preview/）は 新しい No.7 デフォルメ版（no7-chibi.glb）が 標準。
// ?model=legacy で 旧モデル、?model=no7-v2 で 等身版、?model=no7-chibi で どこでも デフォルメ版。読めない・骨が合わないときは 旧モデルに もどる
// ?model=meshy-v1 で Meshy＋Mixamo の キャラ（ためし。標準は かえない）
export function playerModelKey() {
  const q = new URLSearchParams(location.search); const mode = q.get('model');
  if (mode === 'legacy') return 'legacy';
  if (mode === 'no7-v2' || mode === 'no7-chibi' || mode === 'no7-meshy' || mode === 'meshy-v1') return mode;
  const preview3D = q.get('character3d') === '1' || location.pathname.includes('/preview/');
  return preview3D ? 'no7-chibi' : 'legacy';
}
// Meshy＋Mixamo（Blender書き出し）の GLB は、レスト姿勢の 原点が 体の まんなか（足うら y≈-0.95）。
// IK は レスト姿勢の 骨の 高さ（hipsBind・ankleH）を 使うので、足うらが y=0 に くるよう モデルを 持ちあげる
function groundRestPose(model) {
  model.position.y = 0; model.updateMatrixWorld(true); let minY = Infinity;
  model.traverse((o) => { if (!o.isSkinnedMesh) return; o.computeBoundingBox(); const b = o.boundingBox.clone().applyMatrix4(o.matrixWorld); minY = Math.min(minY, b.min.y); });
  if (Number.isFinite(minY)) { model.position.y = -minY; model.userData.restLift = -minY; model.updateMatrixWorld(true); }
}
async function loadLegacy() {
  if (modelCache.has('legacy')) return modelCache.get('legacy');
  const b64 = (await import('../models/human_model.js')).default;
  const bin = atob(b64); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const gltf = await new GLTFLoader().parseAsync(buf.buffer, '');
  modelCache.set('legacy', gltf.scene); return gltf.scene;
}
export async function loadHuman(key = playerModelKey()) {
  if (modelCache.has(key)) return modelCache.get(key);
  const files = { 'no7-v2': 'models/no7-v2.glb', 'no7-chibi': 'models/no7-chibi.glb', 'no7-meshy': 'models/no7-meshy.glb', 'meshy-v1': 'models/meshy-v1.glb' };
  if (files[key]) {
    try {
      // Fixed same-origin path: no untrusted user-provided model URLs.
      const gltf = await new GLTFLoader().loadAsync(files[key] + '?v=20261120d');
      const model = verifyRig(gltf.scene);
      model.userData.no7Replacement = true;
      if (key === 'meshy-v1') groundRestPose(model);
      const defs = CLIP_DEFS[key]; if (defs) { const set = {}; for (const [id, d] of Object.entries(defs)) { const clip = gltf.animations.find((c) => c.name === d.name); if (clip) set[id] = { ...d, clip }; } if (Object.keys(set).length) clipsOf.set(model, set); }
      modelCache.set(key, model);
      console.info('[No.7] Rigged replacement GLB loaded');
      return model;
    } catch (error) {
      console.warn('[No.7] Replacement GLB unavailable or incompatible; using original', error);
    }
  }
  return loadLegacy();
}
// 敵（ディフェンスなど）は いつも 旧モデル（ユニフォームの 色を かえて つかう）
export function loadFoeHuman() { return loadLegacy(); }

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
let toonGrad2 = null;
// 新モデル用：アニメの セル画の ような 2段の 影
function gradientMap2() {
  if (toonGrad2) return toonGrad2;
  const t = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 255, 255, 255, 255]), 2, 1); t.needsUpdate = true; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  toonGrad2 = t; return t;
}
function gradientMap3() {
  if (toonGrad) return toonGrad;
  const data = new Uint8Array([80, 80, 80, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1); t.needsUpdate = true; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  toonGrad = t; return t;
}

export function makeHuman(template, suit = '#3df5ff', opt = {}) {
  const model = cloneModel(template);
  const nativeLook = !!template.userData.no7Replacement;
  const root = new THREE.Group(); const holder = new THREE.Group(); holder.rotation.y = Math.PI; holder.add(model); root.add(holder);
  const B = {}; let skinned = null;
  model.traverse((o) => { if (o.isBone) B[o.name.replace('mixamorig', '')] = o; if (o.isSkinnedMesh) { skinned = o; o.frustumCulled = false; } });
  // 見た目：骨ごとに 色を ぬりわけて、ユニフォーム・はだ・くつ に見せる
  const suitC = new THREE.Color(suit); const SKIN = new THREE.Color(opt.skin || '#e8b48a'); const JERSEY = suitC.clone().lerp(new THREE.Color('#ffffff'), 0.06); const SHORTS = suitC.clone().multiplyScalar(0.82); const TRIM = new THREE.Color(opt.trim || '#ffffff'); const SHOE = new THREE.Color(opt.shoe || '#f6f8ff'); const SOCK = new THREE.Color('#ffffff'); const HAIR = new THREE.Color(opt.hair || '#2a1c14');
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
  const outlineW = nativeLook ? 0.0075 : 0.013;
  model.traverse((o) => { if (!o.isSkinnedMesh) return; const g = o.geometry; geos.push(g);
    if (nativeLook) {
      // 新モデル：GLB の 色・テクスチャを そのまま 使い、アニメ風の 段々の 影（トゥーン）に する
      const src = o.material; const decal = /FaceDecal/.test(src.name || '');
      const m = new THREE.MeshToonMaterial({ color: src.color ? src.color.clone() : 0xffffff, map: src.map || null, gradientMap: gradientMap2(), side: src.side, emissive: 0x1a1410, emissiveIntensity: decal ? 0 : 0.12, alphaTest: decal ? 0.5 : src.alphaTest, transparent: false });
      m.name = src.name; o.material = m; meshes.push(o); mats.push(m);
      if (decal) return; // 顔の 目・まゆの 絵には ふちどりを 付けない
      // 頂点カラー R が ある メッシュ（体）は、R を ふちどりの 太さに 使う（顔の 前は 0 にして 目・口に 黒い みぞを 出さない）
      const vw = !!g.attributes.color; const om = new THREE.MeshBasicMaterial({ color: 0x120e0c, side: THREE.BackSide, vertexColors: vw });
      om.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * ' + outlineW.toFixed(4) + (vw ? ' * color.r' : '') + ';'); if (vw) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', ''); };
      const ol = new THREE.SkinnedMesh(g, om); ol.bind(o.skeleton, o.bindMatrix); ol.frustumCulled = false;
      ol.userData.par = o.parent || model; outlines.push(ol); outlineMats.push(om); return; }
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight, pos = g.attributes.position, nor = g.attributes.normal; const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
      const bn = o.skeleton.bones[best].name; tmpV.fromBufferAttribute(pos, i); const x = tmpV.x, y = tmpV.y, z = tmpV.z; const c = regionOf(bn, x, y);
      // うらがわ・つなぎ目を ほんの少し くらくして、のっぺりしすぎないように（かんいAO）
      const ao = nor ? 0.86 + 0.14 * clamp(nor.getY(i) * 0.5 + 0.5, 0, 1) : 1;
      col[i * 3] = c.r * ao; col[i * 3 + 1] = c.g * ao; col[i * 3 + 2] = c.b * ao;
      // 服の ところは 少し ふくらませて、ぴったり しすぎない ように
      if (nor && cloth(c) && !/Foot|Toe/.test(bn)) { const legs = /UpLeg|Hips/.test(bn); const k = legs ? 0.02 + 0.035 * clamp((0.95 - y) / 0.35, 0, 1) : 0.014; pos.setXYZ(i, x + nor.getX(i) * k, y + nor.getY(i) * k, z + nor.getZ(i) * k); }
      if (/Spine/.test(bn) && Math.abs(x) < 0.06 && y > 1.2 && y < 1.4) { zBack = Math.max(zBack, -z); zFront = Math.max(zFront === 1 ? -1 : zFront, z); } }
    if (!nativeLook) { pos.needsUpdate = true; g.setAttribute('color', new THREE.BufferAttribute(col, 3)); }
    // アニメっぽい セルシェーディング（段々の 色わけ）に
    const m = nativeLook ? o.material : new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradientMap3(), emissive: 0x1a1410, emissiveIntensity: 0.22 }); o.material = m; meshes.push(o); mats.push(m);
    // ふちどり（アウトライン）：ひとまわり 大きい 黒の うらめんメッシュを かさねる
    const om = new THREE.MeshBasicMaterial({ color: 0x120e0c, side: THREE.BackSide }); om.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * 0.013;'); };
    const ol = new THREE.SkinnedMesh(g, om); ol.bind(o.skeleton, o.bindMatrix); ol.frustumCulled = false;
    ol.userData.par = o.parent || model; outlines.push(ol); outlineMats.push(om); });
  outlines.forEach((ol) => { ol.userData.par.add(ol); if (opt.guide !== false) ol.layers.enable(1); });
  // ヘッドバンド
  const band = new THREE.MeshBasicMaterial({ color: TRIM }); const tor = new THREE.TorusGeometry(1, 0.22, 8, 20);
  const attach = (bone, r, y, rx) => { if (!bone) return; const t = new THREE.Mesh(tor, band); const ws = bone.getWorldScale(new THREE.Vector3()).x || 1; t.scale.setScalar(r / ws); t.position.y = y / ws; t.rotation.x = rx; bone.add(t); meshes.push(t); };
  // No.7 appearance prototype: reusable accessories parented to the existing rig.
  // The original skinned mesh and all basketball motions remain unchanged.
  const accessories = []; const accessoryMaterials = []; const accessoryGeometries = [];
  if (opt.rich && !nativeLook && B.Head) {
    const curlGeo = new THREE.IcosahedronGeometry(0.075, 1);
    const curlMat = new THREE.MeshStandardMaterial({ color: opt.hair || '#593923', roughness: 0.88 });
    accessoryGeometries.push(curlGeo); accessoryMaterials.push(curlMat);
    // Crown and rear curls: deliberately avoid covering the player's face.
    for (let row = 0; row < 3; row++) {
      const y = 0.13 + row * 0.065;
      const count = row === 2 ? 7 : 11;
      for (let i = 0; i < count; i++) {
        const theta = Math.PI * 0.15 + i / (count - 1) * Math.PI * 1.7;
        const radius = row === 2 ? 0.085 : 0.145;
        const curl = new THREE.Mesh(curlGeo, curlMat);
        curl.position.set(Math.cos(theta) * radius, y + Math.sin(i * 2.4 + row) * 0.012, Math.sin(theta) * radius);
        curl.scale.set(0.82 + (i % 3) * 0.12, 0.65 + (i % 2) * 0.18, 0.85);
        B.Head.add(curl); accessories.push(curl);
      }
    }
  }
  // No.7 sculpted appearance prototype: independent meshes follow the EXISTING
  // animation rig. This is intentionally a prototype, not a finished GLB.
  // Switch it on with ?visual=sculpt; the default character is unaffected.
  const sculpted = opt.sculpt && !nativeLook && opt.guide !== false;
  if (sculpted) {
    const blue = new THREE.MeshStandardMaterial({ color: '#1154dc', roughness: 0.78, metalness: 0.04 });
    const darkBlue = new THREE.MeshStandardMaterial({ color: '#07348d', roughness: 0.88 });
    const yellow = new THREE.MeshStandardMaterial({ color: '#ffd21b', roughness: 0.65 });
    const shoe = new THREE.MeshStandardMaterial({ color: '#12265b', roughness: 0.65 });
    const skin = new THREE.MeshStandardMaterial({ color: opt.skin || '#c99068', roughness: 0.9 });
    accessoryMaterials.push(blue, darkBlue, yellow, shoe, skin);
    const attachShape = (bone, geometry, material, position, scale, rotation) => {
      if (!bone) { geometry.dispose(); return null; }
      const shape = new THREE.Mesh(geometry, material);
      shape.position.set(...position); shape.scale.set(...scale);
      if (rotation) shape.rotation.set(...rotation);
      bone.add(shape); accessories.push(shape); accessoryGeometries.push(geometry);
      shape.layers.enable(1);
      return shape;
    };
    // Upper body: a sculpted jersey panel and a contrasting waist seam.
    // Spine2 is the animated torso anchor, so the jersey follows forward lean.
    attachShape(B.Spine2, new THREE.SphereGeometry(1, 24, 16), blue,
      [0, 0.025, 0], [0.235, 0.285, 0.125]);
    attachShape(B.Spine2, new THREE.TorusGeometry(0.22, 0.018, 8, 36), yellow,
      [0, 0.24, -0.015], [0.95, 0.65, 1], [Math.PI / 2, 0, 0]);
    attachShape(B.Spine, new THREE.SphereGeometry(1, 20, 12), darkBlue,
      [0, -0.015, 0], [0.18, 0.12, 0.12]);
    // Two independent short legs keep the fabric moving with the hip joints.
    for (const side of ['Left', 'Right']) {
      const thigh = B[side + 'UpLeg'];
      attachShape(thigh, new THREE.CylinderGeometry(0.12, 0.145, 0.25, 16), blue,
        [0, -0.13, 0], [1, 1, 1]);
      attachShape(thigh, new THREE.TorusGeometry(0.13, 0.012, 8, 24), yellow,
        [0, -0.25, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
      attachShape(B[side + 'Foot'], new THREE.SphereGeometry(1, 16, 12), shoe,
        [0, -0.025, -0.09], [0.10, 0.075, 0.18]);
      attachShape(B[side + 'Foot'], new THREE.BoxGeometry(0.12, 0.012, 0.20), yellow,
        [0, 0.035, -0.10], [1, 1, 1]);
    }
    // Head details: larger hair cap and curled strands, all attached to Head.
    attachShape(B.Head, new THREE.SphereGeometry(1, 20, 14), skin,
      [0, 0.065, 0], [0.135, 0.17, 0.135]);
    const capMat = new THREE.MeshStandardMaterial({ color: '#50311d', roughness: 0.96 });
    accessoryMaterials.push(capMat);
    attachShape(B.Head, new THREE.SphereGeometry(1, 20, 14), capMat,
      [0, 0.19, 0.005], [0.145, 0.08, 0.145]);
  }
  // せばんごう（せなか と むね）
  const numMats = [];
  if (B.Spine2 && !nativeLook) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g2 = cv.getContext('2d'); g2.font = '900 104px Arial, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.lineWidth = 10; g2.strokeStyle = 'rgba(0,0,0,.55)'; g2.strokeText(String(opt.num ?? 7), 64, 70); g2.fillStyle = '#' + TRIM.getHexString(); g2.fillText(String(opt.num ?? 7), 64, 70);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const nm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }); numMats.push(nm, tex); const pg = new THREE.PlaneGeometry(1, 1); geos.push(pg);
    const inv = new THREE.Matrix4().copy(B.Spine2.matrixWorld).invert(); const mw = new THREE.Matrix4();
    for (const [zz, ry, sz, yy] of [[-(zBack + 0.03), Math.PI, 0.25, 1.3], [zFront + 0.03, 0, 0.13, 1.36]]) { const pl = new THREE.Mesh(pg, nm); const lm = new THREE.Matrix4().compose(new THREE.Vector3(0, yy, zz), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sz, sz, sz)); mw.multiplyMatrices(model.matrixWorld, lm); mw.premultiply(inv); mw.decompose(pl.position, pl.quaternion, pl.scale); pl.userData.mat0 = nm; B.Spine2.add(pl); meshes.push(pl); } }
  const sil = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const setSilhouette = (on, color) => { if (on) sil.color.set(color); let i = 0; for (const m of meshes) { if (m.isSkinnedMesh) m.material = on ? sil : mats[i++]; else if (m.userData.mat0) m.visible = !on; else m.material = on ? sil : band; } outlines.forEach((ol) => { ol.visible = !on; }); accessories.forEach((a) => { a.visible = !on; }); };
  if (opt.guide !== false) meshes.forEach((m) => m.layers.enable(1));
  const dispose = () => { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()); numMats.forEach((m) => m.dispose()); band.dispose(); tor.dispose(); sil.dispose(); accessoryGeometries.forEach((g) => g.dispose()); accessoryMaterials.forEach((m) => m.dispose()); outlineMats.forEach((m) => m.dispose()); if (faceMat) { faceMat.dispose(); faceTex.dispose(); } };
  root.updateMatrixWorld(true);
  const wp = (b) => b.getWorldPosition(V());
  const L = { up: wp(B.LeftUpLeg).distanceTo(wp(B.LeftLeg)), lo: wp(B.LeftLeg).distanceTo(wp(B.LeftFoot)), ua: wp(B.LeftArm).distanceTo(wp(B.LeftForeArm)), fa: wp(B.LeftForeArm).distanceTo(wp(B.LeftHand)) };
  const hipsBind = wp(B.Hips).y; const ankleH = wp(B.LeftFoot).y; const hipW = Math.abs(wp(B.LeftUpLeg).x);
  // 新モデル：床に ついている 足は 足うらを 床と 平行に たもつ（つま先が しずんだり 浮いたり しない）
  const flatQ = new Map(); if (nativeLook) { const rq0 = root.getWorldQuaternion(new THREE.Quaternion()).invert(); for (const f of [B.LeftFoot, B.RightFoot]) if (f) flatQ.set(f, rq0.clone().multiply(f.getWorldQuaternion(new THREE.Quaternion()))); }
  const t1 = V(), t2 = V(), t3 = V(), q1 = Q(), q2 = Q(), q3 = Q();
  // --- クリップ再生（Meshy/Mixamo の 動きが ある 技だけ。ほかは IK） ---
  const clipSet = clipsOf.get(template) || null; const CLIP_FADE = 0.15, BALL_R = 0.17, FLOOR_Y = 0.13;
  // クリップは Hips の 動きで 体を 持ちあげている（足うら y≈-0.019）。レスト姿勢の 持ちあげ（restLift）と 入れかえて +0.019 に する
  const CLIP_LIFT = 0.019; const restLift = template.userData.restLift || 0;
  // AnimationMixer は 同じ 時刻を 2回 つづけて あてると 骨を 書きなおさない（お手本の 小まどで 同じ拍を もう一度 動かすと IK の しせいの ままに なる）。
  // なので トラックの 値を 毎回 じぶんで 計算して 骨に 入れる（同じ クリップは 1回だけ 準備）
  const allBones = []; const ikP = [], ikQ = [], ikS = []; const byName = {};
  const clipCh = new Map(); // clip → [{ obj, prop, interp }]
  if (clipSet) {
    model.traverse((o) => { if (o.isBone) { byName[o.name] = o; allBones.push(o); ikP.push(V()); ikQ.push(Q()); ikS.push(V()); o.userData.p0 = o.position.clone(); o.userData.q0 = o.quaternion.clone(); o.userData.s0 = o.scale.clone(); } });
    for (const d of Object.values(clipSet)) { d.hb = B[d.hand + 'Hand']; d.hi = B[d.hand + 'HandIndex1'];
      if (!clipCh.has(d.clip)) clipCh.set(d.clip, d.clip.tracks.map((tr) => { const pn = THREE.PropertyBinding.parseTrackName(tr.name); const obj = byName[pn.nodeName]; return obj && /^(position|quaternion|scale)$/.test(pn.propertyName) ? { obj, prop: pn.propertyName, interp: tr.createInterpolant() } : null; }).filter(Boolean)); }
  }
  const clipPose = (d, t) => { for (const c of clipCh.get(d.clip)) c.obj[c.prop].fromArray(c.interp.evaluate(t)); root.updateMatrixWorld(true);
    const s = root.getWorldScale(t1).y; B.Hips.getWorldPosition(t2); t2.y -= (restLift - CLIP_LIFT) * s; B.Hips.parent.worldToLocal(t2); B.Hips.position.copy(t2); root.updateMatrixWorld(true); };
  // 手のひらの 下に ボール：手首と 人差し指の つけねの まんなかから、手首の +Z（手のひら がわ）へ ボールの 半径ぶん
  const palmBall = (d, out) => { d.hb.getWorldPosition(t1); if (d.hi) t1.lerp(d.hi.getWorldPosition(t2), 0.5); d.hb.getWorldQuaternion(q1); t3.set(0, 0, 1).applyQuaternion(q1).multiplyScalar(BALL_R * root.getWorldScale(t2).y); return root.worldToLocal(out.copy(t1).add(t3)); };
  if (clipSet) { // ボールが いちばん 上に くる 高さ（拍の まんなかで 手と 出会う 高さ）を 先に はかっておく
    const bb = V(); for (const d of Object.values(clipSet)) { d.top = FLOOR_Y; for (let i = 0; i <= 24; i++) { clipPose(d, d.t0 + (d.t1 - d.t0) * i / 24); d.top = Math.max(d.top, palmBall(d, bb).y); } }
    for (const b of allBones) { b.position.copy(b.userData.p0); b.quaternion.copy(b.userData.q0); b.scale.copy(b.userData.s0); } root.updateMatrixWorld(true);
  }
  const clipBall = V(), outBall = V();
  // ひざの 高さの ドリブル：こしを 落として 上体を 前に たおし（足は 床に つけたまま）、右うでを 下げる
  const KNEE_DROP = 0.26, KNEE_CROUCH = 0.13, KNEE_LEAN = 0.38; const HEIGHT_K = { waist: 0, knee: 1 };
  const setWorldQ = (bone, qW) => { bone.parent.getWorldQuaternion(q3).invert(); bone.quaternion.copy(q3.multiply(qW)); bone.updateMatrixWorld(true); };
  const lp = { hand: V(), handQ: Q(), pole: V(), feet: [0, 1].map(() => ({ p: V(), q: Q(), pole: V() })) };
  function lowPose(d, k) {
    const sc = root.getWorldScale(t1).y; const hand = d.hb, fore = hand.parent, arm = fore.parent;
    hand.getWorldPosition(lp.hand); hand.getWorldQuaternion(lp.handQ); arm.getWorldPosition(t1); fore.getWorldPosition(t2); lp.pole.copy(t2).sub(t1.add(lp.hand).multiplyScalar(0.5)).normalize();
    const legs = [[B.LeftUpLeg, B.LeftLeg, B.LeftFoot], [B.RightUpLeg, B.RightLeg, B.RightFoot]];
    legs.forEach(([u, l, f], i) => { const F = lp.feet[i]; f.getWorldPosition(F.p); f.getWorldQuaternion(F.q); u.getWorldPosition(t1); l.getWorldPosition(t2); F.pole.copy(t2).sub(t1.add(F.p).multiplyScalar(0.5)).normalize(); });
    B.Hips.getWorldPosition(t2); t2.y -= KNEE_CROUCH * k * sc; B.Hips.parent.worldToLocal(t2); B.Hips.position.copy(t2); root.updateMatrixWorld(true);
    const rxv = t3.set(1, 0, 0).applyQuaternion(root.getWorldQuaternion(q1)).clone();
    preWorld(B.Spine, axisQ(rxv, -KNEE_LEAN * k * 0.5)); preWorld(B.Spine1, axisQ(rxv, -KNEE_LEAN * k * 0.5)); preWorld(B.Neck, axisQ(rxv, KNEE_LEAN * k * 0.7));
    legs.forEach(([u, l, f], i) => { const F = lp.feet[i]; ik(u, l, f, F.p, F.pole, L.up, L.lo); setWorldQ(f, F.q); });
    lp.hand.y -= KNEE_DROP * k * sc; ik(arm, fore, hand, lp.hand, lp.pole, L.ua, L.fa); setWorldQ(hand, lp.handQ); root.updateMatrixWorld(true);
  }
  const footY = () => Math.min(...[B.LeftFoot, B.RightFoot, B.LeftToeBase, B.RightToeBase].filter(Boolean).map((b) => b.getWorldPosition(t3).y));
  function applyClip(S, st, id, hold, bph, bounce) {
    const c0 = clipSet[id]; const want = !hold && !st.mode && c0 && (!c0.cueHand || (st.cue ? st.cue.hand || 'R' : 'R') === c0.cueHand) ? c0 : null; if (want) S.cdef = want;
    S.cw = clamp((S.cw || 0) + (want ? 1 : -1) * st.dt / CLIP_FADE, 0, 1);
    if (S.cw <= 0 || !S.cdef) return S.ball;
    const d = S.cdef; const w = smooth(S.cw);
    allBones.forEach((b, i) => { ikP[i].copy(b.position); ikQ[i].copy(b.quaternion); ikS[i].copy(b.scale); }); const fIK = footY();
    // 拍に あわせる：cnt（ついた かず）が 整数で ボールが 床、x.5 で 手も ボールも いちばん上。
    // 技の はじまり（b0）では 1拍1回の ときと 同じ 位相に そろえて、速さが かわっても 手が とばない ように する
    const rate = DRIBBLE_Q.rate || d.rate || 1; const b0 = st.cue ? st.cue.b0 : 0; const cnt = (st.beat - b0) * rate + b0;
    const db = cnt - 0.5; const u = ((db % d.n) + d.n) % d.n / d.n;
    const hk = HEIGHT_K[DRIBBLE_Q.h || d.h] || 0; S.hk = S.hk == null ? hk : S.hk + clamp(hk - S.hk, -st.dt / 0.2, st.dt / 0.2);
    clipPose(d, d.t0 + (d.t1 - d.t0) * u);
    if (S.hk > 0.001) lowPose(d, S.hk);
    palmBall(d, clipBall);
    // 手から はなれたら 手の 真下の 床（y=0.13）との あいだを 拍に あわせて 上下。手より 上には 行かない
    const bnc = Math.abs(Math.sin(Math.PI * (cnt - Math.floor(cnt)))); const top = d.top - KNEE_DROP * S.hk * root.getWorldScale(t1).y;
    clipBall.y = Math.max(FLOOR_Y, Math.min(clipBall.y, FLOOR_Y + bnc * (top - FLOOR_Y)));
    if (w < 1) { const fClip = footY();
      // ikP/ikQ/ikS（IK の しせい）に クリップの しせいを w の わりあいで まぜる（自分自身と まぜない よう ik 側を 動かしてから コピー）
      allBones.forEach((b, i) => { ikP[i].lerp(b.position, w); ikQ[i].slerp(b.quaternion, w); ikS[i].lerp(b.scale, w); b.position.copy(ikP[i]); b.quaternion.copy(ikQ[i]); b.scale.copy(ikS[i]); }); root.updateMatrixWorld(true);
      // まぜている あいだは 脚の まがりが 中途半端に なって 足が しずむので、足の 高さが 2つの しせいの あいだに なるよう 腰で なおす
      const fix = lerp(fIK, fClip, w) - footY(); if (fix) { B.Hips.getWorldPosition(t2); t2.y += fix; B.Hips.parent.worldToLocal(t2); B.Hips.position.copy(t2); root.updateMatrixWorld(true); } }
    return outBall.lerpVectors(S.ball, clipBall, w);
  }

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
    // The No.7 preview demonstrates stationary ball-hand control before runner motion.
    // Keep the preview player in a basketball-ready stance, not a running gait.
    // Rest is included because most stage time is spent between skill cues.
    const basicDribble = opt.practicePose && !hold && (id === 'right' || id === 'left' || id === 'rest');
    const moving = !G && !hold && sp > 0.3 && !basicDribble && !(opt.practicePose && (id === 'cross' || id === 'dcross'));
    if (basicDribble) { crouch = 0.65; Wd = 0.27; stride = 0; guard = true; bx = hs * 0.43; bz = -0.32; amp = 0.58; }
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
    // Power position: hips back, knees flexed, staggered feet and forward torso.
    // Apply after the generic gait/guide setup so the stance cannot be overwritten.
    if (basicDribble) {
      // Jr. NBA: balanced knee bend and a controlled dribble below the waist.
      crouch = 0.65;
      // Balanced athletic stance: hinge at hips while keeping torso/head above the forefoot.
      // In this model negative Z is forward. A large positive hipZ previously pushed
      // the entire body behind the feet, making the pose look like it would fall back.
      // Reference pose: athletic hip hinge with weight balanced across both feet.
      pitch = 0.82;
      hipZ = -0.03;
      T.fl.set(-0.27, 0, -0.17);
      T.fr.set(0.27, 0, 0.03);
      rootY = 0;
      // Release/catch cycle: ball reaches waist height, but the hand does not follow it to the floor.
      const waistTop = Math.max(0.72, hipsBind - crouch * 0.24 + 0.05);
      by = 0.13 + bounce * (waistTop - 0.13);
      bx = handSide * 0.43;
      bz = -0.32;
    }
    // No.7 crossover: low, close to the body, with a planted athletic stance.
    // Use a single shared bounce point between the feet and transfer hands at that point.
    const previewCross = opt.practicePose && !G && !hold && (id === 'cross' || id === 'dcross');
    if (previewCross) {
      const speed = id === 'dcross' ? 2 : 1;
      const u = ((cb * speed) % 2 + 2) % 2;
      const direction = cue && cue.hand0 === 'L' ? -1 : 1;
      const side = Math.cos(Math.PI * u) * direction;
      const center = Math.abs(Math.sin(Math.PI * u));
      crouch = 0.83 + 0.055 * center;
      pitch = 0.82 + 0.065 * center;
      hipZ = -0.03;
      hipX = -side * 0.035;
      twist = -side * 0.12;
      roll = -side * 0.045;
      rootY = 0;
      stride = 0; guard = true;
      T.fl.set(-0.31, 0, -0.12);
      T.fr.set(0.31, 0, 0.06);
      bx = side * 0.39;
      bz = -0.43;
      by = 0.13 + Math.pow(Math.abs(Math.cos(Math.PI * u)), 0.75) * 0.36;
      handSide = side >= 0 ? 1 : -1;
      // At the low central bounce both hands move toward the transfer zone.
      both = center > 0.90;
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
    // Opening countdown: hold the ball with both hands at the front of the waist.
    if (opt.practicePose && st.startHold) {
      both = true; twoHands = false; guard = false;
      crouch = 0.65; pitch = 0.82; hipZ = -0.03;
      T.fl.set(-0.27, 0, -0.17); T.fr.set(0.27, 0, 0.03);
      rootY = 0; bx = (st.startHand === 'L' ? -1 : 1) * 0.32; bz = -0.40; by = hipsBind - crouch * 0.24 + 0.04;
    }
    // A strong stationary dribble uses a small coordinated knee/hip/torso pulse.
    // The feet remain planted; the pulse peaks as the ball travels downward.
    if (basicDribble && !st.startHold && id !== 'rest') {
      const drive = Math.pow(Math.max(0, Math.sin(2 * Math.PI * bph)), 2);
      crouch += 0.045 * drive;
      pitch += 0.055 * drive;
      hipZ -= 0.018 * drive;
      hipX += handSide * 0.012 * drive;
      twist += handSide * 0.045 * drive;
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
    // Keep the palm near the rising ball; on the floor, avoid an unnaturally long arm.
    // Ball and palm are independent during the flight: contact near the top, release on descent.
    // Do not stretch the arm to the ball when it is close to the floor.
    const releasePhase = basicDribble ? Math.pow(Math.max(0, Math.min(1, (bounce - 0.65) / 0.35)), 2) : 1;
    const handY = previewCross ? Math.max(S.hip.y - 0.12, by + 0.10) : basicDribble
      ? (S.hip.y + 0.03) * (1 - releasePhase) + (by + 0.14) * releasePhase
      : Math.max(by + 0.16, S.hip.y - (opt.practicePose ? 0.25 : 0.36));
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
    model.traverse((o) => { if (o.isBone) { o.position.copy(o.userData.p0 || (o.userData.p0 = o.position.clone())); o.quaternion.copy(o.userData.q0 || (o.userData.q0 = o.quaternion.clone())); if (o.userData.s0) o.scale.copy(o.userData.s0); } });
    root.updateMatrixWorld(true);
    const yq = Q().setFromAxisAngle(Y, spinA); const rq = root.getWorldQuaternion(Q()).multiply(yq); const toW = (v) => root.localToWorld(w.copy(v).applyQuaternion(yq)); const dirW = (x, y, z) => pole.set(x, y, z).applyQuaternion(rq);
    B.Hips.parent.worldToLocal(toW(S.hip)); B.Hips.position.copy(w); B.Hips.updateMatrixWorld(true);
    const rx = X.clone().applyQuaternion(rq), ry = Y.clone().applyQuaternion(rq), rz = Z.clone().applyQuaternion(rq);
    preWorld(B.Hips, axisQ(ry, S.twist * 0.35).multiply(axisQ(rz, S.roll * 0.5)).multiply(axisQ(rx, -S.pitch * 0.35)));
    for (const b of [B.Spine, B.Spine1, B.Spine2]) preWorld(b, axisQ(ry, S.twist * 0.22).multiply(axisQ(rz, S.roll * 0.17)).multiply(axisQ(rx, -S.pitch * 0.22)));
    preWorld(B.Neck, axisQ(rx, S.pitch * 0.45)); preWorld(B.Head, axisQ(ry, -S.twist * 0.5).multiply(axisQ(rx, S.pitch * 0.3)));
    // 足
    const foot = (up, lo, ft, toe, tgt, s) => { const a = V().copy(tgt); a.y += ankleH; ik(up, lo, ft, toW(a).clone(), dirW(s * (0.06 + 0.36 * S.knee), 0.1, -1), L.up, L.lo); // In the static basketball stance, preserve the model's neutral ankle/toe rotation.
      // Aiming the foot toward an elevated toe target made the shoe point upward.
      if (flatQ.has(ft) && tgt.y < 0.012) { const want = rq.clone().multiply(axisQ(Y, -s * 0.14)).multiply(flatQ.get(ft)); ft.parent.getWorldQuaternion(q3).invert(); ft.quaternion.copy(q3.multiply(want)); ft.updateMatrixWorld(true); }
      else if (!basicDribble && !previewCross) { const tt = V().copy(tgt); tt.z -= 0.2; tt.x += s * 0.03; tt.y = Math.max(0.02, tgt.y * 0.6 + 0.02); aim(ft, toe, toW(tt).clone()); } };
    foot(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, B.LeftToeBase, S.fl, -1); foot(B.RightUpLeg, B.RightLeg, B.RightFoot, B.RightToeBase, S.fr, 1);
    // うで
    const behind = lbz > 0.2;
    ik(B.LeftArm, B.LeftForeArm, B.LeftHand, toW(S.hl).clone(), dirW(-0.8, -0.3, behind ? -0.6 : 0.7), L.ua, L.fa);
    ik(B.RightArm, B.RightForeArm, B.RightHand, toW(S.hr).clone(), dirW(0.8, -0.3, behind ? -0.6 : 0.7), L.ua, L.fa);
    if (faceSp) { B.Head.getWorldPosition(t1); root.worldToLocal(t1); faceSp.position.copy(t1); }
    if (clipSet) return applyClip(S, st, id, hold, bph, bounce);
    return S.ball;
  }
  // かお：イラストの スプライトを 頭の 位置に のせる（もとの 頭は 小さく たたむ）
  let faceSp = null, faceTex = null, faceMat = null;
  if (opt.bigHead && B.Head && !nativeLook) B.Head.scale.setScalar(opt.bigHead); // イラストの 顔と 同じ テイスト（頭 大きめ）
  const setFace = (tex, i) => { if (!tex || !B.Head) return;
    if (!faceSp) { faceTex = tex.clone(); faceTex.repeat.set(0.1, 0.2); faceTex.needsUpdate = true; faceMat = new THREE.SpriteMaterial({ map: faceTex, transparent: true, alphaTest: 0.4 }); faceSp = new THREE.Sprite(faceMat); faceSp.center.set(0.5, 0.2); faceSp.scale.set(0.66, 0.66, 1); root.add(faceSp); B.Head.scale.setScalar(0.02); }
    faceTex.offset.set((i % 10) * 0.1, 1 - (Math.floor(i / 10) + 1) * 0.2); };
  // メインの画面では かくす（お手本の 小まど だけに 出す）。絵の スプライトで プレイヤーを 出すとき用
  const setMainVisible = (on) => { for (const m of [...meshes, ...outlines, ...accessories]) { if (on) m.layers.enable(0); else m.layers.disable(0); } };
  return { root, animate, setSilhouette, setFace, setMainVisible, dispose, ball2: () => (S.has2 ? S.ball2 : null), height: hipsBind / 0.53 };
}
