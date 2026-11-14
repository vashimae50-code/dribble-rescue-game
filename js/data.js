// ドリバト！（めざせ！ドリブルキング） データ・保存・成長のしくみ

// hand: R / L / cur(いまの手) / alt(持ちかえ) / hold(ボールを持つ) / side(動く方向の手)
export const SKILLS = {
  // ランク1：かまえる・止まる
  stance: { en: 'Power position', r: 1, n: 'パワーポジション', i: '🧍', c: '#9fb4ff', say: 'パワーポジション', hand: 'hold', low: 1, sp: 0.5, len: 4,
    tips: ['足を かたはばより 少し広く ひらこう', 'ひざを まげて、おしりを 少し下げる', 'ボールは おなかの よこ。顔は 前！'] },
  right: { en: 'Right hand', r: 1, n: 'みぎて', i: '👉', c: '#ff4d6d', say: 'みぎ', hand: 'R', len: 8,
    tips: ['ゆびを ひらいて、ゆびの はらで おす', 'ボールは 足の よこに つく', 'こしの 高さまで。顔は 前！'] },
  left: { en: 'Left hand', r: 1, n: 'ひだりて', i: '👈', c: '#3d8bff', say: 'ひだり', hand: 'L', len: 8,
    tips: ['ゆびを ひらいて、ゆびの はらで おす', 'にがてな手ほど、ゆっくり 強く', 'ボールを 見ないで 3回 つけるかな？'] },
  jstop: { en: 'Jump stop', r: 1, n: 'ジャンプストップ', i: '🛑', c: '#ff9f1a', say: 'ストップ', hand: 'hold', sp: 0.12, len: 2, jump: 1,
    tips: ['小さく とんで、両足 どうじに「トン！」', 'ひざを まげて ピタッと 止まる', '止まったら ボールを むねの前で まもる'] },
  step: { en: 'Side step', r: 1, n: 'サイドステップ', i: '↔️', c: '#7dffb0', say: 'ステップ', hand: 'hold', lane: 1, len: 2,
    tips: ['足を クロスさせないで 横へ 1〜2歩', 'ひくい しせいの まま うごく', '頭の 高さを かえない'] },
  wrapw: { en: 'Around the waist', r: 1, n: 'ボールまわし（こし）', i: '🔁', c: '#b0e0ff', say: 'ボールまわし', hand: 'hold', handle: 'wrap', sp: 0.5, len: 8,
    tips: ['こしの まわりを ぐるっと 1しゅう', 'ゆびさきで 手から 手へ わたす', 'ボールを 見ないで、だんだん 速く'] },
  wraph: { en: 'Around the head', r: 1, n: 'ボールまわし（あたま）', i: '🙆', c: '#c8e8ff', say: 'あたまの まわり', hand: 'hold', handle: 'head', sp: 0.5, len: 8,
    tips: ['頭の まわりを ぐるっと 1しゅう', '頭は うごかさないで、手だけ まわす', 'だんだん 速く、ぎゃく回りも'] },
  wrapk: { en: 'Around the knees', r: 1, n: 'ボールまわし（ひざ）', i: '🦿', c: '#a8d8ff', say: 'ひざの まわり', hand: 'hold', handle: 'knees', sp: 0.5, len: 8,
    tips: ['足を そろえて、ひざの まわりを 1しゅう', 'ひざを まげて ひくく', 'ボールを 見ないで 手から 手へ'] },
  wrapl: { en: 'Around one leg', r: 1, n: 'ボールまわし（かたあし）', i: '🦵', c: '#98c8ff', say: 'かたあしの まわり', hand: 'hold', handle: 'leg', sp: 0.5, len: 8,
    tips: ['足を ひらいて、かた足の まわりを まわす', '右足 2しゅう → 左足 2しゅう', 'こしを おとして、せなかは まっすぐ'] },
  wrap8: { en: 'Figure eight wrap', r: 1, n: 'ボールまわし（8の字）', i: '♾️', c: '#88b8ff', say: 'はちのじ まわし', hand: 'hold', handle: 'eight', sp: 0.5, len: 8,
    tips: ['足を ひらいて、足の あいだを 8の字に 通す', 'つかないで、手から 手へ わたす', 'ひくい しせいの まま 速く'] },
  swingb: { en: 'Swing behind', r: 1, n: 'うしろで ふる', i: '🔙', c: '#d0b8ff', say: 'うしろで ふる', hand: 'hold', handle: 'swing', sp: 0.5, len: 8,
    tips: ['せなかの うしろで、右手 → 左手 へ', 'うでを のばして 大きく ふる', '体は 前を むいたまま'] },
  // ランク2：その場でつく
  low: { en: 'Stay low', r: 2, n: 'ひくく', i: '⬇️', c: '#ff9f1a', say: 'ひくく', hand: 'cur', low: 1, dbl: 1, len: 8,
    tips: ['ひざの 高さで こまかく つく', 'せなかを 丸めないで、ひざを まげる', 'あいている手で ボールを まもる'] },
  pound: { en: 'Power dribble', r: 2, n: 'つよく', i: '💥', c: '#ff5a36', say: 'つよく', hand: 'cur', amp: 1.35, len: 8,
    tips: ['ゆかに たたきつける ように 強く', 'ひじまで つかって おす', '音が 大きく なったら OK'] },
  freeze: { en: 'Freeze', r: 2, n: 'ピタッ！', i: '✋', c: '#ffffff', say: 'ピタッ', hand: 'hold', sp: 0.12, len: 4,
    tips: ['ボールを 両手で つかんで 止まる', 'かまえの しせいで 止まる', '止まっても 顔は 前'] },
  pivot: { en: 'Pivot', r: 2, n: 'ピボット', i: '🔁', c: '#c9a6ff', say: 'ピボット', hand: 'hold', sp: 0.3, len: 4, turn: 1,
    tips: ['かた足を ゆかに つけたまま 回る', 'つけた足の つまさきで クルッ', 'ボールは むねの前で まもる'] },
  fast: { en: 'Speed up', r: 2, n: 'はやく！', i: '⚡', c: '#3df5ff', say: 'はやく', hand: 'cur', dbl: 1, sp: 1.6, len: 4,
    tips: ['ひくく こまかく、できるだけ 速く', '手首を つかって ポンポンポン', 'ボールが あばれたら 少し ひくく'] },
  frontv: { en: 'Front V', r: 2, n: 'かたて フロントチェンジ', i: '✌️', c: '#ffd86b', say: 'フロントチェンジ', hand: 'cur', vmove: 'front', len: 8,
    tips: ['かた手だけで、体の 前を 右 ⇄ 左に うごかす', '手を ボールの よこに まわして おす', 'ひざより ひくく、V の字に つく'] },
  sidev: { en: 'Push pull', r: 2, n: 'ぜんご（プッシュプル）', i: '↕️', c: '#8fe0ff', say: 'プッシュプル', hand: 'cur', vmove: 'side', len: 8,
    tips: ['かた手だけで、体の よこを 前 ⇄ うしろに うごかす', '手を ボールの 前 → うしろに まわす', '足の よこで、ひくく つく'] },
  two1: { en: 'Two balls together', r: 6, n: '2ボール どうじ', i: '🏀🏀', c: '#ffb86b', say: 'ツーボール どうじ', hand: 'two', two: 'same', len: 8,
    tips: ['2つの ボールを 同時に つく', '同じ 高さ・同じ 強さで', 'にがてな手を よく 見て そろえる'] },
  // ランク3：動きながらつく
  slide: { en: 'Slide', r: 3, n: 'ドリブルスライド', i: '⏩', c: '#4dff88', say: 'スライド', hand: 'side', lane: 1, len: 4,
    tips: ['すすむ ほうの手で つきながら 横へ', '足は クロスさせない', 'ボールは 体の そとがわ'] },
  back: { en: 'Back up', r: 3, n: 'バック', i: '⏪', c: '#b0c4ff', say: 'バック', hand: 'cur', sp: -0.35, len: 4,
    tips: ['ボールを 体の うしろに かくして 下がる', '小さい ステップで 2歩', '顔は 前の まま'] },
  hesi: { en: 'Slow down', r: 3, n: 'ゆっくり…', i: '🐢', c: '#ffe9a8', say: 'ゆっくり', hand: 'cur', sp: 0.35, len: 2,
    tips: ['少し 体を おこして「止まるふり」', 'つぎの「はやく！」で 一気に ひくく', 'ゆっくり と 速く の 差を 大きく'] },
  cross: { en: 'Crossover', r: 3, n: 'フロントチェンジ', i: '🔀', c: '#ffe03d', say: 'フロントチェンジ', hand: 'alt', len: 8,
    tips: ['ひざより ひくく、体の 前を 通す', 'ボールを 反対の手に「わたす」', '顔は 前。ボールを 目で おわない'] },
  dcross: { en: 'Double cross', r: 3, n: 'ダブル フロントチェンジ', i: '⚡🔀', c: '#ffc21a', say: 'ダブルクロス', hand: 'alt', quick: 2, len: 4,
    tips: ['クロスを すばやく 2回', 'ボールを ひざより ひくく', '1回目で 体を ゆらして、2回目で もどる'] },
  pocket: { en: 'Pocket dribble', r: 3, n: 'ポケット', i: '👖', c: '#9be7c4', say: 'ポケット', hand: 'cur', pocket: 1, len: 8,
    tips: ['ついた ボールを こしの よこ（ポケット）まで ひきつける', '手を ボールの 上 → よこに まわして「ためる」', 'ためている あいだに 前を 見る'] },
  two2: { en: 'Two balls alternate', r: 6, n: '2ボール こうご', i: '🏀↕️', c: '#ffa04d', say: 'ツーボール こうご', hand: 'two', two: 'alt', len: 8,
    tips: ['右・左・右・左と たがいちがいに つく', 'リズムを くずさない', 'ひくく こまかく'] },
  c2cross: { en: 'Two dribbles, crossover', r: 3, n: '2ドリブル → フロントチェンジ', i: '2️⃣🔀', c: '#ffe03d', say: 'ツードリブル フロントチェンジ', hand: 'combo', combo: 'cross', reps: 1, len: 8,
    tips: ['トン・トン・チェンジ の リズム', '2回目を 強く ついて、すぐ 前を 通す', 'かえた あとの 手でも 同じ リズムで'] },
  c2cross2: { en: 'Two dribbles, double crossover', r: 3, n: '2ドリブル → フロントチェンジ×2', i: '2️⃣🔀🔀', c: '#ffc21a', say: 'ツードリブル ダブルチェンジ', hand: 'combo', combo: 'cross', reps: 2, len: 8,
    tips: ['トン・トン・チェンジ・チェンジ', '2回の チェンジは ひくく すばやく', 'もとの 手に もどったら すぐ つぎへ'] },
  semi: { en: 'Semi circle', r: 3, n: 'セミサークル', i: '🌙', c: '#a8f0d0', say: 'セミサークル', hand: 'cur', semi: 1, len: 8,
    tips: ['かた手で、体の 前 → よこ → うしろへ 半円を かく', '足の まわりを なぞるように つく', '行って、もどって、を ひくく'] },
  // ランク4：向きを変える
  xstep: { en: 'Cross', r: 4, n: 'フロントチェンジで よこへ', i: '↪️', c: '#ffd23f', say: 'クロスチェンジ', hand: 'alt1', lane: 1, len: 4,
    tips: ['そと足で ゆかを ける → クロス', 'クロスと 同時に 横へ 1歩', 'ボールは ひくく 速く'] },
  legs: { en: 'Between the legs', r: 4, n: 'レッグスルー', i: '🦵', c: '#4dff88', say: 'レッグスルー', hand: 'alt', legs: 1, len: 8,
    tips: ['足を 前後に ひらいて、あいだを 通す', 'ひくい しせいで、ボールは ひざの下', '通したら 反対の手で すぐ つく'] },
  behind: { en: 'Behind the back', r: 4, n: 'ビハインド ザ バック', i: '🔄', c: '#c77dff', say: 'ビハインド', hand: 'alt', behind: 1, len: 8,
    tips: ['おしりの うしろで ボールを おし出す', '手首で 反対がわへ「はらう」', 'さいしょは 止まって ゆっくり'] },
  inout: { en: 'In and out', r: 4, n: 'インサイドアウト', i: '〰️', c: '#ff7ac6', say: 'インアウト', hand: 'cur', inout: 1, len: 8,
    tips: ['クロスする「ふり」で 同じ手に もどす', 'かたも いっしょに 中へ ゆらす', 'ボールの 上に 手を のせて 中→外'] },
  fig8: { en: 'Figure eight', r: 4, n: '8の字 ドリブル', i: '♾️', c: '#5dffc8', say: 'はちのじ', hand: 'alt', fig8: 1, low: 1, len: 8,
    tips: ['足を ひろげて、ひくく かまえる', '足の あいだを 8の字に ぬうように', 'こまかく ひくく、ゆびさきで つく'] },
  c2legs: { en: 'Two dribbles, between the legs', r: 4, n: '2ドリブル → レッグスルー', i: '2️⃣🦵', c: '#4dff88', say: 'ツードリブル レッグスルー', hand: 'combo', combo: 'legs', reps: 1, len: 8,
    tips: ['トン・トン・レッグ の リズム', '2回目で 足を 前後に ひらく', '通したら 反対の手で すぐ つく'] },
  c2legs2: { en: 'Two dribbles, double legs', r: 4, n: '2ドリブル → レッグスルー×2', i: '2️⃣🦵🦵', c: '#2fe070', say: 'ツードリブル ダブルレッグ', hand: 'combo', combo: 'legs', reps: 2, len: 8,
    tips: ['トン・トン・レッグ・レッグ', '足を 入れかえずに 行って もどる', 'ひくい しせいを キープ'] },
  c2behind: { en: 'Two dribbles, behind the back', r: 4, n: '2ドリブル → ビハインド', i: '2️⃣🔄', c: '#c77dff', say: 'ツードリブル ビハインド', hand: 'combo', combo: 'behind', reps: 1, len: 8,
    tips: ['トン・トン・ビハインド の リズム', '2回目を 体の よこ うしろで つく', 'おしりの うしろを 通して 反対の手へ'] },
  c1legs: { en: 'One dribble, between the legs', r: 4, n: '1ドリブル → レッグスルー', i: '1️⃣🦵', c: '#6dffa0', say: 'ワンドリブル レッグスルー', hand: 'combo', combo: 'legs', reps: 1, cyc: 2, len: 8,
    tips: ['トン・とおす の 2びょうし', '前の足の うしろに ボールを おとす', 'かおを 上げて、ひくい しせいの まま'] },
  c1behind: { en: 'One dribble, behind the back', r: 4, n: '1ドリブル → ビハインド', i: '1️⃣🔄', c: '#d79dff', say: 'ワンドリブル ビハインド', hand: 'combo', combo: 'behind', reps: 1, cyc: 2, len: 8,
    tips: ['トン・うしろ の 2びょうし', 'おしりの うしろで ななめ前に おし出す', 'はんたいの 手を こしの よこで まって おく'] },
  c1cross: { en: 'One dribble, crossover', r: 3, n: '1ドリブル → フロントチェンジ', i: '1️⃣🔀', c: '#ffe03d', say: 'ワンドリブル フロントチェンジ', hand: 'combo', combo: 'cross', reps: 1, cyc: 2, len: 8,
    tips: ['トン・チェンジ の 2びょうし', 'ひざより ひくく、体の 前を 通す', 'かおを 上げて、リズムを くずさない'] },
  // ランク5：抜く
  jab: { en: 'Jab', r: 5, n: 'ジャブ', i: '👣', c: '#ffb13d', say: 'ジャブ', hand: 'hold', sp: 0.25, len: 2, jab: 1,
    tips: ['小さく 速く、ふみ出して すぐ もどす', 'かたと ボールも 少し ゆらす', 'じく足は ゆかから はなさない'] },
  drive: { en: 'Drive', r: 5, n: 'ドライブ！', i: '🚀', c: '#3df5ff', say: 'ドライブ', hand: 'side', lane: 1, dbl: 0, sp: 1.9, amp: 1.3, len: 4,
    tips: ['1歩目を 大きく、ひくく', 'かたを ディフェンスの よこに 入れる', 'ボールは 体の そとがわに 強く つく'] },
  spin: { en: 'Spin move', r: 5, n: 'スピンムーブ', i: '🌪️', c: '#ff8ad8', say: 'スピン', hand: 'side', lane: 1, spin: 1, sp: 1.3, len: 4,
    tips: ['じく足で クルッと 回って よこへ', 'ボールは 体の ちかくに ひきつける', '回ったら すぐ 顔を 前へ'] },
  c2roll: { en: 'Two dribbles, roll turn', r: 5, n: '2ドリブル → ロールターン', i: '2️⃣🌪️', c: '#ff8ad8', say: 'ツードリブル ロールターン', hand: 'combo', combo: 'roll', reps: 1, len: 8,
    tips: ['トン・トン・クルッ の リズム', 'ボールを 体に ひきつけて 回る', '回りおわったら 反対の手で つく'] },
  twohi: { en: 'Two balls high', r: 6, n: '2ボール たかめ', i: '🏀⬆️', c: '#ffd08a', say: 'ツーボール たかめ', hand: 'two', two: 'same', high: 1, len: 8,
    tips: ['かたの 高さまで 大きく つく', 'うでを しっかり のばして おす', '2つの 高さを そろえる'] },
  twolo: { en: 'Two balls low', r: 6, n: '2ボール ひくめ', i: '🏀⬇️', c: '#ff9a5a', say: 'ツーボール ひくめ', hand: 'two', two: 'same', low: 1, dbl: 1, len: 8,
    tips: ['ひざより 下で こまかく つく', 'ひざを まげて、せなかは まっすぐ', 'ゆびさきで タタタタ'] },
  twov: { en: 'Two balls, front V', r: 6, n: '2ボール かたてチェンジ', i: '🏀✌️', c: '#ffe08a', say: 'ツーボール かたてチェンジ', hand: 'two', two: 'v', len: 8,
    tips: ['右手・左手 それぞれで、ボールを 左右に V の字', '手を ボールの よこに まわす', '2つ 同時に、同じ はばで'] },
  twop: { en: 'Two balls, same way', r: 6, n: '2ボール りょうて おなじむき', i: '🏀➡️', c: '#ffcf6b', say: 'ツーボール おなじむき', hand: 'two', two: 'par', len: 8,
    tips: ['2つの ボールを いっしょに 右へ、つぎは いっしょに 左へ', '右手と 左手の はばは そのまま', 'からだは まっすぐ、目は まえ'] },
  rest: { en: '', r: 0, n: 'じゆうに ドリブル', i: '🏀', c: '#9fb4ff', say: '', hand: 'cur', len: 4, tips: [] },
};
// 「2ドリブル → ワザ」の ボールの位置：x は -1(左手)〜1(右手)、chg は 持ちかえの すすみ 0〜1
export function comboState(sk, hand0, cb) {
  const L = sk.cyc || 4; const c0 = L === 2 ? 0.5 : 1.5;
  const s0 = hand0 === 'L' ? -1 : 1; const cyc = Math.floor(Math.max(0, cb) / L); const t = Math.max(0, cb) - cyc * L; const start = sk.reps === 1 && cyc % 2 ? -s0 : s0;
  let x = start, chg = 0, n = 0;
  if (t >= c0 && t < c0 + 1) { chg = t - c0; x = start * Math.cos(Math.PI * chg); n = 1; }
  else if (t >= c0 + 1) { x = -start; if (sk.reps === 2) { if (t < c0 + 2) { chg = t - c0 - 1; x = -start * Math.cos(Math.PI * chg); n = 2; } else x = start; } }
  const pre = t >= c0 - 0.5 && t < c0 ? (t - c0 + 0.5) * 2 : 0;
  return { x, chg, n, start, t, pre };
}
export const SKILL_IDS = Object.keys(SKILLS).filter((k) => k !== 'rest');
export const RANKS = [null,
  { n: 'ルーキー', sub: 'かまえる・止まる', c: '#9fb4ff' },
  { n: 'ドリブラー', sub: 'その場で つく', c: '#4dff88' },
  { n: 'ムーバー', sub: 'うごきながら つく', c: '#3df5ff' },
  { n: 'チェンジャー', sub: 'むきを かえる', c: '#ffe03d' },
  { n: 'アタッカー', sub: 'ぬく！', c: '#ff4d6d' },
  { n: '2ボール', sub: 'ボールを 2つ つかう', c: '#ffb86b' },
];
export const TIERS = [{ n: 'みならい', at: 0, c: '#5b6aa8', i: '・' }, { n: 'ブロンズ', at: 5, c: '#d08a4c', i: '🥉' }, { n: 'シルバー', at: 20, c: '#cfd8e8', i: '🥈' }, { n: 'ゴールド', at: 50, c: '#ffd23f', i: '🥇' }, { n: 'マスター', at: 120, c: '#ff7ac6', i: '👑' }];
export const tierOf = (pts) => { let t = 0; TIERS.forEach((x, i) => { if (pts >= x.at) t = i; }); return t; };
export const rankSkills = (r) => SKILL_IDS.filter((k) => SKILLS[k].r === r);
export const poolFor = (rank) => SKILL_IDS.filter((k) => SKILLS[k].r <= rank);

