import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectFormat, isValidAddress, isBase58Address, toBase58, toHex, toEvm, normalize,
  isSameAddress, fromPublicKey, base58Encode, base58Decode, explorerUrl,
} from '../src/index.js';

// Vectors verified against tronweb 6.x and ethers 6.x
const USDT = {
  base58: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  hex: '41a614f803b6fd780986a42c78ec9c7f77e6ded13c',
  evm: '0xa614f803B6FD780986A42c78Ec9c7f77e6DeD13C',
};

test('detectFormat', () => {
  assert.equal(detectFormat(USDT.base58), 'base58');
  assert.equal(detectFormat(USDT.hex), 'hex');
  assert.equal(detectFormat(USDT.evm), 'evm');
  assert.equal(detectFormat('0xdead'), null);
  assert.equal(detectFormat(''), null);
  assert.equal(detectFormat(null), null);
});

test('valid / invalid', () => {
  assert.equal(isValidAddress(USDT.base58), true);
  assert.equal(isValidAddress(USDT.hex), true);
  assert.equal(isValidAddress(USDT.evm), true);
  assert.equal(isValidAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u'), false, 'bad checksum');
  assert.equal(isValidAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6'), false, 'short');
  assert.equal(isValidAddress('0x' + 'a'.repeat(40)), true);
  assert.equal(isBase58Address(USDT.hex), false);
  assert.equal(isBase58Address(USDT.base58), true);
  assert.equal(isValidAddress(USDT.base58, { formats: ['hex'] }), false);
});

test('conversions round-trip', () => {
  assert.equal(toHex(USDT.base58), USDT.hex);
  assert.equal(toBase58(USDT.hex), USDT.base58);
  assert.equal(toBase58(USDT.evm), USDT.base58);
  assert.equal(toEvm(USDT.base58), USDT.evm);
  assert.equal(toEvm(USDT.hex, { checksum: false }), USDT.evm.toLowerCase());
  assert.equal(toHex(USDT.hex.toUpperCase()), USDT.hex);
  const n = normalize(USDT.evm);
  assert.equal(n.base58, USDT.base58);
  assert.equal(n.hex, USDT.hex);
  assert.equal(n.evm, USDT.evm);
  assert.equal(n.format, 'evm');
  assert.equal(n.bytes.length, 21);
});

test('isSameAddress', () => {
  assert.equal(isSameAddress(USDT.base58, USDT.evm), true);
  assert.equal(isSameAddress(USDT.base58, 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'), false);
  assert.equal(isSameAddress('nope', USDT.base58), false);
});

test('fromPublicKey (uncompressed, raw, compressed)', () => {
  // private key = 1 → generator point
  const uncompressed = '0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8';
  const expected = 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC';
  assert.equal(fromPublicKey(uncompressed).base58, expected);
  assert.equal(fromPublicKey('0x' + uncompressed).base58, expected);
  assert.equal(fromPublicKey(uncompressed.slice(2)).base58, expected);
  assert.equal(fromPublicKey('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798').base58, expected);
  assert.equal(fromPublicKey(uncompressed).evm, '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf');
  // odd-y key
  const pk2 = '044e3b81af9c2234cad09d679ce6035ed1392347ce64ce405f5dcd36228a25de6e47fd35c4215d1edf53e6f83de344615ce719bdb0fd878f6ed76f06dd277956de';
  assert.equal(fromPublicKey(pk2).base58, 'TE2H9hWjzYdwzDFRJfx9BFhr4MmjH1CHaz');
  assert.equal(fromPublicKey('024e3b81af9c2234cad09d679ce6035ed1392347ce64ce405f5dcd36228a25de6e').base58, 'TE2H9hWjzYdwzDFRJfx9BFhr4MmjH1CHaz');
});

test('base58 primitives', () => {
  assert.equal(base58Encode(new Uint8Array([0, 0, 1])), '112');
  assert.deepEqual([...base58Decode('112')], [0, 0, 1]);
  assert.throws(() => base58Decode('0OIl'));
});

test('explorerUrl', () => {
  assert.equal(explorerUrl(USDT.hex), `https://tronscan.org/#/address/${USDT.base58}`);
  assert.equal(explorerUrl(USDT.base58, 'nile'), `https://nile.tronscan.org/#/address/${USDT.base58}`);
});
