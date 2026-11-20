# バッシュコレクション 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ボールと同じようにコインで買えるバッシュ14足（ひみつ1足ふくむ）を足し、ショップ・図鑑では細かい絵で、プレイ中はキャラのくつの色（左右べつ）で見せる。

**Architecture:** データと買う処理は `js/data.js`（Node で単体テスト）。ショップの絵は新ファイル `js/shoes.js`（見本 `docs/superpowers/specs/bash-collection/shoes-art.mjs` を移植）。プレイ中の色は 3D モデル（`js/character.js`）と後ろ姿の絵（`js/scene.js` のスプライト）の両方を、シェーダー／頂点色で塗りかえる。

**Tech Stack:** 素の ES モジュール＋three.js（`vendor/`）。テストは Node 22 の `node:test`（依存なし）。画面の確認は headless Chrome（`/usr/bin/google-chrome`）＋ `puppeteer-core`（リポジトリの外 `/home/claude/e2e` に入れる）。

**Spec:** `docs/superpowers/specs/2026-11-20-bash-collection-design.md`（rev2）

## Global Constraints
- 画面の文字はひらがな中心（低学年向け）。実在ブランドのロゴ・マーク・形を入れない。サイドのマークはドリバトのボール
- ラインナップ・色・ねだんは `docs/superpowers/specs/bash-collection/lineup.mjs` のとおり（14足、`gold` は `secret: true`）
- `std` は「キャラのもとのくつのまま（色を上書きしない）」。ショップの絵だけ紺×黄
- プレイ中に使う色は各足の `up`・`sole`・`line` の3色だけ
- バッシュは見た目だけ。敵のくつは変えない
- 前からあるセーブで、コイン・ボール・オーラが消えない
- `models/local/` とUnityアセット由来のGLBはコミットしない

## Review Focus
1. 古いセーブ（`shoes` がない）で、ショップ・図鑑・プレイが落ちない → Task 1 `ensureShoes` のテスト
2. `p.shoe` がもう無いidを指している → `std` 扱いで落ちない → Task 1 `shoePaint` のテスト
3. コインが足りないときは何も変わらない → Task 1 `buyItem` のテスト
4. もう持っているものを押したら、お金を取らずに「つかう」だけ → Task 1 のテスト
5. ひみつの `gold`（ねだん0）を、ボタンのidを書きかえて買えない → Task 1 のテスト

---

### Task 1: バッシュのデータと買う処理（`js/data.js`）

**Files:**
- Modify: `js/data.js`（`BALLS` の下に `SHOES` 一式、`newPlayer()`、`player()`、`TITLES`）
- Create: `tests/shoes-data.test.mjs`

**Interfaces:**
- Produces:
  - `SHOES: Shoe[]`（`lineup.mjs` の中身をそのまま。`std` に `native: true` を足す）、`SHOP_SHOES = SHOES.filter(s => !s.secret)`
  - `shoeComplete(p): boolean` — `ballComplete` と同じ。全 `SHOP_SHOES` を持っていて `gold` が無ければ `gold` を足して true
  - `ensureShoes(p): void` — `p.shoes ||= ['std']; p.shoe ||= 'std'`。`player()` の中で毎回呼ぶ
  - `shoePaint(shoe: Shoe|undefined, side: 'L'|'R'): {up, sole, line} | null` — `shoe` が無い・`native` なら null。`{...shoe, ...shoe[side]}` から3色
  - `buyItem(p, kind: 'ball'|'suit'|'shoe', id): { ok: boolean, reason?: 'coins'|'secret'|'none', bought?: boolean, completed?: 'ball'|'shoe' }` — 持っていなければ買って選ぶ、持っていれば選ぶだけ。`secret` で未所持は `reason: 'secret'`。完成したら `checkTitles(p)` を呼ぶ。`save()` は呼ばない（呼ぶのは main.js）
  - `TITLES` に `{ id: 'shoe5', i: '👟', n: 'スニーカーずき', d: 'バッシュを 5そく あつめる' }`、`{ id: 'shoeall', i: '👑', n: 'バッシュマスター', d: 'バッシュを ぜんぶ あつめる' }`

- [ ] **Step 1: テストを書く**（`tests/shoes-data.test.mjs`、`import { ... } from '../js/data.js'`）
  - `SHOES.length === 14`、`SHOP_SHOES.length === 13`、id の重複なし、`gold` は secret
  - `ensureShoes({})` で `shoes` が `['std']`、`shoe` が `'std'`
  - `shoePaint(SHOES std, 'L') === null`、`shoePaint(undefined, 'L') === null`
  - `shoePaint(lrRB,'L').up === '#d8242c'`、`shoePaint(lrRB,'R').up === '#3a6fd8'`、`shoePaint(fire,'L')` が `{up:'#17171c', sole:'#e8222b', line:'#17171c'}`
  - coins 50 で `buyItem(p,'shoe','lime')` → `{ok:false, reason:'coins'}`、`p.coins === 50`、`p.shoes` 変わらず
  - coins 500 で `lime` を買う → `ok`、`p.coins === 400`、`p.shoe === 'lime'`。もう一度 → `p.coins === 400` のまま
  - `buyItem(p,'shoe','gold')`（未所持）→ `{ok:false, reason:'secret'}`
  - 13足ぜんぶ買う → 最後の結果が `completed: 'shoe'`、`p.shoes` に `gold`、`p.titles` に `shoeall`
  - `buyItem(p,'ball','brown')` がこれまでと同じに動く（コインが減り `p.ball === 'brown'`）