// ---------- ワールドとステージ ----------
export const WORLDS = [
  { id: 'w1', name: 'あおぞら パーク', theme: 'village', pal: { a: '#3df5ff', b: '#ff3df0', bg: '#0a0e2c', floor: '#101a4a' }, base: 45, bpm: 100, boss: 'キャプテン・ウォール', need: 0 },
  { id: 'w2', name: 'ネオン ストリート', theme: 'night', pal: { a: '#4dff88', b: '#3df5ff', bg: '#04181a', floor: '#0a3030' }, base: 43, bpm: 104, boss: 'ナイトスティーラー', need: 8 },
  { id: 'w3', name: 'ゆうやけ ストリート', theme: 'sunset', pal: { a: '#ffb13d', b: '#c77dff', bg: '#1d0f3d', floor: '#2c1a55' }, base: 47, bpm: 108, boss: 'スカイブロッカー', need: 20, open: true },
  { id: 'w4', name: 'サンシャイン スタジアム', theme: 'snow', pal: { a: '#ffe03d', b: '#3d8bff', bg: '#0b1024', floor: '#182252' }, base: 41, bpm: 112, boss: 'スタジアム・タワー', need: 34 },
  { id: 'w5', name: 'ファイナル アリーナ', theme: 'castle', pal: { a: '#ff4d4d', b: '#ffb13d', bg: '#200808', floor: '#3a1010' }, base: 44, bpm: 118, boss: 'キング・ディフェンダー', need: 50, open: true },
];
// ミッションの型
export const MISSIONS = {
  dodge:   { n: 'かいひ ラン', i: '🚧', d: 'ゲートに 合わせて ワザを きりかえろ', w: {}, vt: 'ドリブル きほん れんしゅう' },
  steps:   { n: 'ステップ ラン', i: '↔️', d: '左右に うごいて バリアを よけろ', w: { step: 4, slide: 4, xstep: 3, jstop: 2 }, vt: 'サイドステップ＆ジャンプストップ' },
  weak:    { n: 'ひだりて とっくん', i: '👈', d: 'ひだりての ワザが たくさん 出るぞ', w: { left: 5 }, leftBias: 0.8, vt: 'ひだりて ドリブル とっくん' },
  guard:   { n: 'ディフェンスぬき', i: '⛹️', d: 'ディフェンスの よこを ぬけ！', w: { drive: 6, jab: 3, step: 3, slide: 3, xstep: 3, hesi: 2 }, guards: 1, vt: 'ディフェンスを ぬく ドライブ' },
  stealth: { n: 'ステルス', i: '🔦', d: 'ひくく・ピタッで センサーを かわせ', w: { low: 4, freeze: 4, stance: 3, back: 3, jstop: 2 }, vt: 'ロー ドリブル とっくん' },
  two:     { n: '2ボール チャレンジ', i: '🏀🏀', d: 'ボールを 2つ つかう ステージ', w: {}, pool: ['two1', 'two2', 'twohi', 'twolo', 'twov', 'twop'], vt: '2ボール ハンドリング' },
  handle:  { n: 'ハンドリング どうじょう', i: '🤹', d: 'うごかないで、ハンドリングの ワザだけ れんしゅう', w: {},
    pool: SKILL_IDS.filter((k) => !SKILLS[k].lane && SKILLS[k].hand !== 'two'), vt: 'ハンドリング とっくん' },
  lLegs:   { n: 'レッグスルー しゅうとく', i: '🦵', d: '4つの ステップで レッグスルーを おぼえよう', w: {}, fin: 1, learn: 'legs', vt: 'レッグスルー しゅうとく',
    steps: ['ステップ1　ボールを 足の まわりで うごかす', 'ステップ2　2回 ついて → とおす', 'ステップ3　1回 ついて → とおす', 'さいご　れんぞくで とおす'],
    plan: [[['wrapl', 8], ['low', 4], ['wrap8', 8], ['cross', 4], ['wrapl', 8], ['low', 4]],
      [['c2legs', 8], ['cross', 4], ['c2legs', 8], ['wrap8', 4], ['c2legs', 8], ['low', 4], ['c2legs', 8]],
      [['c1legs', 8], ['c2legs', 4], ['c1legs', 8], ['wrapl', 4], ['c1legs', 8], ['pound', 4]],
      [['legs', 4], ['c1legs', 4], ['legs', 8], ['c2legs2', 8], ['legs', 8], ['cross', 4], ['legs', 4]]] },
  lBehind: { n: 'バックチェンジ しゅうとく', i: '🔄', d: '4つの ステップで バックチェンジ（ビハインド）を おぼえよう', w: {}, fin: 1, learn: 'behind', vt: 'バックチェンジ しゅうとく',
    steps: ['ステップ1　ボールを こしの まわり・うしろで うごかす', 'ステップ2　2回 ついて → うしろ', 'ステップ3　1回 ついて → うしろ', 'さいご　れんぞくで うしろ'],
    plan: [[['wrapw', 8], ['swingb', 8], ['pound', 4], ['wrapw', 8], ['sidev', 4], ['swingb', 4]],
      [['c2behind', 8], ['semi', 4], ['c2behind', 8], ['swingb', 4], ['c2behind', 8], ['wrapw', 4], ['c2behind', 8]],
      [['c1behind', 8], ['c2behind', 4], ['c1behind', 8], ['swingb', 4], ['c1behind', 8], ['pound', 4]],
      [['behind', 4], ['c1behind', 4], ['behind', 8], ['c2behind', 8], ['behind', 8], ['cross', 4], ['behind', 4]]] },
  lCross:  { n: 'フロントチェンジ しゅうとく', i: '🔀', d: '4つの ステップで フロントチェンジを きわめよう', w: {}, fin: 1, learn: 'cross', vt: 'フロントチェンジ しゅうとく',
    steps: ['ステップ1　かた手で 左右に うごかす（チェンジの もと）', 'ステップ2　2回 ついて → チェンジ', 'ステップ3　1回 ついて → チェンジ', 'さいご　れんぞくで チェンジ'],
    plan: [[['frontv', 8], ['pound', 4], ['frontv', 8], ['cross', 4], ['frontv', 8], ['pound', 4]],
      [['c2cross', 8], ['cross', 4], ['c2cross', 8], ['dcross', 4], ['c2cross', 8], ['pound', 4], ['c2cross', 8]],
      [['c1cross', 8], ['c2cross', 4], ['c1cross', 8], ['frontv', 4], ['c1cross', 8], ['pound', 4]],
      [['cross', 4], ['c1cross', 4], ['cross', 8], ['c2cross2', 8], ['cross', 8], ['dcross', 4], ['cross', 4]]] },
  boss:    { n: 'ボスせん', i: '👾', d: 'ボスを たおして なかまを すくえ', w: {}, boss: 1, vt: '試合形式 ちょうせん' },
};
// BGM（曲の テンポと 最初の 拍の いち は 曲を 解析して はかった あたい）
// rate＝再生の はやさ（音の 高さは かえない）、half＝2拍で ゲームの 1拍（ゆっくりの ステージ用）
export const SONGS = {
  retro:       { file: 'music/retro.mp3',       name: 'Retro Dance Fever',          bpm: 103.158, t0: 0.052 },
  neon:        { file: 'music/neon.mp3',        name: 'Neon Nights',                bpm: 117.578, t0: 0.2888 },
  workhard:    { file: 'music/workhard.mp3',    name: 'Work Hard Dance Harder',     bpm: 123.051, t0: 0.2142 },
  song4:       { file: 'music/song4.mp3',       name: 'クラシックシンセウェーブアンセム', bpm: 123.243, t0: 0.2733 },
  workhard2:   { file: 'music/workhard2.mp3',   name: 'Work Hard Dance Harder 2',   bpm: 129.242, t0: 0.2962 },
  nightlights: { file: 'music/nightlights.mp3', name: 'Night Lights',               bpm: 135.944, t0: 0.1997 },
  focusbeam:   { file: 'music/focusbeam.mp3',   name: 'Focus Beam',                 bpm: 136.023, t0: 0.0854 },
};
// ワールドごとの 曲と はやさ：ワールドが すすむほど、同じ ワールドでも ステージが すすむほど はやく
const WORLD_SONG = [['retro', 1.0, 0.01], ['neon', 0.92, 0.01], ['workhard', 0.94, 0.01], ['song4', 1.0, 0.008], ['workhard2', 1.0, 0.008]];
const songFor = (id, rate, half = 1) => ({ song: id, rate, half, bpm: Math.round(SONGS[id].bpm * rate / half * 10) / 10 });
const ORDER = ['dodge', 'steps', 'weak', 'guard', 'stealth', 'boss'];
export const STAGES = WORLDS.flatMap((w, wi) => ORDER.map((m, mi) => ({
  id: `${w.id}-${mi + 1}`, world: w, wi, mi, mission: m, name: `${w.name} ${mi + 1}`, bpm: w.bpm + mi, sections: 3,
  ...songFor(WORLD_SONG[wi][0], WORLD_SONG[wi][1] + WORLD_SONG[wi][2] * mi),
})));
STAGES.push({ id: 'sp-two', world: WORLDS[2], wi: 2, mi: 6, mission: 'two', name: '2ボール チャレンジ', bpm: 96, sections: 3, sp: 'SP', ...songFor('focusbeam', 1.25, 2) });
STAGES.push({ id: 'sp-legs', world: WORLDS[1], wi: 1, mi: 7, mission: 'lLegs', name: 'レッグスルー しゅうとく', bpm: 88, sections: 3, sp: 'L1', ...songFor('nightlights', 1.15, 2) });
STAGES.push({ id: 'sp-behind', world: WORLDS[3], wi: 3, mi: 8, mission: 'lBehind', name: 'バックチェンジ しゅうとく', bpm: 88, sections: 3, sp: 'L2', ...songFor('nightlights', 1.15, 2) });
STAGES.push({ id: 'sp-handle', world: WORLDS[0], wi: 0, mi: 9, mission: 'handle', name: 'ハンドリング どうじょう', bpm: 92, sections: 3, sp: 'H1', ...songFor('focusbeam', 1.15, 2) });
STAGES.push({ id: 'sp-cross', world: WORLDS[4], wi: 4, mi: 10, mission: 'lCross', name: 'フロントチェンジ しゅうとく', bpm: 88, sections: 3, sp: 'L3', ...songFor('nightlights', 1.15, 2) });
export const sl = (s) => s.sp || `${s.wi + 1}-${s.mi + 1}`;

