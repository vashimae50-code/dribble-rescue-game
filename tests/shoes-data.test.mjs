// バッシュの データと 買う しょり（node --test tests/*.test.mjs）
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOES, SHOP_SHOES, SHOP_BALLS, ensureShoes, shoePaint, buyItem, TITLES } from '../js/data.js';

const find = (id) => SHOES.find((s) => s.id === id);
const mk = (coins) => ({ coins, balls: ['std'], ball: 'std', suits: ['cy'], suit: 'cy', shoes: ['std'], shoe: 'std', titles: [], stars: {}, best: {}, bossDone: {} });

test('ラインナップは 14そく（ショップ 13・ひみつ 1）で id が かぶらない', () => {
  assert.equal(SHOES.length, 14);
  assert.equal(SHOP_SHOES.length, 13);
  assert.equal(new Set(SHOES.map((s) => s.id)).size, 14);
  assert.equal(find('gold').secret, true);
});

test('ふるい セーブ（shoes なし）に はじめの くつを たす', () => {
  const p = {}; ensureShoes(p);
  assert.deepEqual(p.shoes, ['std']); assert.equal(p.shoe, 'std');
  const q = { shoes: ['std', 'lime'], shoe: 'lime' }; ensureShoes(q);
  assert.deepEqual(q.shoes, ['std', 'lime']); assert.equal(q.shoe, 'lime');
});

test('スタンダードと ないものは 色を かえない（null）', () => {
  assert.equal(shoePaint(find('std'), 'L'), null);
  assert.equal(shoePaint(undefined, 'L'), null);
});

test('ひだりみぎ ちがいは 左右で ちがう 色', () => {
  assert.equal(shoePaint(find('lrRB'), 'L').up, '#d8242c');
  assert.equal(shoePaint(find('lrRB'), 'R').up, '#3a6fd8');
  assert.deepEqual(shoePaint(find('fire'), 'L'), { up: '#17171c', sole: '#e8222b', line: '#17171c' });
});

test('コインが たりないと なにも かわらない', () => {
  const p = mk(50);
  assert.deepEqual(buyItem(p, 'shoe', 'lime'), { ok: false, reason: 'coins' });
  assert.equal(p.coins, 50); assert.deepEqual(p.shoes, ['std']); assert.equal(p.shoe, 'std');
});

test('かうと コインが へって つかう。もう もっていたら お金は とらない', () => {
  const p = mk(500);
  const r = buyItem(p, 'shoe', 'lime');
  assert.equal(r.ok, true); assert.equal(r.bought, true);
  assert.equal(p.coins, 400); assert.equal(p.shoe, 'lime'); assert.ok(p.shoes.includes('lime'));
  buyItem(p, 'shoe', 'std'); assert.equal(p.shoe, 'std');
  const r2 = buyItem(p, 'shoe', 'lime');
  assert.equal(r2.ok, true); assert.equal(r2.bought, false); assert.equal(p.coins, 400); assert.equal(p.shoe, 'lime');
});

test('ひみつの ゴールドは かえない', () => {
  const p = mk(99999);
  assert.deepEqual(buyItem(p, 'shoe', 'gold'), { ok: false, reason: 'secret' });
  assert.ok(!p.shoes.includes('gold')); assert.equal(p.coins, 99999);
});

test('ない id は かえない', () => {
  const p = mk(99999);
  assert.deepEqual(buyItem(p, 'shoe', 'nope'), { ok: false, reason: 'none' });
  assert.deepEqual(buyItem(p, 'hat', 'std'), { ok: false, reason: 'none' });
});

test('13そく ぜんぶ かうと ゴールドと しょうごう', () => {
  const p = mk(99999); let last;
  for (const s of SHOP_SHOES) last = buyItem(p, 'shoe', s.id);
  assert.equal(last.completed, 'shoe');
  assert.ok(p.shoes.includes('gold'));
  assert.ok(p.titles.includes('shoeall')); assert.ok(p.titles.includes('shoe5'));
  assert.ok(TITLES.find((t) => t.id === 'shoeall'));
  buyItem(p, 'shoe', 'gold'); assert.equal(p.shoe, 'gold'); // もらった あとは つかえる
});

test('ボールの 買いかたは これまでと おなじ', () => {
  const p = mk(100);
  const r = buyItem(p, 'ball', 'brown');
  assert.equal(r.ok, true); assert.equal(p.coins, 40); assert.equal(p.ball, 'brown');
  const s = buyItem(p, 'suit', 'cy'); assert.equal(s.ok, true); assert.equal(p.suit, 'cy');
});

test('かっても しょうごうは あとの リザルトで おしらせ（ショップでは だまって つけない）', () => {
  const p = mk(99999); p.balls = ['std', 'brown', 'ice', 'lime', 'pink', 'rw', 'aba', 'by', 'half'];
  buyItem(p, 'ball', 'dots'); assert.ok(!p.titles.includes('ball10'));
  for (const id of ['lime', 'sakura', 'panda', 'redblk']) buyItem(p, 'shoe', id);
  assert.ok(!p.titles.includes('shoe5'));
});

test('ボールを ぜんぶ かうと ダイヤと ボールマスター', () => {
  const p = mk(99999); let last;
  for (const b of SHOP_BALLS) last = buyItem(p, 'ball', b.id);
  assert.equal(last.completed, 'ball'); assert.ok(p.balls.includes('diamond')); assert.ok(p.titles.includes('ballall'));
});
