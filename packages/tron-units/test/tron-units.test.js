import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseUnits, formatUnits, toSun, fromSun, formatTrx, parseToken, formatToken, formatTokenAmount,
  TOKENS, SUN_PER_TRX, sunToNumber, bigintReplacer,
} from '../src/index.js';

test('constants', () => {
  assert.equal(SUN_PER_TRX, 1_000_000n);
  assert.equal(TOKENS.USDT.decimals, 6);
  assert.equal(TOKENS.USDT.address, 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
});

test('toSun / fromSun', () => {
  assert.equal(toSun('1.5'), 1_500_000n);
  assert.equal(toSun(1.5), 1_500_000n);
  assert.equal(toSun('0.000001'), 1n);
  assert.equal(toSun('1000000'), 1_000_000_000_000n);
  assert.equal(toSun(2n), 2_000_000n);
  assert.equal(fromSun(1_500_000n), '1.5');
  assert.equal(fromSun('6428500'), '6.4285');
  assert.equal(fromSun(1), '0.000001');
  assert.equal(fromSun(0), '0');
  assert.equal(fromSun(-1_500_000n), '-1.5');
  assert.equal(formatTrx(6428500), '6.4285 TRX');
  assert.equal(sunToNumber(6428500), 6.4285);
});

test('parseUnits errors', () => {
  assert.throws(() => toSun('1.0000001'), RangeError);
  assert.throws(() => toSun('abc'), SyntaxError);
  assert.throws(() => toSun(''), SyntaxError);
  assert.throws(() => toSun(Infinity), RangeError);
  assert.throws(() => parseUnits('1', -1), RangeError);
});

test('formatUnits options', () => {
  assert.equal(formatUnits(1_500_000n, 6, { trim: false }), '1.500000');
  assert.equal(formatUnits(1_500_000n, 6, { fixed: 2 }), '1.50');
  assert.equal(formatUnits(1_234_567_000_000n, 6, { thousands: true }), '1,234,567');
  assert.equal(formatUnits(123n, 0), '123');
  assert.equal(formatUnits('1000000000000000000', 18), '1');
  assert.equal(formatUnits(1n, 18), '0.000000000000000001');
});

test('tokens', () => {
  assert.equal(parseToken('12.5', 'USDT'), 12_500_000n);
  assert.equal(parseToken('1', 'usdd'), 10n ** 18n);
  assert.equal(formatToken(12_500_000n, 'USDT'), '12.5');
  assert.equal(formatToken(452_000_000n, { decimals: 6 }), '452');
  assert.equal(formatToken(5n, 2), '0.05');
  assert.equal(formatTokenAmount(452_000_000n, 'USDT'), '452 USDT');
  assert.throws(() => parseToken('1', 'NOPE'));
});

test('number inputs in exponent notation', () => {
  assert.equal(parseUnits(1e-6, 6), 1n);
  assert.equal(parseUnits(1e21, 0), 10n ** 21n);
});

test('bigintReplacer', () => {
  assert.equal(JSON.stringify({ a: 1n }, bigintReplacer), '{"a":"1"}');
});
