import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePrivateKey, privateKeyToPublicKey, privateKeyToAddress, accountFromPrivateKey, createAccount,
  generateMnemonic, isValidMnemonic, fromMnemonic, deriveAccounts, createMnemonicAccount,
  findVanityAddress, estimateVanityAttempts, TRON_DERIVATION_PATH,
} from '../src/index.js';

// Vectors verified against tronweb 6.x (TronWeb.address.fromPrivateKey / TronWeb.fromMnemonic)
const VECTORS = [
  ['0000000000000000000000000000000000000000000000000000000000000001', 'TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC'],
  ['4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318', 'TE2H9hWjzYdwzDFRJfx9BFhr4MmjH1CHaz'],
  ['b5a4cea271ff424d7c31dc12a3e43e401df7a40d7412a15750f3f0b6b5449a28', 'TUEZSdKsoDHQMeZwihtdoBiN46zxhGWYdH'],
];
const MNEMONIC = 'test test test test test test test test test test test junk';

test('private key → address vectors', () => {
  for (const [pk, addr] of VECTORS) {
    assert.equal(privateKeyToAddress(pk), addr);
    assert.equal(privateKeyToAddress('0x' + pk), addr);
  }
  assert.equal(
    privateKeyToPublicKey(VECTORS[0][0]),
    '0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8',
  );
  assert.equal(privateKeyToPublicKey(VECTORS[0][0], { compressed: true }), '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798');
  const acc = accountFromPrivateKey(VECTORS[1][0]);
  assert.equal(acc.evmAddress, '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23');
  assert.equal(acc.hexAddress.length, 42);
});

test('invalid private keys rejected', () => {
  assert.throws(() => privateKeyToAddress('00'));
  assert.throws(() => privateKeyToAddress('0'.repeat(64)));
  assert.throws(() => privateKeyToAddress('f'.repeat(64)));
});

test('createAccount produces valid random accounts', () => {
  const a = createAccount();
  const b = createAccount();
  assert.notEqual(a.privateKey, b.privateKey);
  assert.match(a.privateKey, /^[0-9a-f]{64}$/);
  assert.match(a.address, /^T[1-9A-HJ-NP-Za-km-z]{33}$/);
  assert.equal(privateKeyToAddress(a.privateKey), a.address);
  assert.match(generatePrivateKey(), /^[0-9a-f]{64}$/);
});

test('mnemonic derivation matches TronWeb.fromMnemonic', () => {
  assert.equal(TRON_DERIVATION_PATH, "m/44'/195'/0'/0");
  const a0 = fromMnemonic(MNEMONIC);
  assert.equal(a0.address, 'TWer2Ygk5TEheHp3TPuYeqxmB6SsGZmaL6');
  assert.equal(a0.privateKey, '15f0bbb1774be40b7a8d7965d637f324bda2f711fc5726a3dcc19585c6950954');
  assert.equal(a0.path, "m/44'/195'/0'/0/0");
  const a1 = fromMnemonic(MNEMONIC, { index: 1 });
  assert.equal(a1.address, 'TPjjvMwjPoDC32V2dGDYTkLH4E5LAtBZ6C');
  assert.equal(a1.privateKey, '9b6ac6a6faf1dc64240f654475a7e668141e4205262367feb7269ef332113929');
  const list = deriveAccounts(MNEMONIC, 2);
  assert.deepEqual(list.map((a) => a.address), [a0.address, a1.address]);
  assert.equal(fromMnemonic(MNEMONIC, { path: "m/44'/195'/0'/0/1" }).address, a1.address);
  assert.equal(fromMnemonic('  TEST test test test test test test test test test test JUNK ').address, a0.address);
});

test('mnemonic generation and validation', () => {
  const m = generateMnemonic();
  assert.equal(m.split(' ').length, 12);
  assert.equal(generateMnemonic({ words: 24 }).split(' ').length, 24);
  assert.equal(isValidMnemonic(m), true);
  assert.equal(isValidMnemonic(MNEMONIC), true);
  assert.equal(isValidMnemonic('test test test'), false);
  assert.throws(() => fromMnemonic('not a mnemonic at all'));
  assert.throws(() => generateMnemonic({ words: 13 }));
  const acc = createMnemonicAccount();
  assert.equal(fromMnemonic(acc.mnemonic).address, acc.address);
  assert.notEqual(fromMnemonic(acc.mnemonic, { passphrase: 'x' }).address, acc.address);
});

test('vanity search', () => {
  const r = findVanityAddress({ prefix: 'TA', maxAttempts: 200000 });
  assert.ok(r.address.startsWith('TA'));
  assert.ok(r.attempts >= 1);
  assert.equal(privateKeyToAddress(r.privateKey), r.address);
  const s = findVanityAddress({ suffix: 'a', caseSensitive: false, maxAttempts: 200000 });
  assert.ok(/a$/i.test(s.address));
  assert.throws(() => findVanityAddress({ prefix: 'T0' }));
  assert.equal(estimateVanityAttempts({ prefix: 'TAB' }), 58 * 58);
  assert.equal(estimateVanityAttempts({ prefix: 'AB', caseSensitive: false }), 34 * 34);
});