// ---------- なかま・みため ----------
export const FRIENDS = ['🐶', '🐱', '🐰', '🐸', '🐼', '🦊', '🐵', '🐧', '🐯', '🦁', '🐻', '🐨', '🐹', '🦉', '🐢', '🐙', '🦖', '🦄', '🐲', '🦅'].map((e, i) => ({ id: 'f' + i, e, n: ['ポチボ', 'ニャット', 'ピョンタ', 'ケロスケ', 'パンダム', 'コンピー', 'モンキチ', 'ペンタ', 'トラジロー', 'レオン', 'クマード', 'コアラン', 'ハムタ', 'ホーさん', 'カメキチ', 'タコリン', 'レックス', 'ユニコ', 'ミニドラ', 'イーグルX'][i] }));
export const BOSS_FRIENDS = WORLDS.map((w, i) => ({ id: 'b' + i, e: ['🤖', '👾', '🛸', '🦂', '👑'][i], n: ['ガードロボ(なかま)', 'メトロン', 'UFOくん', 'スコピー', 'キングコア'][i], rare: true }));
export const ALL_FRIENDS = [...FRIENDS, ...BOSS_FRIENDS];
// pat：もようの しゅるい（balls.js で かく）。じっさいに ある いろ・がらを さんこうに した オリジナル（ロゴなし）
export const BALLS = [
  { id: 'std', n: 'ノーマル', cost: 0, pat: 'solid', c1: '#ff9a3d', c2: '#c4520a' },
  { id: 'brown', n: 'クラシック', cost: 60, pat: 'solid', c1: '#d9773a', c2: '#7a3a14' },
  { id: 'ice', n: 'アイス', cost: 100, pat: 'solid', c1: '#c4f3ff', c2: '#2a8dd6' },
  { id: 'lime', n: 'ライム', cost: 100, pat: 'solid', c1: '#d6ff6b', c2: '#3fa60a' },
  { id: 'pink', n: 'ピーチ', cost: 150, pat: 'solid', c1: '#ffc2e3', c2: '#e83f8f' },
  { id: 'rw', n: 'ストリート', cost: 150, pat: 'panels', cols: ['#e8352b', '#f4f1ea'], seam: '#151515' },
  { id: 'aba', n: 'トリコロール', cost: 180, pat: 'stripes', cols: ['#d8242c', '#f6f6f6', '#1f4fb8', '#d8242c', '#f6f6f6', '#1f4fb8'], seam: '#141414' },
  { id: 'by', n: 'イエロー×ブルー', cost: 180, pat: 'panels', cols: ['#ffd21f', '#1d5fd0'], seam: '#10183a' },
  { id: 'half', n: 'ハーフ＆ハーフ', cost: 200, pat: 'half', cols: ['#ff7a1a', '#232633'], seam: '#0c0c0c' },
  { id: 'dots', n: 'みずたま', cost: 200, pat: 'dots', c1: '#3dc7ff', c2: '#1f6fd6', dot: '#ffffff', seam: '#0b2a55' },
  { id: 'camo', n: 'めいさい', cost: 220, pat: 'camo', cols: ['#6d7a45', '#3e4a2a', '#a69a6a', '#23281a'], seam: '#151a10' },
  { id: 'gold', n: 'ゴールド', cost: 250, pat: 'metal', cols: ['#fff2a8', '#e0a91c', '#9a6a05'], seam: '#3a2600' },
  { id: 'dark', n: 'シャドー', cost: 250, pat: 'solid', c1: '#8d7bff', c2: '#1b1247', seam: '#07041a' },
  { id: 'bkgd', n: 'ブラック×ゴールド', cost: 280, pat: 'solid', c1: '#2b2b30', c2: '#0b0b0d', seam: '#e8b62a' },
  { id: 'silver', n: 'シルバー', cost: 280, pat: 'metal', cols: ['#ffffff', '#b9c2cc', '#6c7783'], seam: '#22282e' },
  { id: 'star', n: 'スター', cost: 300, pat: 'stars', c1: '#2b4fd8', c2: '#0f1f6e', dot: '#ffe14a', seam: '#ffe14a' },
  { id: 'fire', n: 'ファイヤー', cost: 320, pat: 'flame', c1: '#3a0d05', c2: '#120402', seam: '#0a0200' },
  { id: 'tie', n: 'タイダイ', cost: 350, pat: 'swirl', cols: ['#ff3d8b', '#ffb13d', '#ffe94d', '#4dff88', '#3db8ff', '#9b5cff'], seam: '#1a1030' },
  { id: 'rainbow', n: 'レインボー', cost: 380, pat: 'prism', cols: ['#ff4d4d', '#ffb13d', '#ffe94d', '#4dff88', '#3db8ff', '#9b5cff', '#ff4d4d'], seam: '#1a1a1a' },
  { id: 'neon', n: 'ネオン', cost: 420, pat: 'neon', cols: ['#3df5ff', '#ff3df0', '#b6ff3d'] },
  { id: 'galaxy', n: 'ギャラクシー', cost: 500, pat: 'galaxy', cols: ['#1b0f4a', '#0a0620', '#2a0f55'], seam: '#000000' },
];
export const SUITS = [
  { id: 'cy', n: 'シアン', cost: 0, c: '#3df5ff' }, { id: 'mg', n: 'マゼンタ', cost: 100, c: '#ff3df0' }, { id: 'gr', n: 'グリーン', cost: 100, c: '#4dff88' },
  { id: 'or', n: 'オレンジ', cost: 150, c: '#ffb13d' }, { id: 'wh', n: 'ホワイト', cost: 200, c: '#ffffff' }, { id: 'rd', n: 'レッド', cost: 200, c: '#ff4d4d' },
];
export const CAPSULE_COST = 60;
// '@hero1'〜 は イラストの かお（img/avatar/）。それいがいは 絵文字
export const avHTML = (a) => { if (a === '🦸') a = '@hero1'; return a && a[0] === '@' ? `<img class="avimg" src="img/avatar/${a.slice(1)}.jpg" alt="">` : a; };
export const AVATARS = ['@f1', '@f2', '@f3', '@f4', '@f5', '@f6', '@f7', '@f8', '@f9', '@f10']; // かお（img/avatar/f1〜10）。むかしの '@hero〜' や 絵文字も そのまま 表示できる

