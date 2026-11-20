// ショップ用の バッシュの 絵（node --test tests/*.test.mjs）
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOES } from '../js/data.js';
import { shoeSVG, shoeIcon } from '../js/shoes.js';

const find = (id) => SHOES.find((s) => s.id === id);

test('ぜんぶの くつが SVG に なり、undefined・NaN が まざらない', () => {
  for (const s of SHOES) { const v = shoeSVG(s); assert.ok(v.startsWith('<svg'), s.id); assert.ok(!/undefined|NaN/.test(v), s.id); }
});

test('ひだりみぎ ちがいは 2そく、ふつうは 1そく', () => {
  const v = shoeSVG(find('lrRB')); assert.ok(v.includes('#d8242c') && v.includes('#3a6fd8'));
  assert.ok(v.includes('translate(72'));
  assert.ok(!shoeSVG(find('lime')).includes('translate(72'));
});

test('アイコンは data URL で、おなじ id は おなじ もの', () => {
  const a = shoeIcon(find('fire')); assert.ok(a.startsWith('data:image/svg+xml')); assert.equal(shoeIcon(find('fire')), a);
});
