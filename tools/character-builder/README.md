# キャラクター 3D モデル ビルダー

キャラクターの設定ファイル（JSON）1つから、ゲームで使うリグ付き GLB を自動で作るスクリプトです。
Blender の画面操作はいりません。

```
tools/character-builder/
  build_character.py      … 本体（Blender の Python で実行）
  characters/no7.json     … No.7 の設定（体型・色・背番号・髪・ユニフォームの形）
  mh_assets/              … 人体のもと（MakeHuman / MPFB2 のベースメッシュ・体型ターゲット・Mixamo 互換の骨格とウェイト。CC0）
  fonts/Anton-Regular.ttf … 背番号の字体（SIL Open Font License 1.1。OFL.txt 同梱）
```

## 作り方

どちらか一方で実行します。出力先は `models/no7-v2.glb`（ゲームが読む場所）です。

**A. Blender 5.x 本体（Windows など）**

```
blender -b -P tools/character-builder/build_character.py -- --config tools/character-builder/characters/no7.json --out models/no7-v2.glb
```

Blender 付属の Python に Pillow が入っていないときは、最初に1回だけ入れます。

```
blender -b --python-expr "import subprocess,sys; subprocess.check_call([sys.executable,'-m','pip','install','pillow'])"
```

**B. Python 3.13 ＋ bpy モジュール（Linux・Windows・macOS）**

```
pip install bpy pillow
python tools/character-builder/build_character.py --config tools/character-builder/characters/no7.json --out models/no7-v2.glb
```

`--blend out.blend` を付けると、確認用の .blend も保存します。

## 中で やっていること

1. MakeHuman のベースメッシュに体型ターゲット（筋肉・身長・比率・肩や腕の筋肉など）をかけて体型を作る
2. 頭を少し大きくし（`head_scale`）、腰の高さをゲームの基準（`hips_height`）にそろえる
3. Mixamo 互換の骨格（Hips, Spine〜Spine2, Neck, Head, 腕・脚・指）を関節の位置から作り、ウェイトを付ける
4. 体の面をコピーして外へふくらませ、ジャージ・ショーツ・くつを作る。服の下に隠れる体の面は消す
5. ふち（首・そでぐり・すそ・ウエスト・はき口）に黄色の帯を付ける。背番号・ショーツの横ライン・くつの柄はテクスチャ
6. 頭の上に小さな玉をならべて1つのメッシュにし、カーリーヘアを作る
7. 腕を下げた A ポーズと、軽くまるめた指を基準の姿勢にして、GLB に書き出す

骨の名前は旧モデルと同じ（`mixamorig:Hips` など）なので、`js/character.js` の動き（パワーポジション、左右ドリブル、フロントチェンジなど）は作り直さずにそのまま使えます。

## 新しいキャラクターを作るとき

`characters/no7.json` をコピーして、次を変えます。

| 項目 | 変えるもの |
|---|---|
| `number.text` | 背番号 |
| `colors` | 肌・髪・ジャージ・ショーツ・ふち・背番号・くつの色 |
| `body.macro` | 筋肉（muscle）・体重（weight）・身長（height）・比率（proportions）・`gender`（male / female） |
| `body.targets`, `face_targets` | 部分ごとの体型・顔の調整（`mh_assets/targets/` のファイル名） |
| `hair` | カーリーヘアの量・高さ・生えぎわ |
| `jersey`, `shorts`, `shoes` | ユニフォームの形（そでぐりの広さ、ショーツの長さ・ゆとり、くつの高さ） |

ゲームで別の GLB を使うには、`js/character.js` の `loadHuman()` に読み込み先を足します（いまは `models/no7-v2.glb` 固定）。

## ライセンス

- `mh_assets/`：MakeHuman / MPFB2 のアセット。CC0 1.0（`mh_assets/LICENSE.ASSETS.md`）。プログラム部分（GPL）は使っていません
- `fonts/Anton-Regular.ttf`：SIL Open Font License 1.1（`fonts/OFL.txt`）。背番号の絵を作るときだけ使い、GLB には絵（画像）として入ります
- `build_character.py`：このリポジトリ用に書いたもの