- [ ] **Step 2: 落ちるのを確かめる** — `node --test tests/` → FAIL（`SHOES` が無い）
- [ ] **Step 3: 実装する**（上の Interfaces どおり。`newPlayer()` に `shoes: ['std'], shoe: 'std'`）
- [ ] **Step 4: 通るのを確かめる** — `node --test tests/` → 全部 PASS
- [ ] **Step 5: コミット** — `git commit -m "feat(shoes): バッシュのデータと買う処理"`

### Task 2: ショップ用の絵（`js/shoes.js`）

**Files:**
- Create: `js/shoes.js`（`docs/superpowers/specs/bash-collection/shoes-art.mjs` を移植）
- Create: `tests/shoes-art.test.mjs`

**Interfaces:**
- Consumes: `SHOES`（Task 1）
- Produces: `shoeSVG(d: Shoe, size = 400): string`、`shoeIcon(d: Shoe): string`（`'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)`、id ごとに Map でキャッシュ）

- [ ] **Step 1: テストを書く**
  - 全 `SHOES` で `shoeSVG` が `<svg` で始まり、`undefined`・`NaN` を含まない
  - `lrRB` の SVG に `#d8242c` と `#3a6fd8` の両方が入る。`lime` の SVG に `transform="translate(72` が入らない（1足だけ）
  - 同じ id の `shoeIcon` は同じ文字列（キャッシュ）
- [ ] **Step 2: 落ちるのを確かめる** — `node --test tests/` → FAIL
- [ ] **Step 3: 移植する**（関数の中身は見本のまま。export 名だけ上のとおり）
- [ ] **Step 4: 通るのを確かめ、絵も見る** — `node --test tests/` → PASS。全 SHOES を1枚の SVG にして `rsvg-convert` で PNG にし、見本 `バッシュ見本_一覧_20261120.png` と同じに見えることを目で確かめる
- [ ] **Step 5: コミット** — `git commit -m "feat(shoes): ショップ用のバッシュの絵"`

### Task 3: ショップ・図鑑・買う画面（`js/main.js`、`index.html` の CSS）

**Files:**
- Modify: `js/main.js`（import、図鑑 278行付近、`shop()` 287〜293行、`buy` 417〜420行）
- Modify: CSS（`.sw.ball` が書いてある所。`index.html` か css ファイル）
- Create（リポジトリ外）: `/home/claude/e2e/shop.mjs`

**Interfaces:**
- Consumes: `SHOES, SHOP_SHOES, buyItem`（Task 1）、`shoeIcon`（Task 2）

- [ ] **Step 1: 確認スクリプトを書く**（`npm i puppeteer-core` を `/home/claude/e2e` に。`python3 -m http.server 8123` でリポジトリを配信）
  - localStorage `dribble-rescue-v2` に coins 5000・`shoes` なし（古いセーブ）のプレイヤーを入れてショップを開く
  - 「👟 バッシュ」の棚に 13個のボタン、`std` が「つかっている」
  - `lrRB` を押す → コインが 4580、「つかっている」が `lrRB` に移る
  - 図鑑を開き、バッシュの段に14枠（持っていないものは「？？？」）
  - 各画面のスクリーンショットを保存
- [ ] **Step 2: 落ちるのを確かめる** — `node /home/claude/e2e/shop.mjs` → 棚が見つからず FAIL
- [ ] **Step 3: 実装する**
  - 棚：見出し `👟 バッシュ <small>持っている数/13</small>`、ヒント「ぜんぶ あつめると… ひみつの バッシュが もらえるよ！」。`item()` に kind `'shoe'`（アイコンは `<img class="sw shoe" src="${shoeIcon(it)}">`、横長）
  - `buy` は `buyItem()` を使う形に直す（ボール・オーラ・バッシュ共通）。`reason:'coins'` は今のメッセージ。`completed:'shoe'` は「バッシュ コンプリート！ ひみつの『ゴールド』を ゲット！」＋しょうごう「バッシュマスター」
  - 図鑑：ボールの段の下に同じ形でバッシュの段
- [ ] **Step 4: 通るのを確かめる** — `node /home/claude/e2e/shop.mjs` → PASS。スクリーンショットで、アイコンがつぶれず、ボールの棚とそろって見えることを目で確かめる
- [ ] **Step 5: コミット** — `git commit -m "feat(shoes): ショップと図鑑にバッシュ"`

