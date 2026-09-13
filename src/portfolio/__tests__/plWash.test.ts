import assert from 'node:assert/strict';
import {test} from 'node:test';

import {hexToRgba, plTone, shade} from '../plWash.ts';

test('hexToRgba expands short hex and passes non-hex through', () => {
  assert.equal(hexToRgba('#ff0000', 0.2), 'rgba(255, 0, 0, 0.2)');
  assert.equal(hexToRgba('#0f8', 1), 'rgba(0, 255, 136, 1)');
  assert.equal(hexToRgba('rgba(1, 2, 3, 0.5)', 0.2), 'rgba(1, 2, 3, 0.5)');
  assert.equal(hexToRgba('#12345', 0.2), '#12345');
});

test('shade darkens toward black and clamps the amount', () => {
  assert.equal(shade('#ffffff', 0.5), '#808080');
  assert.equal(shade('#fff', 1), '#000000');
  assert.equal(shade('#336699', -3), '#336699');
  assert.equal(shade('tomato', 0.5), 'tomato');
});

test('plTone names the role; the app maps it to a colour', () => {
  assert.equal(plTone(12.5), 'profit');
  assert.equal(plTone(-0.01), 'loss');
  assert.equal(plTone(0), 'neutral');
  assert.equal(plTone(null), 'neutral');
  assert.equal(plTone(Number.NaN), 'neutral');
  assert.equal(plTone(true), 'profit');
  assert.equal(plTone(false), 'loss');
});