// ---------- レベル（R1〜R6）：レベルごとに ステージと ★を もつ ----------
// つぎの レベルが ひらく じょうけん：ぜんぶの ステージ（30）で ★1いじょう ＋ ★の ごうけいが LEVEL_GOAL いじょう（★2×30＝60 が めやす）
export const MAX_LV = 6;
export const LEVEL_GOAL = { 1: 45, 2: 50, 3: 55, 4: 60, 5: 60, 6: 60 };
export const LEVEL_SPEED = (L) => 1 + 0.02 * (L - 1); // レベルが 上がるほど 少し はやく
export const MAIN_STAGES = STAGES.filter((s) => !s.sp);
function migrateLv(p) { if (!p.ls) { p.ls = {}; const m = {}; MAIN_STAGES.forEach((s) => { if (p.stars && p.stars[s.id]) m[s.id] = p.stars[s.id]; }); p.ls[p.rank || 1] = m; } if (!p.lv) p.lv = p.rank || 1; }
export const curLv = (p) => Math.max(1, Math.min(p.rank || 1, p.lv || p.rank || 1));
export function lvStars(p, L) { if (!p.ls) migrateLv(p); if (!p.ls[L]) p.ls[L] = {}; return p.ls[L]; }
export const lvTotal = (p, L) => { const m = lvStars(p, L); return MAIN_STAGES.reduce((a, s) => a + (m[s.id] || 0), 0); };
export const lvCleared = (p, L) => { const m = lvStars(p, L); return MAIN_STAGES.filter((s) => (m[s.id] || 0) > 0).length; };
export const lvDone = (p, L) => lvCleared(p, L) === MAIN_STAGES.length && lvTotal(p, L) >= LEVEL_GOAL[L];

