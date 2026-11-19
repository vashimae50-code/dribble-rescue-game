"""ドリバト！ キャラクター 3D モデル ビルダー（Blender 5.x / bpy で実行）

共通の骨格（Mixamo 互換の骨名）とキャラクター別の外見設定（JSON）から、
ゲーム用のリグ付き GLB を自動生成する。

使い方:
  python3 build_character.py --config characters/no7.json --out ../../models/no7-v2.glb
  （Blender 本体なら: blender -b -P build_character.py -- --config ... --out ...）

素材: MakeHuman / MPFB2 のベースメッシュ・ターゲット・Mixamo リグ・ウェイト（CC0 1.0）
"""
import bpy, bmesh, json, gzip, math, os, sys, random, argparse
from collections import defaultdict, deque
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ASSET = os.path.join(HERE, 'mh_assets')

# ------------------------------------------------------------------ 入力
def parse_args():
    argv = sys.argv
    argv = argv[argv.index('--') + 1:] if '--' in argv else argv[1:]
    p = argparse.ArgumentParser()
    p.add_argument('--config', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--blend', default=None, help='確認用 .blend も保存する')
    return p.parse_args(argv)

def hexcol(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, a)

# ------------------------------------------------------------------ MakeHuman ベースメッシュ
def parse_obj(path):
    V, F, G = [], [], []
    group = None
    with open(path) as f:
        for line in f:
            if line.startswith('v '):
                V.append([float(x) for x in line.split()[1:4]])
            elif line.startswith('g '):
                group = line.split(None, 1)[1].strip()
            elif line.startswith('f '):
                F.append([int(t.split('/')[0]) - 1 for t in line.split()[1:]]); G.append(group)
    return V, F, G

def load_target(rel):
    path = os.path.join(ASSET, 'targets', rel)
    if not path.endswith('.gz'): path += '.target.gz'
    out = []
    with gzip.open(path, 'rt') as f:
        for line in f:
            if not line.strip() or line[0] == '#': continue
            s = line.split(); out.append((int(s[0]), float(s[1]), float(s[2]), float(s[3])))
    return out

def macro_targets(m):
    """MakeHuman のマクロ（性別・年齢・筋肉・体重・身長・比率）をターゲットの重みに分解"""
    def split(v, lo, mid, hi):
        if v < 0.5: return {lo: 1 - v / 0.5, mid: v / 0.5}
        return {mid: 1 - (v - 0.5) / 0.5, hi: (v - 0.5) / 0.5}
    mus = split(m['muscle'], 'minmuscle', 'averagemuscle', 'maxmuscle')
    wt = split(m['weight'], 'minweight', 'averageweight', 'maxweight')
    out = defaultdict(float)
    g = m.get('gender', 'male')
    for race, rw in m['race'].items():
        out[f'macrodetails/{race}-{g}-young'] += rw
    for mk, mw in mus.items():
        for wk, ww in wt.items():
            w = mw * ww
            if w <= 1e-6: continue
            out[f'macrodetails/universal-{g}-young-{mk}-{wk}'] += w
            h = m['height']
            if h > 0.5: out[f'macrodetails/height/{g}-young-{mk}-{wk}-maxheight'] += w * (h - 0.5) * 2
            elif h < 0.5: out[f'macrodetails/height/{g}-young-{mk}-{wk}-minheight'] += w * (0.5 - h) * 2
            p = m['proportions']
            if p > 0.5: out[f'macrodetails/proportions/{g}-young-{mk}-{wk}-idealproportions'] += w * (p - 0.5) * 2
    return out

# ------------------------------------------------------------------ 小道具
def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def new_mat(name, color, rough=0.75, double=False, image=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = color
    bsdf.inputs['Roughness'].default_value = rough
    if 'Specular IOR Level' in bsdf.inputs: bsdf.inputs['Specular IOR Level'].default_value = 0.2
    if image is not None:
        tex = m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = image; tex.interpolation = 'Linear'
        m.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    m.use_backface_culling = not double
    return m

def mesh_object(name, verts, faces, coll):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob); return ob

def ring_distance(nv, adj, seeds, maxd=99):
    d = [maxd] * nv; q = deque()
    for s in seeds: d[s] = 0; q.append(s)
    while q:
        i = q.popleft()
        if d[i] >= maxd - 1: continue
        for j in adj[i]:
            if d[j] > d[i] + 1: d[j] = d[i] + 1; q.append(j)
    return d

def laplacian(verts, adj, idx_set, iters, lam=0.5, keep=None):
    for _ in range(iters):
        new = {}
        for i in idx_set:
            if keep and i in keep: continue
            nb = [j for j in adj[i]]
            if not nb: continue
            c = Vector((0, 0, 0))
            for j in nb: c += verts[j]
            c /= len(nb); new[i] = verts[i].lerp(c, lam)
        for i, v in new.items(): verts[i] = v

def weighted_smooth(verts, adj, weights, iters, lam=0.5, mu=None):
    """重みつき なめらか処理（weights: 頂点→0〜1）。mu を 指定すると 体積が へりにくい Taubin 方式"""
    idx = [i for i, w in weights.items() if w > 1e-3]
    for _ in range(iters):
        for f in ((lam, mu) if mu is not None else (lam,)):
            new = {}
            for i in idx:
                nb = adj[i]
                if not nb: continue
                c = Vector((0, 0, 0))
                for j in nb: c += verts[j]
                c /= len(nb); new[i] = verts[i] + (c - verts[i]) * (f * weights[i])
            for i, v in new.items(): verts[i] = v

# ------------------------------------------------------------------ 本体
def build(cfg, out_path, blend_path=None):
    random.seed(cfg.get('seed', 7))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    coll = bpy.context.scene.collection
    col = {k: hexcol(v) for k, v in cfg['colors'].items()}

    # 1) ベースメッシュ＋体型ターゲット
    V0, F0, G0 = parse_obj(os.path.join(ASSET, 'base.obj'))
    vg = json.load(open(os.path.join(ASSET, 'basemesh_vertex_groups.json')))
    V = [list(v) for v in V0]
    weights = macro_targets(cfg['body']['macro'])
    for k, w in cfg['body'].get('targets', {}).items(): weights[k] += w
    for k, w in cfg.get('face_targets', {}).items(): weights[k] += w
    for rel, w in weights.items():
        if abs(w) < 1e-6: continue
        for i, dx, dy, dz in load_target(rel):
            V[i][0] += dx * w; V[i][1] += dy * w; V[i][2] += dz * w
    # MakeHuman（Y上・10cm単位）→ Blender（Z上・m、正面は -Y）
    P = [Vector((x * 0.1, -z * 0.1, y * 0.1)) for x, y, z in V]

    def group_range(name):
        s = set()
        for a, b in vg[name]: s.update(range(a, b + 1))
        return s
    def mean_of(ids):
        c = Vector((0, 0, 0))
        for i in ids: c += P[i]
        return c / len(ids)

    # 2) 骨格（Mixamo 互換）。関節の位置は MakeHuman の関節キューブから求める
    rig = json.load(open(os.path.join(ASSET, 'rig.mixamo.json')))['bones']
    def joint_pos(spec):
        if spec['strategy'] == 'CUBE': return mean_of(group_range(spec['cube_name']))
        if spec['strategy'] == 'MEAN': return mean_of(spec['vertex_indices'])
        if spec['strategy'] == 'VERTEX': return P[spec['vertex_index']].copy()
        return Vector(spec['default_position'])
    heads = {n: joint_pos(b['head']) for n, b in rig.items()}
    tails = {n: joint_pos(b['tail']) for n, b in rig.items()}

    # 体だけ残す（目は残す）。足裏を床(z=0)、腰の高さをゲームの基準に合わせる
    body_ids = group_range('body')
    eye_ids = group_range('helper-l-eye') | group_range('helper-r-eye')
    hair_ids = group_range('helper-hair')
    zmin = min(P[i].z for i in body_ids)
    s = cfg['body']['hips_height'] / (heads['mixamorig:Hips'].z - zmin)
    def xf(v): return Vector((v.x * s, v.y * s, (v.z - zmin) * s))
    P = [xf(v) for v in P]
    heads = {n: xf(v) for n, v in heads.items()}; tails = {n: xf(v) for n, v in tails.items()}
    H = lambda n: heads['mixamorig:' + n]

    # 2.5) 頭を すこし 大きく（ゲーム画面で 顔と 髪が 見やすいように）
    wjson = json.load(open(os.path.join(ASSET, 'weights.mixamo.json')))['weights']
    wHead = defaultdict(float)
    for bn in ('mixamorig:Head', 'mixamorig:HeadTop_End'):
        for vi, w in wjson.get(bn, []): wHead[vi] += w
    for i in eye_ids | hair_ids: wHead[i] = 1.0
    hk = cfg['body'].get('head_scale', 1.0) - 1.0
    if abs(hk) > 1e-4:
        piv = H('Head').copy()
        for i, w in wHead.items():
            if w > 0: P[i] = piv + (P[i] - piv) * (1 + hk * min(1.0, w))
        for d in (heads, tails):
            for n in ('mixamorig:Head', 'mixamorig:HeadTop_End'):
                if n in d: d[n] = piv + (d[n] - piv) * (1 + hk)
        tails['mixamorig:Neck'] = heads['mixamorig:Head'].copy()

    # 手を 少し 小さく（アニメ風）。手首を 中心に 手と 指の 骨・頂点を ちぢめる
    hks = cfg['body'].get('hand_scale', 1.0) - 1.0
    if abs(hks) > 1e-4:
        for side in ('Left', 'Right'):
            piv = heads[f'mixamorig:{side}Hand'].copy()
            wh = defaultdict(float)
            for bn, lst in wjson.items():
                if bn.startswith(f'mixamorig:{side}Hand'):
                    for vi, w in lst: wh[vi] += w
            for vi, w in wh.items(): P[vi] = piv + (P[vi] - piv) * (1 + hks * min(1.0, w))
            for d in (heads, tails):
                for n in list(d.keys()):
                    if n.startswith(f'mixamorig:{side}Hand') and n != f'mixamorig:{side}Hand':
                        d[n] = piv + (d[n] - piv) * (1 + hks)
            tails[f'mixamorig:{side}Hand'] = piv + (tails[f'mixamorig:{side}Hand'] - piv) * (1 + hks)
    es = cfg['eyes'].get('ball_scale', 1.0)
    if abs(es - 1) > 1e-4:
        for ids in (group_range('helper-l-eye'), group_range('helper-r-eye')):
            c = mean_of(ids)
            for i in ids: P[i] = c + (P[i] - c) * es

    # 3) 体のメッシュ（目は 別オブジェクト）
    keep_faces = [(f, g) for f, g in zip(F0, G0) if g in ('body', 'helper-l-eye', 'helper-r-eye')]
    used = sorted({i for f, _ in keep_faces for i in f})
    remap = {o: n for n, o in enumerate(used)}
    BV = [P[i].copy() for i in used]
    BF = [[remap[i] for i in f] for f, _ in keep_faces]
    BFG = [g for _, g in keep_faces]
    nB = len(BV)
    is_eye = [used[i] in eye_ids for i in range(nB)]
    adj = [set() for _ in range(nB)]
    for f in BF:
        for a, b in zip(f, f[1:] + f[:1]): adj[a].add(b); adj[b].add(a)
    VW = [dict() for _ in range(nB)]
    for bone, lst in wjson.items():
        for vi, w in lst:
            if vi in remap and w > 1e-4: VW[remap[vi]][bone] = VW[remap[vi]].get(bone, 0) + w
    for i in range(nB):
        if is_eye[i]: VW[i] = {'mixamorig:Head': 1.0}
    def dom(i):
        return max(VW[i].items(), key=lambda kv: kv[1])[0].replace('mixamorig:', '') if VW[i] else ''
    DOM = [dom(i) for i in range(nB)]

    def vnormals(verts, faces):
        n = [Vector((0, 0, 0)) for _ in verts]
        for f in faces:
            a, b, c = verts[f[0]], verts[f[1]], verts[f[2]]
            fn = (b - a).cross(c - a)
            if len(f) == 4: fn += (c - a).cross(verts[f[3]] - a)
            for i in f: n[i] += fn
        return [x.normalized() if x.length > 1e-12 else Vector((0, 0, 1)) for x in n]
    # 口元の 深い みぞを すこし なめらかに（アニメ風の りんかく線が 口角に 出すぎない ように）
    eZ0 = sum((BV[i].z for i in range(nB) if is_eye[i]), 0.0) / max(1, sum(1 for i in range(nB) if is_eye[i]))
    HS = cfg['body'].get('head_scale', 1.0)
    mz = eZ0 - cfg['face'].get('mouth_below_eyes', 0.072) * HS
    mouth_ids = {i for i in range(nB) if not is_eye[i] and abs(BV[i].x) < cfg['face'].get('mouth_half', 0.03) * HS and abs(BV[i].z - mz) < 0.013 * HS and BV[i].y < -0.11}
    laplacian(BV, adj, mouth_ids, cfg['face'].get('mouth_smooth', 0), 0.5)
    # アニメ風：顔の 鼻・くちびる・ほおの 凹凸を ならす ／ 体の 筋肉の 細かい 凹凸を ならす
    hpts = [P[i] for i in hair_ids]; headCy = (min(p.y for p in hpts) + max(p.y for p in hpts)) / 2
    def face_w(v):
        a = math.degrees(math.atan2(abs(v.x), -(v.y - headCy)))
        return (1 - smoothstep(50, 80, a)) * smoothstep(eZ0 - 0.13 * HS, eZ0 - 0.10 * HS, v.z) * (1 - smoothstep(eZ0 + 0.01 * HS, eZ0 + 0.04 * HS, v.z))
    AN = cfg.get('anime', {})
    if AN.get('face_smooth', 0):
        fw = {i: face_w(BV[i]) for i in range(nB) if not is_eye[i] and BV[i].z > H('Neck').z}
        weighted_smooth(BV, adj, fw, AN['face_smooth'], 0.5)
    if AN.get('body_smooth', 0):
        bw = {}
        for i in range(nB):
            if is_eye[i]: continue
            d = max(VW[i].items(), key=lambda kv: kv[1])[0] if VW[i] else ''
            if any(k in d for k in ('Hand', 'Foot', 'Toe', 'Head', 'Neck')): continue
            bw[i] = 1.0
        weighted_smooth(BV, adj, bw, AN['body_smooth'], 0.5, -0.53)
    BN = vnormals(BV, BF)

    hipZ = H('Hips').z; kneeZ = H('LeftLeg').z; ankleZ = H('LeftFoot').z
    shZ = H('LeftArm').z; shX = abs(H('LeftArm').x); neckZ = H('Neck').z
    armpitZ = shZ - cfg['jersey'].get('armpit_drop', 0.11)
    eL = [BV[i] for i in range(nB) if is_eye[i] and BV[i].x > 0]; eR = [BV[i] for i in range(nB) if is_eye[i] and BV[i].x < 0]
    eyeCL = sum(eL, Vector()) / len(eL); eyeCR = sum(eR, Vector()) / len(eR)
    eyeR = max((v - eyeCL).length for v in eL)
    print('[build] scale', round(s, 4), 'hips', round(hipZ, 3), 'knee', round(kneeZ, 3), 'shoulder', round(shZ, 3), round(shX, 3), 'neck', round(neckZ, 3), 'eyeL', tuple(round(x, 3) for x in eyeCL), 'eyeR', round(eyeR, 4))

    armchain = ('Arm', 'ForeArm', 'Hand')
    def is_arm(d): return any(d.startswith(sd + a) for sd in ('Left', 'Right') for a in armchain)

    # 4) 服の範囲（頂点単位）
    J = cfg['jersey']; SH = cfg['shorts']; SO = cfg['shoes']
    hemZ = kneeZ + SH.get('hem_above_knee', 0.05)
    waistZ = hipZ + SH.get('waist_above_hips', 0.10)
    jerseyBottom = hipZ + J.get('bottom_above_hips', -0.02)
    def in_shorts(i):
        if is_eye[i]: return False
        v = BV[i]; d = DOM[i]
        if is_arm(d) or 'Shoulder' in d: return False
        return hemZ <= v.z <= waistZ and not d.endswith('Foot') and abs(v.x) < 0.35
    def strap_limit(z):
        t = smoothstep(armpitZ - 0.03, shZ + 0.05, z)
        return (1 - t) * 0.40 + t * J.get('strap_x', 0.105)
    def in_jersey(i):
        if is_eye[i]: return False
        v = BV[i]; d = DOM[i]
        if d in ('Head', 'HeadTop_End') or d.endswith('ForeArm') or d.endswith('Hand'): return False
        if v.z < jerseyBottom: return False
        nhw = J.get('neck_half_width', 0.08)
        ax = abs(v.x)
        if v.z <= armpitZ:
            if is_arm(d): return False
        else:
            # そでぐり：わきの下から 肩の ひもへ なめらかに せまく
            outer = J.get('armhole_x', 0.19) * (1 - smoothstep(armpitZ, shZ + 0.04, v.z)) + J.get('strap_x', 0.125) * smoothstep(armpitZ, shZ + 0.04, v.z)
            if ax > outer: return False
        if d == 'Neck' and ax < nhw * 0.9: return False
        r = ax / nhw
        if r < 1:
            front = v.y < H('Neck').y
            shape = (1 - r) if (front and J.get('neck_shape') == 'v') else (1 - r * r)
            lim = neckZ - 0.012 - (J.get('neck_front_depth', 0.09) if front else J.get('neck_back_depth', 0.035)) * shape
            if v.z > lim: return False
        return True
    def in_shoe(i):
        if is_eye[i]: return False
        v = BV[i]; d = DOM[i]
        return (d.endswith('Foot') or d.endswith('ToeBase') or (d.endswith('Leg') and not d.endswith('UpLeg'))) and v.z < ankleZ + SO.get('collar_above_ankle', 0.035)
    SHORTS = [in_shorts(i) for i in range(nB)]
    JERSEY = [in_jersey(i) for i in range(nB)]
    SHOE = [in_shoe(i) for i in range(nB)]
    # 面の となり（辺を 共有）
    edge_faces = defaultdict(list)
    for fi, f in enumerate(BF):
        if BFG[fi] != 'body': continue
        for a_, b_ in zip(f, f[1:] + f[:1]): edge_faces[(min(a_, b_), max(a_, b_))].append(fi)
    fnb = defaultdict(set)
    for fl in edge_faces.values():
        for x in fl:
            for y in fl:
                if x != y: fnb[x].add(y)
    def region_faces(mask, close_iter=2, open_iter=1, keep_frac=0.15):
        sel = {fi for fi, f in enumerate(BF) if BFG[fi] == 'body' and all(mask[i] for i in f)}
        for _ in range(close_iter):   # 小さな 穴を うめる
            add = {fi for fi in fnb if fi not in sel and sum(1 for g in fnb[fi] if g in sel) >= 3}
            sel |= add
        for _ in range(open_iter):    # 細い ひげ・小島を けずる
            rem = {fi for fi in sel if sum(1 for g in fnb[fi] if g in sel) <= 1}
            sel -= rem
        comps = []; seen = set()
        for fi in sel:
            if fi in seen: continue
            comp = []; q = deque([fi]); seen.add(fi)
            while q:
                x = q.popleft(); comp.append(x)
                for y in fnb[x]:
                    if y in sel and y not in seen: seen.add(y); q.append(y)
            comps.append(comp)
        big = max(len(c) for c in comps)
        out = sorted(fi for c in comps if len(c) >= keep_frac * big for fi in c)
        return out

    # 5) 服のシェル（体の面をコピーして外へ押し出す → なめらかに → ふちを まっすぐに）
    def make_shell(name, mask, offset_fn, smooth_iters, lam=0.5, edge_iters=8):
        fids = region_faces(mask)
        vids = sorted({i for fi in fids for i in BF[fi]})
        rm = {o: n for n, o in enumerate(vids)}
        verts = [BV[i] + BN[i] * offset_fn(BV[i], BN[i], i) for i in vids]
        faces = [[rm[i] for i in BF[fi]] for fi in fids]
        sadj = [set() for _ in vids]
        edgecount = defaultdict(int)
        for f in faces:
            for a, b in zip(f, f[1:] + f[:1]):
                sadj[a].add(b); sadj[b].add(a); edgecount[(min(a, b), max(a, b))] += 1
        bedges = [e for e, c in edgecount.items() if c == 1]
        boundary = {i for e in bedges for i in e}
        badj = defaultdict(set)
        for a, b in bedges: badj[a].add(b); badj[b].add(a)
        laplacian(verts, sadj, set(range(len(verts))) - boundary, smooth_iters, lam)
        laplacian(verts, badj, boundary, edge_iters, 0.5)
        laplacian(verts, sadj, set(range(len(verts))) - boundary, 2, 0.4)
        return dict(name=name, src=vids, verts=verts, faces=faces, adj=sadj, boundary=boundary, fids=fids)

    def jersey_off(v, n, i):
        return J.get('offset', 0.011) + J.get('hem_flare', 0.018) * smoothstep(jerseyBottom + 0.20, jerseyBottom, v.z)
    jersey = make_shell('No7_Jersey', JERSEY, jersey_off, J.get('smooth', 6))
    def shorts_off(v, n, i):
        t = smoothstep(hipZ - 0.05, hemZ, v.z)
        off = SH.get('offset', 0.018) + SH.get('hem_flare', 0.05) * t
        side = math.copysign(1, v.x) if abs(v.x) > 1e-4 else 0
        inner = n.x * side < -0.3 and v.z < hipZ - 0.08
        return off * (0.55 if inner else 1.0)
    shorts = make_shell('No7_Shorts', SHORTS, shorts_off, SH.get('smooth', 8))
    for i in shorts['boundary']:
        v = shorts['verts'][i]
        if v.z < hipZ - 0.1: v.z = min(v.z, hemZ + 0.012)
    footY = {1: H('LeftFoot').y, -1: H('RightFoot').y}
    def shoe_off(v, n, i):
        fwd = smoothstep(0.02, 0.16, footY[1 if v.x > 0 else -1] - v.y)   # つま先がわ ほど ふっくら
        low = smoothstep(ankleZ + 0.02, 0.02, v.z)
        return SO.get('offset', 0.013) + SO.get('toe_boost', 0.008) * fwd * (0.4 + 0.6 * low) + SO.get('side_boost', 0.004) * low
    shoes = make_shell('No7_Shoes', SHOE, shoe_off, SO.get('smooth', 3))
    soleT = SO.get('sole_thickness', 0.022)
    for k, v in enumerate(shoes['verts']):
        if v.z < soleT:
            t = 1 - v.z / soleT
            n = BN[shoes['src'][k]]
            v.x += n.x * 0.006 * t; v.y += n.y * 0.008 * t
            v.z = max(-SO.get('sole_drop', 0.012), v.z - 0.012 * t)
            if v.z < 0.004: v.z = -SO.get('sole_drop', 0.012)

    # 6) 服の下に かくれる 体の面を けす（ふち付近は残す）
    def mask_of(shell):
        m = [False] * nB
        for fi in shell['fids']:
            for i in BF[fi]: m[i] = True
        return m
    hidden = [False] * nB
    for mask, margin in ((mask_of(shorts), 2), (mask_of(jersey), 2), (mask_of(shoes), 2)):
        seeds = [i for i in range(nB) if mask[i] and any(not mask[j] for j in adj[i])]
        d = ring_distance(nB, adj, seeds, 8)
        for i in range(nB):
            if mask[i] and d[i] >= margin: hidden[i] = True
    keepF = [fi for fi, f in enumerate(BF) if BFG[fi] == 'body' and not all(hidden[i] for i in f)]
    eyeF = [fi for fi in range(len(BF)) if BFG[fi] != 'body']

    # ------------------------------------------------------------ Blender オブジェクト化
    MATS = {
        'skin': new_mat('Skin', col['skin'], 0.6), 'sock': new_mat('Sock', col['sock'], 0.9),
        'brow': new_mat('Brow', col['brow'], 0.9), 'lash': new_mat('Lash', col['lash'], 0.9),
        'scalp': new_mat('HairShort', col['hair_short'], 0.9),
        'sclera': new_mat('EyeWhite', col['eye_white'], 0.3), 'iris': new_mat('Iris', col['iris'], 0.3), 'pupil': new_mat('Pupil', col['pupil'], 0.3),
        'trim': new_mat('Trim', col['trim'], 0.7, double=True), 'shorts': new_mat('ShortsBlue', col['shorts'], 0.8, double=True),
        'shoe': new_mat('ShoeUpper', col['shoe'], 0.5), 'sole': new_mat('ShoeSole', col['sole'], 0.6), 'shoe_accent': new_mat('ShoeAccent', col['shoe_accent'], 0.5),
        'hair': new_mat('Hair', col['hair'], 0.85),
    }
    img = make_number_texture(cfg)
    MATS['shoe_tex'] = new_mat('Shoe', (1, 1, 1, 1), 0.5, image=make_shoe_texture(cfg))
    MATS['shorts_tex'] = new_mat('ShortsBlue', (1, 1, 1, 1), 0.8, double=True, image=make_stripe_texture(cfg))
    MATS['jersey'] = new_mat('JerseyBlue', (1, 1, 1, 1), 0.8, double=True, image=img)

    def build_obj(name, verts, faces, matnames, weights_of, uvs=None):
        ob = mesh_object(name, verts, faces, coll)
        me = ob.data
        order = []
        for mn in matnames:
            if mn not in order: order.append(mn)
        for mn in order: me.materials.append(MATS[mn])
        for p, mn in zip(me.polygons, matnames): p.material_index = order.index(mn)
        for p in me.polygons: p.use_smooth = True
        if uvs is not None:
            uvl = me.uv_layers.new(name='UVMap')
            for p in me.polygons:
                for li, vi in zip(p.loop_indices, p.vertices):
                    uvl.data[li].uv = uvs(p.index, vi)
        groups = {}
        for vi in range(len(verts)):
            for bn, w in weights_of(vi).items():
                if bn not in groups: groups[bn] = ob.vertex_groups.new(name=bn)
                groups[bn].add([vi], w, 'REPLACE')
        return ob

    def subdivide(ob, levels=1):
        bpy.context.view_layer.objects.active = ob
        for o2 in bpy.data.objects: o2.select_set(o2 == ob)
        md = ob.modifiers.new('sub', 'SUBSURF'); md.levels = levels; md.render_levels = levels
        md.uv_smooth = 'PRESERVE_BOUNDARIES'
        bpy.ops.object.modifier_apply(modifier='sub')

    def sub_mesh(fids):
        rmx = {}; verts = []
        for fi in fids:
            for i in BF[fi]:
                if i not in rmx: rmx[i] = len(verts); verts.append(BV[i])
        inv = {n: o for o, n in rmx.items()}
        return verts, [[rmx[i] for i in BF[fi]] for fi in fids], inv

    # 体：細分割してから 面ごとに 色（肌・靴下・まゆ・アイライン・短い髪）
    bverts, bfaces, binv = sub_mesh(keepF)
    body = build_obj('No7_Body', bverts, bfaces, ['skin'] * len(bfaces), lambda vi: VW[binv[vi]])
    subdivide(body, cfg['body'].get('subdiv', 1))
    hair_pts = [P[i] for i in sorted(hair_ids)]
    from mathutils.kdtree import KDTree
    kd = KDTree(len(hair_pts))
    for k, p in enumerate(hair_pts): kd.insert(p, k)
    kd.balance()
    hairY0 = min(p.y for p in hair_pts); hairY1 = max(p.y for p in hair_pts)
    HC = dict(cfg['hair']); FC = cfg['face']
    for k_ in ('hairline_above_eyes', 'fade_side_above_eyes', 'curl_front_above_eyes', 'curl_side_above_eyes'):
        if k_ in HC: HC[k_] = HC[k_] * HS
    eyeZ = (eyeCL.z + eyeCR.z) / 2
    headC = Vector((0.0, (hairY0 + hairY1) / 2, 0.0))
    def head_angle(p):
        # 0 = 正面、90 = 横、180 = 後ろ
        return math.degrees(math.atan2(abs(p.x - headC.x), -(p.y - headC.y)))
    def band(p, front, side, back):
        a = head_angle(p)
        if a < 90: t = smoothstep(35, 90, a); return front * (1 - t) + side * t
        t = smoothstep(100, 160, a); return side * (1 - t) + back * t
    def scalp_lim(p):
        return band(p, eyeZ + HC.get('hairline_above_eyes', 0.058), eyeZ + HC.get('fade_side_above_eyes', 0.012), H('Neck').z + HC.get('fade_nape_above_neck', 0.035))
    def curl_lim(p):
        return band(p, eyeZ + HC.get('curl_front_above_eyes', 0.062), eyeZ + HC.get('curl_side_above_eyes', 0.05), H('Neck').z + HC.get('curl_back_above_neck', 0.085))
    sockTop = ankleZ + cfg['socks'].get('height_above_ankle', 0.16)
    me = body.data
    order = ['skin', 'sock', 'brow', 'lash', 'scalp']
    me.materials.clear()
    for mn in order: me.materials.append(MATS[mn])
    vg_names = {g.index: g.name for g in body.vertex_groups}
    gi_head = [g.index for g in body.vertex_groups if g.name in ('mixamorig:Head', 'mixamorig:HeadTop_End')]
    head_w = [sum(e.weight for e in v.groups if e.group in gi_head) for v in me.vertices]
    for poly in me.polygons:
        c = poly.center; m = 'skin'
        if ankleZ - 0.02 < c.z < sockTop: m = 'sock'
        if c.z > neckZ - 0.02:
            hw = sum(head_w[vi] for vi in poly.vertices) / len(poly.vertices)
            if hw > 0.6 and c.z > scalp_lim(c) and not (head_angle(c) < 60 and c.z < eyeZ + 0.05): m = 'scalp'
            for ec in ((eyeCL, eyeCR) if not FC.get('decal', False) else ()):
                if c.y > ec.y + 0.012: continue
                dx = c.x - ec.x; dz = c.z - ec.z
                bx = dx * (1 if ec.x > 0 else -1)
                arch = ec.z + FC.get('brow_up', 0.026) + FC.get('brow_arch', 0.006) * (1 - (bx / 0.024) ** 2) - FC.get('brow_tilt', 0.004) * (bx / 0.024)
                if FC.get('brow_in', -0.017) < bx < FC.get('brow_out', 0.026) and abs(c.z - arch) < FC.get('brow_thick', 0.005) * (1.15 - 0.4 * smoothstep(0.0, 0.026, bx)): m = 'brow'
                rr = math.hypot(dx / 1.15, dz)
                if eyeR * FC.get('liner_in', 0.92) < rr < eyeR * FC.get('liner_out', 1.22) and dz > eyeR * FC.get('liner_low', 0.2) and -eyeR * 1.15 < bx < eyeR * 1.35: m = 'lash'
        poly.material_index = order.index(m)
        poly.use_smooth = True

    # ゲームの ふちどりの 太さ（頂点カラー R）：顔の 前は 0（目・口・鼻の みぞに 黒い 線が 出ないように）
    ca = me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    for v in me.vertices:
        c = v.co
        k = 1.0
        if c.z > neckZ:
            a = head_angle(c)
            inface = (1 - smoothstep(45, 70, a)) * smoothstep(eyeZ - 0.12, eyeZ - 0.10, c.z) * (1 - smoothstep(eyeZ + 0.035, eyeZ + 0.05, c.z))
            k = 1.0 - inface
        ca.data[v.index].color = (k, k, k, 1.0)
    me.color_attributes.active_color = ca

    # 目
    everts, efaces, einv = sub_mesh(eyeF)
    eyes = build_obj('No7_Eyes', everts, efaces, ['sclera'] * len(efaces), lambda vi: {'mixamorig:Head': 1.0})
    subdivide(eyes, 1)
    me = eyes.data; order = ['sclera', 'iris', 'pupil']
    for mn in order[1:]: me.materials.append(MATS[mn])
    for poly in me.polygons:
        c = poly.center; ctr = eyeCL if c.x > 0 else eyeCR
        dv = (c - ctr).normalized(); ang = math.degrees(math.acos(max(-1, min(1, -dv.y))))
        poly.material_index = 2 if ang < cfg['eyes'].get('pupil_deg', 13) else 1 if ang < cfg['eyes'].get('iris_deg', 27) else 0

    def boundary_kd(ob, keep):
        from mathutils.kdtree import KDTree
        me = ob.data; cnt = defaultdict(int)
        for p in me.polygons:
            for ek in p.edge_keys: cnt[ek] += 1
        pts = []
        for (a, b), c in cnt.items():
            if c != 1: continue
            va, vb = me.vertices[a].co, me.vertices[b].co
            for t in (0.0, 0.5):
                q = va.lerp(vb, t)
                if keep(q): pts.append(q.copy())
        kd = KDTree(max(1, len(pts)))
        for k, q in enumerate(pts): kd.insert(q, k)
        kd.balance(); return kd, len(pts)
    def set_mats(ob, names, pick):
        me = ob.data; me.materials.clear()
        for mn in names: me.materials.append(MATS[mn])
        for poly in me.polygons: poly.material_index = names.index(pick(poly))

    # ジャージ（首・そでぐりに 黄色の ふち）。UV：背中は左半分、胸は右半分、横は 青一色の場所
    jv = jersey['verts']
    jfn = []
    for f in jersey['faces']:
        a_, b_, c_ = jv[f[0]], jv[f[1]], jv[f[2]]; jfn.append((b_ - a_).cross(c_ - a_).normalized())
    NB = cfg['number']
    jyc = sum(v.y for v in jv) / len(jv)
    jz0 = jerseyBottom; jz1 = shZ + 0.06
    def juv(pi, vi):
        n = jfn[pi]; v = jv[vi]
        if n.y > 0.25:
            u = 0.25 - 0.5 * v.x / NB['back_span']; w = 0.5 + (v.z - NB['back_center_z']) / NB['back_span']
            return (min(0.499, max(0.001, u)), 0.5 + 0.5 * min(0.998, max(0.002, w)))
        if n.y < -0.25:
            u = 0.75 + 0.5 * v.x / NB['front_span']; w = 0.5 + (v.z - NB['front_center_z']) / NB['front_span']
            return (min(0.999, max(0.501, u)), 0.5 + 0.5 * min(0.998, max(0.002, w)))
        # 横：前(0)→後ろ(1)、すそ(0)→わき(0.5)
        u = 0.5 + (v.y - jyc) / J.get('side_span', 0.30); w = 0.5 * (v.z - jz0) / (jz1 - jz0)
        return (min(0.999, max(0.001, u)), min(0.498, max(0.002, w)))
    jersey_ob = build_obj('No7_Jersey', jv, jersey['faces'], ['jersey'] * len(jersey['faces']), lambda vi: VW[jersey['src'][vi]], uvs=juv)
    subdivide(jersey_ob, 1)
    print('[build] jersey ribbons', add_ribbons(jersey_ob, MATS['trim'], lambda c, pts: c.z > jerseyBottom + 0.05, J.get('trim_width', 0.016)))

    # ショーツ（すそ・ウエストに 黄色の 帯、よこの ラインは テクスチャ）
    sv = shorts['verts']
    legX = abs(H('LeftUpLeg').x); legY = H('LeftUpLeg').y
    def suv(pi, vi):
        v = sv[vi]; sx = 1 if v.x >= 0 else -1
        ang = math.atan2(v.y - legY, (v.x - sx * legX) * sx)  # 外がわ = 0 → u=0.5（つなぎ目は 内もも）
        return ((ang / (2 * math.pi) + 0.5) % 1.0, 0.5)
    shorts_ob = build_obj('No7_Shorts', sv, shorts['faces'], ['shorts_tex'] * len(shorts['faces']), lambda vi: VW[shorts['src'][vi]], uvs=suv)
    subdivide(shorts_ob, 1)
    print('[build] shorts ribbons', add_ribbons(shorts_ob, MATS['trim'], lambda c, pts: c.z < hipZ - 0.1, SH.get('hem_width', 0.024)),
          add_ribbons(shorts_ob, MATS['trim'], lambda c, pts: c.z > hipZ, SH.get('waist_width', 0.026), outset=0.0))

    # くつ（こん色、白い くつ底、黄色の はき口と よこの ライン）
    # くつの 色は 横から 投影した テクスチャ（くつ底の 白、よこの ライン、かかと）で なめらかに
    shv = shoes['verts']
    sy0 = min(v.y for v in shv); sy1 = max(v.y for v in shv); sz1 = max(v.z for v in shv)
    shfn = []
    for f in shoes['faces']:
        a_, b_, c_ = shv[f[0]], shv[f[1]], shv[f[2]]; shfn.append((b_ - a_).cross(c_ - a_).normalized())
    def shuv(pi, vi):
        v = shv[vi]; fy = footY[1 if v.x > 0 else -1]
        u = (v.y - fy + 0.20) / 0.30
        if abs(shfn[pi].x) < 0.45: u = 0.04   # 前・後ろ・上の 面は ラインなし（くつ底の 白だけ）
        return (u, (v.z + 0.02) / 0.16)
    shoes_ob = build_obj('No7_Shoes', shv, shoes['faces'], ['shoe_tex'] * len(shoes['faces']), lambda vi: VW[shoes['src'][vi]], uvs=shuv)
    subdivide(shoes_ob, 1)
    print('[build] shoe ribbons', add_ribbons(shoes_ob, MATS['shoe_accent'], lambda c, pts: c.z > 0.04, SO.get('collar_width', 0.012), outset=0.002))

    # 6.5) アニメ風の 目と まゆ（顔の 前に うすい シートを はって 絵を のせる）
    decal_ob = None
    if FC.get('decal', False):
        decal_ob = make_face_decal(cfg, [body, eyes], eyeCL, eyeCR, coll)
        for poly in eyes.data.polygons: poly.material_index = 0
        eyes.data.materials[0] = MATS['skin']

    # 7) カーリーヘア（頭の上の部分だけ。メタボールの つぶを ならべて 1つの メッシュに）
    hair_ob = make_hair(cfg, hair_pts, H, eyeCL, eyeCR, coll, MATS['hair'], curl_lim)

    # 8) アーマチュア
    arm_data = bpy.data.armatures.new('Armature'); arm = bpy.data.objects.new('Armature', arm_data); coll.objects.link(arm)
    bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
    for n, b in rig.items():
        eb = arm_data.edit_bones.new(n); eb.head = heads[n]; eb.tail = tails[n]; eb.roll = b.get('roll', 0)
        if (eb.tail - eb.head).length < 1e-4: eb.tail = eb.head + Vector((0, 0, 0.02))
    for n, b in rig.items():
        if b.get('parent'): arm_data.edit_bones[n].parent = arm_data.edit_bones[b['parent']]
    # くつ底の ぶんだけ 全体を 持ち上げて、くつ底を 床（z=0）に
    lift = SO.get('sole_drop', 0.012)
    for eb in arm_data.edit_bones: eb.head.z += lift; eb.tail.z += lift
    bpy.ops.object.mode_set(mode='OBJECT')
    meshes = [body, eyes, jersey_ob, shorts_ob, shoes_ob, hair_ob] + ([decal_ob] if decal_ob else [])
    for ob in meshes: ob.data.transform(Matrix.Translation((0, 0, lift)))
    zmin_all = min((v.co.z for ob in meshes for v in ob.data.vertices))
    print('[build] lowest point (should be ~0):', round(zmin_all, 4))
    for ob in meshes:
        ob.parent = arm
        md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = arm

    # 9) 立ちポーズを ゲーム向けに：腕を 少し下げた A ポーズ、指を 軽く まるめる → これを 新しい 基準姿勢に
    rest_pose(arm, meshes, cfg)

    # アニメ風の 影：顔の 法線を だ円体の 向きに よせる（鼻や ほおの 細かい 影が 出ず、すっきり した 陰に なる）
    if AN.get('face_normals', 0):
        Cn = Vector((0, headCy + AN.get('ell_y', 0.01) * HS, eZ0 - AN.get('ell_down', 0.035) * HS))
        ax = Vector(AN.get('ellipsoid', [0.075, 0.095, 0.11])) * HS
        for ob in [body] + ([decal_ob] if decal_ob else []):
            me = ob.data; vn = []
            for v in me.vertices:
                f = (face_w(v.co) if ob is body else 1.0) * AN['face_normals']
                d = v.co - Cn
                ne = Vector((d.x / ax.x ** 2, d.y / ax.y ** 2, d.z / ax.z ** 2)).normalized()
                vn.append(v.normal.lerp(ne, f).normalized())
            me.normals_split_custom_set_from_vertices(vn)

    # 10) GLB 書き出し
    for ob in bpy.data.objects: ob.select_set(ob in meshes or ob == arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=out_path, export_format='GLB', use_selection=True, export_skins=True,
                              export_animations=False, export_morph=False, export_yup=True, export_apply=False,
                              export_texcoords=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO',
                              export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True)
    if blend_path: bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    stats = {ob.name: len(ob.data.vertices) for ob in meshes}
    print('[build] wrote', out_path, os.path.getsize(out_path), 'bytes', stats)


def add_ribbons(ob, mat, keep, width, outset=0.003, lift=0.0045, smooth_iters=12):
    """服の ふち（穴の まわり）に 細い 帯を つける。ギザギザに ならない ように ふちの 線を なめらかにしてから 帯を 作る"""
    me = ob.data
    if mat.name not in [m.name for m in me.materials]: me.materials.append(mat)
    mi = [m.name for m in me.materials].index(mat.name)
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    dl = bm.verts.layers.deform.verify()
    VS = list(bm.verts)
    bedges = [e for e in bm.edges if e.is_boundary]
    nb = defaultdict(list)
    for e in bedges:
        a, b = e.verts; nb[a.index].append(b.index); nb[b.index].append(a.index)
    seen = set(); loops = []
    for st in list(nb.keys()):
        if st in seen or len(nb[st]) != 2: continue
        loop = [st]; seen.add(st); prev = None; cur = st
        while True:
            nxt = [x for x in nb[cur] if x != prev and len(nb[x]) == 2]
            if not nxt: break
            n = nxt[0]
            if n == st: break
            if n in seen: break
            loop.append(n); seen.add(n); prev, cur = cur, n
        if len(loop) > 8: loops.append(loop)
    made = 0
    for loop in loops:
        pts = [VS[i].co.copy() for i in loop]
        c = sum(pts, Vector()) / len(pts)
        if not keep(c, pts): continue
        N = len(loop)
        for _ in range(smooth_iters):
            pts = [pts[k].lerp((pts[k - 1] + pts[(k + 1) % N]) * 0.5, 0.5) for k in range(N)]
        new_outer, new_inner = [], []
        for k, vi in enumerate(loop):
            v = VS[vi]
            n = v.normal.copy()
            t = (pts[(k + 1) % N] - pts[k - 1]).normalized()
            # 内がわ（布の ある がわ）
            inner_dir = Vector()
            for f in v.link_faces: inner_dir += f.calc_center_median() - v.co
            inner_dir -= t * inner_dir.dot(t); inner_dir -= n * inner_dir.dot(n)
            inner_dir = inner_dir.normalized() if inner_dir.length > 1e-9 else Vector((0, 0, 1))
            o = bm.verts.new(pts[k] - inner_dir * outset + n * lift)
            i2 = bm.verts.new(pts[k] + inner_dir * width + n * lift)
            for nv in (o, i2):
                for g, w in v[dl].items(): nv[dl][g] = w
            new_outer.append(o); new_inner.append(i2)
        for _ in range(smooth_iters):
            for arr in (new_outer, new_inner):
                cs = [v_.co.copy() for v_ in arr]
                for k in range(N): arr[k].co = cs[k].lerp((cs[k - 1] + cs[(k + 1) % N]) * 0.5, 0.5)
        for k in range(N):
            k2 = (k + 1) % N
            try:
                f = bm.faces.new((new_outer[k], new_outer[k2], new_inner[k2], new_inner[k]))
                f.material_index = mi; f.smooth = True
            except ValueError:
                pass
        made += 1
    bm.normal_update()
    bm.to_mesh(me); bm.free(); me.update()
    return made


def rest_pose(arm, meshes, cfg):
    rp = cfg.get('rest_pose', {})
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE')
    pb = arm.pose.bones
    down = math.radians(rp.get('arm_down_deg', 40))
    for side, sgn in (('Left', 1), ('Right', -1)):
        b = pb.get(f'mixamorig:{side}Arm')
        if b:
            b.rotation_mode = 'XYZ'
            # 腕を下げる：ワールドの 前後軸(Y)まわりに 回す
            Rw = Matrix.Rotation(sgn * down, 4, 'Y')
            mw = arm.matrix_world @ b.matrix
            b.matrix = arm.matrix_world.inverted() @ (Matrix.Translation(mw.to_translation()) @ Rw @ Matrix.Translation(-mw.to_translation()) @ mw)
            bpy.context.view_layer.update()
        curl = math.radians(rp.get('finger_curl_deg', 22))
        for fname in ('Index', 'Middle', 'Ring', 'Pinky'):
            for k in (1, 2, 3):
                fb = pb.get(f'mixamorig:{side}Hand{fname}{k}')
                if not fb: continue
                fb.rotation_mode = 'XYZ'
                # 指の まげ方向：手のひら側（ボーンの ローカル軸で 決める）
                # T ポーズでは 手のひらが 下向き → 指を 下（-Z）へ まげる軸 = 指の向き × (-Z)
                side_axis = (fb.bone.matrix_local.to_3x3() @ Vector((0, 1, 0))).cross(Vector((0, 0, -1)))
                loc_axis = fb.bone.matrix_local.to_3x3().inverted() @ side_axis
                fb.rotation_mode = 'AXIS_ANGLE'
                fb.rotation_axis_angle = (curl * (0.8 if k == 1 else 1.0), *loc_axis.normalized())
        tb = pb.get(f'mixamorig:{side}HandThumb1')
    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')
    # 姿勢を メッシュに 焼きこむ → その姿勢を 基準に
    for ob in meshes:
        bpy.context.view_layer.objects.active = ob
        for o2 in bpy.data.objects: o2.select_set(o2 == ob)
        bpy.ops.object.modifier_apply(modifier='Armature')
    bpy.context.view_layer.objects.active = arm
    for o2 in bpy.data.objects: o2.select_set(o2 == arm)
    bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
    for ob in meshes:
        md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = arm


def need_pil():
    try:
        import PIL  # noqa: F401
    except ImportError:
        sys.exit('Pillow が ありません。Blender 付属の Python なら次を 1回 実行してください:\n'
                 '  blender -b --python-expr "import subprocess,sys; subprocess.check_call([sys.executable,\'-m\',\'pip\',\'install\',\'pillow\'])"')

def make_number_texture(cfg):
    """背番号の 絵（左半分＝背中、右半分＝胸）。ジャージの 青の 上に 黄色の 数字と こん色の ふち"""
    need_pil()
    from PIL import Image, ImageDraw, ImageFont
    NB = cfg['number']; W, Hh = 1024, 512
    def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    im = Image.new('RGB', (W, Hh * 2), rgb(cfg['colors']['jersey']))
    d = ImageDraw.Draw(im)
    font_path = NB.get('font', '/usr/share/fonts/truetype/google-fonts/ofl/anton/Anton-Regular.ttf')
    if not os.path.isabs(font_path): font_path = os.path.join(HERE, font_path)
    txt = str(NB['text'])
    for cx, size_frac in ((W * 0.25, NB.get('back_size', 0.62)), (W * 0.75, NB.get('front_size', 0.5))):
        size = int(Hh * size_frac * 1.25)
        fnt = ImageFont.truetype(font_path, size)
        bb = d.textbbox((0, 0), txt, font=fnt)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        x = cx - tw / 2 - bb[0]; y = Hh / 2 - th / 2 - bb[1]
        ow = max(6, size // 16)
        d.text((x, y), txt, font=fnt, fill=rgb(cfg['colors']['number_outline']), stroke_width=ow, stroke_fill=rgb(cfg['colors']['number_outline']))
        d.text((x, y), txt, font=fnt, fill=rgb(cfg['colors']['number']))
    # 横の 切りかえパネル（下半分：横 = 前→後ろ、上 = わき）
    J = cfg['jersey']; pw = J.get('side_panel_w', 0.05) / J.get('side_span', 0.30) * W / 2
    if pw > 0:
        top = Hh + 2; bot = Hh * 2
        d.polygon([(W / 2 - pw * 0.7, top), (W / 2 + pw * 0.7, top), (W / 2 + pw, bot), (W / 2 - pw, bot)], fill=rgb(cfg['colors'].get('side_panel', cfg['colors']['trim'])))
    path = os.path.join(bpy.app.tempdir or '/tmp', 'number_tex.png')
    im.save(path)
    img = bpy.data.images.load(path); img.pack(); img.name = 'jersey_number'
    return img


def make_face_decal(cfg, targets, eyeCL, eyeCR, coll):
    """顔の 前に 格子の シートを 前から 投げて 顔の 表面に はりつけ、アニメ風の 目・まゆの 絵を のせる"""
    need_pil()
    from PIL import Image, ImageDraw
    FC = cfg['face']; C = cfg['colors']
    def rgb(h, a=255): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)
    ipd = eyeCL.x - eyeCR.x                      # 目と目の 間（頭の 大きさに 合わせて 絵も 大きくなる）
    eZ = (eyeCL.z + eyeCR.z) / 2; eY = min(eyeCL.y, eyeCR.y)
    x0 = eyeCR.x - ipd * 0.95; x1 = eyeCL.x + ipd * 0.95
    z0 = eZ - ipd * 1.75; z1 = eZ + ipd * 1.05
    NX, NZ = 48, 36
    bvhs = []
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in targets:
        bm = bmesh.new(); bm.from_mesh(ob.data); bm.transform(ob.matrix_world)
        bvhs.append(BVHTree.FromBMesh(bm)); bm.free()
    verts = []; ok = []
    for j in range(NZ + 1):
        for i in range(NX + 1):
            x = x0 + (x1 - x0) * i / NX; z = z0 + (z1 - z0) * j / NZ
            best = None
            for bv in bvhs:
                hit = bv.ray_cast(Vector((x, eY - 0.3, z)), Vector((0, 1, 0)), 0.6)
                if hit[0] is not None and (best is None or hit[3] < best[3]): best = hit
            if best is None: verts.append(Vector((x, eY, z))); ok.append(False); continue
            nrm = best[1] if best[1].y < 0 else -best[1]
            verts.append(best[0] + nrm * FC.get('decal_lift', 0.0012) + Vector((0, -0.0004, 0))); ok.append(True)
    faces = []; uvs = []
    for j in range(NZ):
        for i in range(NX):
            a = j * (NX + 1) + i; q = [a, a + 1, a + NX + 2, a + NX + 1]
            if not all(ok[k] for k in q): continue
            if max((verts[q[0]] - verts[q[2]]).length, (verts[q[1]] - verts[q[3]]).length) > 0.02: continue
            faces.append(q)
    me = bpy.data.meshes.new('No7_FaceDecal'); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    uvl = me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        for li, vi in zip(p.loop_indices, p.vertices):
            i = vi % (NX + 1); j = vi // (NX + 1); uvl.data[li].uv = (i / NX, j / NZ)
        p.use_smooth = True
    # 絵（4倍で 描いて 縮小 → なめらかな ふち）
    TW = 1024; TH = int(TW * (z1 - z0) / (x1 - x0)); SS = 3
    im = Image.new('RGBA', (TW * SS, TH * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    def P(x, z): return ((x - x0) / (x1 - x0) * TW * SS, (1 - (z - z0) / (z1 - z0)) * TH * SS)
    import math as m_
    ew = ipd * FC.get('eye_w', 0.46); eh = ipd * FC.get('eye_h', 0.27)
    for side, ec in ((1, eyeCL), (-1, eyeCR)):
        cx = ec.x + side * ipd * FC.get('eye_out', 0.02); cz = eZ + ipd * FC.get('eye_up', 0.02)
        def pt(t, upper):   # t: 0=目頭 1=目じり
            xx = cx + side * (t - 0.5) * ew
            if upper:
                zz = cz + eh * (0.55 * m_.sin(m_.pi * min(1, t * 1.05)) ** 0.8) - eh * 0.10 * t + eh * 0.10
            else:
                zz = cz - eh * 0.38 * m_.sin(m_.pi * t) ** 1.2 + eh * 0.10 * (1 - t) - eh * 0.05
            return P(xx, zz)
        N = 40
        up = [pt(k / N, True) for k in range(N + 1)]; lo = [pt(k / N, False) for k in range(N + 1)]
        white = up + lo[::-1]
        mask = Image.new('L', im.size, 0); ImageDraw.Draw(mask).polygon(white, fill=255)
        layer = Image.new('RGBA', im.size, (0, 0, 0, 0)); dl = ImageDraw.Draw(layer)
        dl.polygon(white, fill=rgb(C['eye_white']))
        ir = eh * FC.get('iris_r', 0.62); ix, iz = cx + side * ew * 0.03, cz + eh * 0.02
        (px, pz) = P(ix, iz); rx = ir / (x1 - x0) * TW * SS * 0.92; rz = ir / (z1 - z0) * TH * SS
        dl.ellipse([px - rx, pz - rz, px + rx, pz + rz], fill=rgb(C['iris_dark']))
        dl.ellipse([px - rx * 0.86, pz - rz * 0.80, px + rx * 0.86, pz + rz * 0.92], fill=rgb(C['iris']))
        dl.ellipse([px - rx * 0.86, pz + rz * 0.05, px + rx * 0.86, pz + rz * 0.92], fill=rgb(C['iris_light']))
        dl.ellipse([px - rx * 0.42, pz - rz * 0.40, px + rx * 0.42, pz + rz * 0.45], fill=rgb(C['pupil']))
        hx, hz = px + side * -rx * 0.35, pz - rz * 0.42
        dl.ellipse([hx - rx * 0.28, hz - rz * 0.24, hx + rx * 0.28, hz + rz * 0.24], fill=(255, 255, 255, 255))
        dl.ellipse([px + side * rx * 0.30 - rx * 0.12, pz + rz * 0.35 - rz * 0.1, px + side * rx * 0.30 + rx * 0.12, pz + rz * 0.35 + rz * 0.1], fill=(255, 255, 255, 230))
        layer.putalpha(Image.composite(layer.split()[3], Image.new('L', im.size, 0), mask))
        im.alpha_composite(layer)
        # 上まぶたの 太い 線（目じりへ 太く、はねる）
        lw = ipd / (x1 - x0) * TW * SS
        for k in range(N):
            t = k / N; w = lw * (0.035 + 0.06 * t ** 1.4)
            d.line([up[k], up[k + 1]], fill=rgb(C['lash']), width=max(2, int(w)))
        ex, ez = up[-1]
        d.polygon([up[-4], (ex + side * lw * 0.12, ez - lw * 0.05), (ex + side * lw * 0.02, ez + lw * 0.06)], fill=rgb(C['lash']))
        # 下まぶた（目じりがわ だけ 細く）
        for k in range(int(N * 0.45), N):
            d.line([lo[k], lo[k + 1]], fill=rgb(C['lash'], 220), width=max(2, int(lw * 0.022)))
        # 二重の 線
        dbl = [pt(k / N, True) for k in range(int(N * 0.25), N)]
        dbl = [(x_, z_ - eh / (z1 - z0) * TH * SS * 0.30) for x_, z_ in dbl]
        for k in range(len(dbl) - 1): d.line([dbl[k], dbl[k + 1]], fill=rgb(C['lash'], 170), width=max(2, int(lw * 0.015)))
        # まゆ（目頭がわ 太く、少し 下がる → きりっと）
        bz = eZ + ipd * FC.get('brow_up_ipd', 0.40)
        def bp(t):
            xx = cx + side * (t - 0.55) * ew * 1.25
            zz = bz + ipd * (0.06 * m_.sin(m_.pi * t) - FC.get('brow_slant', 0.07) * (1 - t))
            return xx, zz
        top = []; bot = []
        for k in range(N + 1):
            t = k / N; xx, zz = bp(t); th = ipd * (FC.get('brow_thick_ipd', 0.13) * (1 - t) + 0.03)
            top.append(P(xx, zz + th * 0.5)); bot.append(P(xx, zz - th * 0.5))
        d.polygon(top + bot[::-1], fill=rgb(C['brow']))
    # 口：口角の みぞを 肌色で かくし、アニメ風の 口の 線を かく
    HSd = cfg['body'].get('head_scale', 1.0)
    mz = eZ - FC.get('mouth_below_eyes', 0.072) * HSd
    nzv = eZ - FC.get('nose_below_eyes', 0.042) * HSd
    (n1x, n1z) = P(ipd * 0.03, nzv + ipd * 0.05); (n2x, n2z) = P(ipd * 0.06, nzv); (n3x, n3z) = P(-ipd * 0.01, nzv - ipd * 0.005)
    d.line([(n1x, n1z), (n2x, n2z), (n3x, n3z)], fill=rgb(C.get('nose_line', '#9a5a3a'), 220), width=max(2, int(ipd / (x1 - x0) * TW * SS * 0.03)))
    mw = ipd * FC.get('mouth_w', 0.55)
    (ax_, az_) = P(-mw * 0.75, mz + ipd * 0.07); (bx_, bz_) = P(mw * 0.75, mz - ipd * 0.07)
    d.ellipse([ax_, az_, bx_, bz_], fill=rgb(C['skin']))
    pts = [P(-mw / 2 + mw * k / 20, mz - ipd * 0.025 * m_.sin(m_.pi * k / 20) + ipd * 0.008) for k in range(21)]
    lw = ipd / (x1 - x0) * TW * SS
    for k in range(20): d.line([pts[k], pts[k + 1]], fill=rgb(C['lash'], 235), width=max(2, int(lw * FC.get('mouth_line', 0.045) * (0.5 + 0.7 * m_.sin(m_.pi * k / 20)))))
    im = im.resize((TW, TH), Image.LANCZOS)
    path = os.path.join(bpy.app.tempdir or '/tmp', 'face_decal.png'); im.save(path)
    img = bpy.data.images.load(path); img.pack(); img.name = 'face_decal'
    mat = bpy.data.materials.new('FaceDecal'); mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = img
    mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    mat.node_tree.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    try: mat.blend_method = 'CLIP'
    except Exception: pass
    try: mat.surface_render_method = 'DITHERED'
    except Exception: pass
    me.materials.append(mat)
    ob = bpy.data.objects.new('No7_FaceDecal', me); coll.objects.link(ob)
    g = ob.vertex_groups.new(name='mixamorig:Head'); g.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    print('[build] face decal faces', len(faces), 'tex', TW, TH)
    return ob

def make_stripe_texture(cfg):
    """ショーツの よこ ライン（u=0 が 外がわ）"""
    from PIL import Image, ImageDraw
    def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    W = 512; im = Image.new('RGB', (W, 8), rgb(cfg['colors']['shorts'])); d = ImageDraw.Draw(im)
    hw = cfg['shorts'].get('stripe_half_u', 0.022) * W
    d.rectangle([W / 2 - hw, 0, W / 2 + hw, 8], fill=rgb(cfg['colors']['trim']))
    path = os.path.join(bpy.app.tempdir or '/tmp', 'shorts_tex.png'); im.save(path)
    img = bpy.data.images.load(path); img.pack(); img.name = 'shorts_stripe'
    return img

def make_shoe_texture(cfg):
    """くつを 横から 見た 絵：u = つま先(0)→かかと(1)、v = 床(0)→上(1)。ロゴは 入れない"""
    from PIL import Image, ImageDraw
    def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    C = cfg['colors']; SO = cfg['shoes']
    W, Hh = 512, 256
    im = Image.new('RGB', (W, Hh), rgb(C['shoe'])); d = ImageDraw.Draw(im)
    def Y(z): return Hh - (z + 0.02) / 0.16 * Hh       # z(m) → 画像の y
    def X(t): return t * W
    # よこの ライン（つま先がわ 低く → かかとへ 上がる 帯）
    a = SO.get('stripe', [[0.22, 0.040], [0.80, 0.085]]); w = SO.get('stripe_w', 0.013)
    d.polygon([(X(a[0][0]), Y(a[0][1] + w)), (X(a[1][0]), Y(a[1][1] + w)), (X(a[1][0] + 0.06), Y(a[1][1] - w * 0.4)), (X(a[0][0] + 0.06), Y(a[0][1] - w))], fill=rgb(C['shoe_accent']))
    # かかとの 補強（ヒールカウンター）
    d.rectangle([X(0.86), Y(0.075), X(1.0), Y(SO.get('sole_color_top', 0.022))], fill=rgb(C.get('shoe_heel', C['shoe_accent'])))
    # くつ底（白）と 底の ふち（こい グレー）
    d.rectangle([0, Y(SO.get('sole_color_top', 0.022)), W, Hh], fill=rgb(C['sole']))
    d.rectangle([0, Y(-0.004), W, Hh], fill=rgb(C.get('outsole', '#3a3f4a')))
    path = os.path.join(bpy.app.tempdir or '/tmp', 'shoe_tex.png'); im.save(path)
    img = bpy.data.images.load(path); img.pack(); img.name = 'shoe_side'
    return img

def make_hair(cfg, hair_pts, H, eyeCL, eyeCR, coll, mat, curl_lim):
    HC = dict(cfg['hair'])
    hs = cfg['body'].get('head_scale', 1.0)   # 頭を 大きくしたら 巻き毛の つぶも 同じ 比率で 大きく
    for k in ('spacing', 'curl_radius', 'base_offset', 'top_volume', 'resolution'):
        if k in HC: HC[k] = HC[k] * hs
    ys = [p.y for p in hair_pts]; zs = [p.z for p in hair_pts]
    center = Vector((0.0, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2 - 0.02))
    top = max(zs)
    eyeZ = (eyeCL.z + eyeCR.z) / 2
    y0, y1 = min(ys), max(ys)
    pts = list(hair_pts); random.shuffle(pts)
    chosen = []
    spacing = HC.get('spacing', 0.017)
    for p in pts:
        if p.z < curl_lim(p): continue
        if any((p - q).length < spacing for q in chosen): continue
        chosen.append(p)
    mb = bpy.data.metaballs.new('HairBalls'); mb.resolution = HC.get('resolution', 0.0055); mb.render_resolution = mb.resolution; mb.threshold = 0.6
    obm = bpy.data.objects.new('HairBalls', mb); coll.objects.link(obm)
    for p in chosen:
        nrm = (p - center).normalized()
        topness = smoothstep(top - 0.07, top - 0.005, p.z)
        lift = HC.get('base_offset', 0.006) + HC.get('top_volume', 0.022) * topness
        r = HC.get('curl_radius', 0.016) * (0.85 + 0.3 * random.random()) * (1 + HC.get('top_curl_grow', 0.3) * topness)
        e = mb.elements.new(); e.co = p + nrm * lift; e.radius = r * 1.9; e.stiffness = 2.0
        for _ in range(HC.get('subcurls', 2)):
            j = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))) * r * 0.9
            e2 = mb.elements.new(); e2.co = p + nrm * (lift + r * 0.55) + j; e2.radius = r * 1.25; e2.stiffness = 2.0
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obm.evaluated_get(dg))
    bpy.data.objects.remove(obm)
    ob = bpy.data.objects.new('No7_Hair', me); coll.objects.link(ob)
    me.materials.append(mat)
    for poly in me.polygons: poly.use_smooth = True
    bpy.context.view_layer.objects.active = ob
    for o2 in bpy.data.objects: o2.select_set(o2 == ob)
    dec = ob.modifiers.new('dec', 'DECIMATE'); dec.ratio = HC.get('decimate', 0.35)
    bpy.ops.object.modifier_apply(modifier='dec')
    g = ob.vertex_groups.new(name='mixamorig:Head'); g.add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    print('[build] hair curls', len(chosen), 'verts', len(me.vertices))
    return ob


if __name__ == '__main__':
    a = parse_args()
    cfg = json.load(open(a.config))
    build(cfg, a.out, a.blend)