### Task 4: 3D モデルのくつの色（`js/character.js`、`js/scene.js`、`js/main.js`）

**Files:**
- Modify: `js/main.js` 140行（`look` に `shoe: SHOES.find(x => x.id === p.shoe)`）
- Modify: `js/scene.js` 45〜47行（プレイヤーの `makeHuman` に `shoeL: shoePaint(o.shoe,'L'), shoeR: shoePaint(o.shoe,'R')`。敵は渡さない）
- Modify: `js/character.js` `makeHuman()`（`regionOf` と `nativeLook` の分岐）
- Create（リポジトリ外）: `/home/claude/e2e/feet3d.mjs`

**Interfaces:**
- Consumes: `shoePaint`（Task 1）
- Produces: `makeHuman(template, suit, opt)` の `opt.shoeL` / `opt.shoeR`（`{up, sole, line} | null`、null は今のまま）

- [ ] **Step 1: 確認スクリプトを書く** — `shoe` を `lrRB` にしたプレイヤーで、`?character3d=1`（no7-chibi）と `?model=meshy-v1` と `?model=legacy&character3d=1` のプレイ画面を開き、足元を拡大したスクリーンショットを撮る。同じことを `std` でも撮る
- [ ] **Step 2: いまの見た目を撮る** — 実装前に実行し、くつが元の色のままの画像を残す（くらべる用）
- [ ] **Step 3: 実装する**
  - 旧モデル：`regionOf` で骨名の `Left`/`Right` を見て `opt.shoeL`/`opt.shoeR` を選ぶ。足の一番下（ソール）は `sole`、今 `TRIM` の帯は `line`、ほかは `up`。null の足は今の `SHOE`/`TRIM`
  - GLB（`nativeLook`）：頂点ごとにいちばん重い骨が `LeftFoot`/`LeftToeBase`（と `LeftLeg` の足首より下）なら 1、Right なら 2 の属性 `shoeSide` と、足うらからの高さ `shoeH` を足す。`MeshToonMaterial.onBeforeCompile` で、`shoeSide>0` の所の `diffuseColor.rgb` を高さで sole／line／up にし、元の明るさで少し陰をつける。null のときはシェーダーを足さない
  - しきい値は Step 4 の画像を見て決め、コメントに書く
- [ ] **Step 4: 確かめる** — スクリプトを実行し、3つのモデルとも左足が赤・右足が青、`std` は Step 2 と同じ見た目、ユニフォームやすね・ひざの色が変わっていないことを画像で確かめる
- [ ] **Step 5: コミット** — `git commit -m "feat(shoes): 3Dキャラのくつの色"`

### Task 5: ふつうのプレイの絵（スプライト）のくつの色（`js/scene.js`）

**Files:**
- Modify: `js/scene.js` 51〜53行（スプライトの `SpriteMaterial` を作る所）
- Create（リポジトリ外）: `/home/claude/e2e/sprite.mjs`

**Interfaces:**
- Consumes: `shoePaint`（Task 1）、`PSROWS`（scene.js 内）

- [ ] **Step 1: 確認スクリプトを書く** — 男の子・女の子（`p.girl`）それぞれ、`shoe` を `lrLP`・`std` にしてふつうのプレイを開き、プレイヤーの足元を撮る。右手ドリブル・左手ドリブル・レッグスルー（`legs`）のコマが出るところで撮る
- [ ] **Step 2: いまの見た目を撮る**
- [ ] **Step 3: 実装する** — `onBeforeCompile` で `uniform vec3 uShoeL, uShoeR; uniform float uShoeOn, uRows;` を足す。`vec2 c = fract(vMapUv * vec2(3.0, uRows));` が `c.y < 高さしきい値`（男の子 約0.135、女の子は測る）で、元の色が暗い（しきい値は測る）所を、`c.x < 0.5 ? uShoeL : uShoeR` にし、元の明るさで陰をつける。`std` なら `uShoeOn = 0`
- [ ] **Step 4: 確かめる** — 男女とも、左足ライム・右足ピンク。ボール・パンツ・ソックス・はだに色がうつっていない。`std` は Step 2 と同じ
- [ ] **Step 5: コミット** — `git commit -m "feat(shoes): ふつうのプレイの絵のくつの色"`

### Task 6: しあげの確認

- [ ] **Step 1:** `node --test tests/` と e2e 3本をまとめて実行 → 全部 PASS
- [ ] **Step 2:** お手本の小窓（`colorGuide` のとき）でもくつの色が出ているか撮って確かめる
- [ ] **Step 3:** 設計メモの「作る人にまかせること」で決めた値（しきい値など）を設計メモに書き足し、プロジェクトの設計メモ（rev3）も更新
- [ ] **Step 4:** 前橋さんに iPad（Safari）での確認をお願いする（push・PR は前橋さんの了承後）