// ---------- 保存 ----------
const KEY = 'dribble-rescue-v2';
const def = () => ({ players: [], current: null, settings: { voice: 'en', sound: true, music: true, camera: false, sens: 'normal', swap: false, openAll: true, bloom: true, videoRec: false, volMusic: 0.5, volBall: 1, volVoice: 1, v: 4 } });
export const S = (() => {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.players)) { s.players.forEach(migrateLv); const old = s.settings || {}; s.settings = { ...def().settings, ...old }; if (old.v !== 4) { s.settings.voice = 'en'; s.settings.v = 4; } return s; } } catch (e) { /* noop */ }
  return def();
})();
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* noop */ } }
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function newPlayer(name, avatar, rank = 1) {
  return { id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name, avatar, rank, m: {}, coins: 0, friends: [], buddy: null,
    balls: ['std'], ball: 'std', suits: ['cy'], suit: 'cy', stars: {}, best: {}, verified: {}, bossDone: {}, plays: 0, stamps: 0, tickets: 0, lastDay: '', day: null, tipIdx: {}, leftReps: 0, rightReps: 0, ls: {}, lv: rank };
}
export function addPlayer(name, avatar, rank) { S.players = S.players.filter((x) => !(x.guest && x.plays === 0)); const p = newPlayer(name, avatar, rank); S.players.push(p); S.current = p.id; save(); return p; }
export function renamePlayer(p, name) { const n = (name || '').trim().slice(0, 10); if (!n) return false; p.name = n; delete p.guest; save(); return true; }
export function player() {
  let p = S.players.find((x) => x.id === S.current) || S.players[0];
  if (!p) { p = newPlayer('プレイヤー', '@f1'); p.guest = true; S.players.push(p); }
  if (S.current !== p.id) { S.current = p.id; save(); }
  return p;
}
export const totalStars = (p) => Object.values(p.stars).reduce((a, b) => a + b, 0);
export const mastery = (p, k) => p.m[k] || 0;
// しょうきゅうテスト：そのランクの技がすべてブロンズ以上、かつ半分以上がシルバー以上
export const canTest = (p) => { if (p.rank >= 5) return false; const ks = rankSkills(p.rank); return ks.every((k) => tierOf(mastery(p, k)) >= 1) && ks.filter((k) => tierOf(mastery(p, k)) >= 2).length >= Math.ceil(ks.length / 2); };

