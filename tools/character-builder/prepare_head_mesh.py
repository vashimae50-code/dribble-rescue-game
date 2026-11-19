"""Meshy などで作った 全身/頭の メッシュから、ゲーム用の「頭パーツ」を 作る（Blender / bpy で実行）

  python3 prepare_head_mesh.py --src model.fbx --out meshes/no7_meshy_head.glb --neck-z 0.46 --eyes -0.125,0.618 -0.0125,0.618 --faces 30000

- 首の 高さ(neck-z)より 下を 切りおとす
- 面の 数を へらす（--faces）
- 髪（細い 束）と 肌（太い かたまり）を「厚み」で 見わけて 2つの 材質に 分ける
- 両目の 中心（正面から 見た x,z）を 書いた JSON を 横に 保存する
"""
import bpy, bmesh, json, math, os, sys, argparse
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('--src', required=True); ap.add_argument('--out', required=True)
ap.add_argument('--neck-z', type=float, required=True, help='首の いちばん 細い 高さ')
ap.add_argument('--cut-z', type=float, default=None, help='ここより 下は すべて 切る（首と たれた 髪を 残すため 首より 少し 下）')
ap.add_argument('--neck-r', type=float, default=0.09, help='首の 太さ（半径）。首より 下では この 円の 中と 髪だけ 残す')
ap.add_argument('--eyes', nargs=2, required=True, help='x,z x,z（左右どちらの 順でも よい）')
ap.add_argument('--faces', type=int, default=30000)
ap.add_argument('--hair-thick', type=float, default=0.055, help='これより 薄い ところを 髪と みなす（元データの 単位）')
a = ap.parse_args(argv)

bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(a.src)[1].lower()
if ext == '.fbx': bpy.ops.import_scene.fbx(filepath=a.src)
elif ext in ('.glb', '.gltf'): bpy.ops.import_scene.gltf(filepath=a.src)
elif ext == '.obj': bpy.ops.wm.obj_import(filepath=a.src)
obs = [o for o in bpy.data.objects if o.type == 'MESH']
for o in bpy.data.objects: o.select_set(o in obs)
bpy.context.view_layer.objects.active = obs[0]
if len(obs) > 1: bpy.ops.object.join()
o = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 首より 下を 切る
bm = bmesh.new(); bm.from_mesh(o.data)
bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, a.cut_z if a.cut_z is not None else a.neck_z), plane_no=(0, 0, 1), clear_inner=True)
bm.to_mesh(o.data); bm.free(); o.data.update()
# 面を へらす
n0 = len(o.data.polygons)
if n0 > a.faces:
    md = o.modifiers.new('d', 'DECIMATE'); md.ratio = a.faces / n0
    bpy.ops.object.modifier_apply(modifier='d')
# 厚みで 髪と 肌を 分ける（面の 内がわへ 光線を 出して、反対がわの 面までの きょり）
me = o.data
bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
bvh = BVHTree.FromBMesh(bm)
thick = []
for f in bm.faces:
    c = f.calc_center_median(); n = f.normal
    ds = []
    for t in ((0, 0), (0.35, 0), (-0.35, 0), (0, 0.35), (0, -0.35)):
        dvec = (-n + Vector((t[0], t[1], 0)) * 0.6).normalized()
        h = bvh.ray_cast(c + dvec * 1e-4, dvec, 1.0)
        if h[0] is not None: ds.append(h[3])
    ds.sort(); thick.append(ds[len(ds) // 2] if ds else 0.0)
# となりの 面と ならして ノイズを へらす
nb = [[e.index for e in f.edges] for f in bm.faces]
edge_faces = {}
for f in bm.faces:
    for e in f.edges: edge_faces.setdefault(e.index, []).append(f.index)
for _ in range(6):
    new = []
    for f in bm.faces:
        vals = [thick[f.index]] + [thick[g] for e in f.edges for g in edge_faces[e.index] if g != f.index]
        vals.sort(); new.append(vals[len(vals) // 2])
    thick = new
skin = bpy.data.materials.new('skin'); hair = bpy.data.materials.new('hair')
me.materials.clear(); me.materials.append(skin); me.materials.append(hair)
nh = 0
for f, t in zip(me.polygons, thick):
    f.material_index = 1 if t < a.hair_thick else 0; nh += f.material_index
    f.use_smooth = True
bm.free()
# 首より 下：首の 円柱の 中と 髪だけ 残す（肩・服を けす）
if a.cut_z is not None and a.cut_z < a.neck_z:
    bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
    ring = [v.co for v in bm.verts if abs(v.co.z - a.neck_z) < 0.01]
    ncx = sum(c.x for c in ring) / len(ring); ncy = sum(c.y for c in ring) / len(ring)
    dead = []
    for f in bm.faces:
        c = f.calc_center_median()
        if c.z >= a.neck_z: continue
        if math.hypot(c.x - ncx, c.y - ncy) <= a.neck_r: continue
        dead.append(f)
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    # 小さな かけらを けす
    bm.faces.ensure_lookup_table(); seen = set(); comps = []
    for f in bm.faces:
        if f.index in seen: continue
        st = [f]; comp = []; seen.add(f.index)
        while st:
            g = st.pop(); comp.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen: seen.add(h.index); st.append(h)
        comps.append(comp)
    big = max(len(c) for c in comps)
    bmesh.ops.delete(bm, geom=[f for c in comps if len(c) < 0.002 * big for f in c], context='FACES')
    bm.to_mesh(me); bm.free(); me.update()
    print('[head] neck center', round(ncx, 3), round(ncy, 3), 'removed', len(dead))
eyes = [[float(v) for v in e.split(',')] for e in a.eyes]
bpy.ops.export_scene.gltf(filepath=a.out, export_format='GLB', use_selection=False, export_materials='EXPORT')
info = {'source': os.path.basename(a.src), 'neck_z': a.neck_z, 'cut_z': a.cut_z, 'eyes_xz': sorted(eyes), 'faces': len(me.polygons), 'hair_faces': nh}
json.dump(info, open(os.path.splitext(a.out)[0] + '.json', 'w'), ensure_ascii=False, indent=1)
print('[head] wrote', a.out, info)