// ---------- きょうのミッション ----------
function seeded(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
const worldOpen = (p, w) => S.settings.openAll || lvTotal(p, curLv(p)) >= w.need;
export function dayState(p) {
  const t = today();
  if (!p.day || p.day.date !== t || p.day.missions.some((m) => m.skill && !SKILLS[m.skill])) {
    const rnd = seeded(t.split('-').reduce((a, b) => a * 31 + +b, 7) + p.id.length);
    const pool = poolFor(p.rank); const weakest = pool.slice().sort((a, b) => mastery(p, a) - mastery(p, b));
    const sk = weakest[Math.floor(rnd() * Math.min(3, weakest.length))];
    // 2こめ・3こめは まいにち かわる（あいている ワールドの なかから）
    const open = MAIN_STAGES.filter((x) => worldOpen(p, x.world)); const ls = lvStars(p, curLv(p));
    const bossOpen = open.filter((x) => MISSIONS[x.mission].boss);
    const target = (open.filter((x) => (ls[x.id] || 0) < 3).sort(() => rnd() - 0.5)[0]) || open[Math.floor(rnd() * open.length)];
    const cand = [
      { id: 'dojo', n: 1, text: 'トレーニングルームで 1ワザ れんしゅう' },
      { id: 'clear', n: 2, text: 'ステージを 2回 クリア' },
      { id: 'star3', n: 1, text: 'どこかの ステージで ★3を とる' },
      ...(bossOpen.length ? [{ id: 'boss', n: 1, text: 'ボスステージを クリア' }] : []),
      ...(target ? [{ id: 'stage', n: 1, stage: target.id, text: `${sl(target)}「${MISSIONS[target.mission].n}」を クリア` }] : []),
      { id: 'plays', n: 3, text: 'ステージか れんしゅうを 3回 あそぶ' },
    ];
    const pick = []; while (pick.length < 2 && cand.length) pick.push(cand.splice(Math.floor(rnd() * cand.length), 1)[0]);
    p.day = { date: t, cues: {}, dojo: 0, clears: 0, star3: 0, boss: 0, plays: 0, st: [], claimed: [],
      missions: [{ id: 'skill', skill: sk, n: 12, text: `「${SKILLS[sk].n}」を 12回 こなす` }, ...pick] };
  }
  return p.day;
}
export function missionProgress(p, m) { const d = dayState(p);
  switch (m.id) { case 'skill': return d.cues[m.skill] || 0; case 'dojo': return d.dojo; case 'star3': return d.star3 || 0; case 'boss': return d.boss || 0;
    case 'stage': return (d.st || []).includes(m.stage) ? 1 : 0; case 'plays': return d.plays || 0; default: return d.clears; } }
export const MISSION_COIN = 20, MISSION_ALL = 30;
export const missionAllDone = (p) => { const d = dayState(p); return d.missions.every((m) => d.claimed.includes(m.id)); };
// 遊んだ日のスタンプ（とぎれても消えない）
// れんぞく日数：3日め 🪙30、5日め カプセルけん、7日め 🪙100（7日ごとに くりかえし）
export const STREAK_RW = { 3: { coins: 30, t: '🪙30' }, 5: { ticket: 1, t: '🎟️ カプセルけん' }, 0: { coins: 100, t: '🪙100' } };
const yday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const streakNow = (p) => (p.lastDay === today() || p.lastDay === yday() ? p.streak || 0 : 0);
export function stamp(p) { const t = today(); if (p.lastDay === t) return false;
  p.streak = p.lastDay === yday() ? (p.streak || 0) + 1 : 1; p.streakBest = Math.max(p.streakBest || 0, p.streak);
  p.lastDay = t; p.stamps++; if (p.stamps % 7 === 0) p.tickets++;
  const rw = STREAK_RW[p.streak % 7]; const hit = p.streak >= 3 && rw ? rw : null; if (hit) { p.coins += hit.coins || 0; p.tickets += hit.ticket || 0; }
  return { streak: p.streak, rw: hit }; }

// ---------- そだつ（プレイかいすう） ----------
export const GROW = [{ n: 'ミニバス', at: 0, k: 1, aura: 0.25 }, { n: 'ちゅうがくせい', at: 30, k: 1.06, aura: 0.38 }, { n: 'こうこうせい', at: 100, k: 1.12, aura: 0.52 }, { n: 'プロ', at: 250, k: 1.18, aura: 0.7, gold: true }];
export const growOf = (p) => { let g = 0; GROW.forEach((x, i) => { if ((p.plays || 0) >= x.at) g = i; }); return g; };
export const BUD_LV = [0, 5, 15, 40]; // いっしょに あそんだ かいすうで Lv1〜4
export const budLv = (p, id) => { const n = (p.bud || {})[id] || 0; let l = 1; BUD_LV.forEach((x, i) => { if (n >= x) l = i + 1; }); return l; };

// ---------- しょうごう ----------
const cnt3 = (p) => Object.values(p.stars || {}).filter((x) => x >= 3).length;
const bossN = (p) => Object.keys(p.bossDone || {}).length;
export const TITLES = [
  { id: 'first', i: '👟', n: 'はじめの一歩', d: 'ステージを はじめて クリア', ok: (p) => Object.keys(p.best || {}).length >= 1 },
  { id: 'star3', i: '🌟', n: 'パーフェクト', d: '★3を 5つ とる', ok: (p) => cnt3(p) >= 5 },
  { id: 'stars', i: '✨', n: 'スターハンター', d: '★を ぜんぶで 50こ あつめる', ok: (p) => totalStars(p) >= 50 },
  { id: 'boss1', i: '🛡️', n: 'ボスたおし', d: 'ボスを はじめて たおす', ok: (p) => bossN(p) >= 1 },
  { id: 'boss5', i: '⚔️', n: 'ボスハンター', d: 'ボスを 5たい ぜんぶ たおす', ok: (p) => bossN(p) >= 5 },
  { id: 'streak3', i: '🔥', n: 'みっかぼうず そつぎょう', d: '3日 れんぞくで あそぶ', ok: (p) => (p.streakBest || 0) >= 3 },
  { id: 'streak7', i: '👹', n: 'れんしゅうの鬼', d: '7日 れんぞくで あそぶ', ok: (p) => (p.streakBest || 0) >= 7 },
  { id: 'days30', i: '📅', n: 'まいにちドリブラー', d: 'あそんだ日が 30日', ok: (p) => (p.stamps || 0) >= 30 },
  { id: 'dojo20', i: '🥋', n: 'トレーニングの たつじん', d: 'トレーニングを 20回', ok: (p) => (p.dojoN || 0) >= 20 },
  { id: 'ball10', i: '🏀', n: 'コレクター', d: 'ボールを 10しゅるい あつめる', ok: (p) => (p.balls || []).length >= 10 },
  { id: 'friend10', i: '🐾', n: 'なかまが いっぱい', d: 'なかまを 10人 あつめる', ok: (p) => (p.friends || []).length >= 10 },
  { id: 'plays50', i: '💪', n: 'ドリブルずき', d: '50回 あそぶ', ok: (p) => (p.plays || 0) >= 50 },
  { id: 'plays200', i: '👑', n: 'ドリブルマスター', d: '200回 あそぶ', ok: (p) => (p.plays || 0) >= 200 },
  { id: 'cam', i: '📷', n: 'カメラデビュー', d: 'カメラで 1回 あそぶ', ok: (p) => (p.rec?.camPlays || 0) >= 1 },
  { id: 'combo30', i: '⚡', n: 'コンボキング', d: 'カメラで 30コンボ', ok: (p) => (p.rec?.combo || 0) >= 30 },
  { id: 'r3', i: '🥈', n: 'ちゅうきゅう ドリブラー', d: 'R3に とうたつ', ok: (p) => (p.rank || 1) >= 3 },
  { id: 'rmax', i: '🏆', n: 'レジェンド', d: 'さいごの レベルに とうたつ', ok: (p) => (p.rank || 1) >= MAX_LV },
];
// あたらしく とれた しょうごうを かえす（p.titles に きろく）
export function checkTitles(p) { p.titles = p.titles || []; const got = TITLES.filter((t) => !p.titles.includes(t.id) && t.ok(p)); got.forEach((t) => p.titles.push(t.id)); if (!p.title && got.length) p.title = got[0].id; return got; }
export const titleOf = (p) => TITLES.find((t) => t.id === p.title);

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
