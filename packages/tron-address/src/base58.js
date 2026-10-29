// Bitcoin-style Base58 used by TRON addresses.
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE = 58n;
const INDEX = new Map([...ALPHABET].map((c, i) => [c, BigInt(i)]));

/** @param {Uint8Array} bytes */
export function base58Encode(bytes) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = '';
  while (n > 0n) {
    out = ALPHABET[Number(n % BASE)] + out;
    n /= BASE;
  }
  return '1'.repeat(zeros) + out;
}

/** @param {string} str */
export function base58Decode(str) {
  if (typeof str !== 'string' || str.length === 0) throw new Error('Base58 input must be a non-empty string');
  let n = 0n;
  for (const c of str) {
    const v = INDEX.get(c);
    if (v === undefined) throw new Error(`Invalid Base58 character "${c}"`);
    n = n * BASE + v;
  }
  const bytes = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  let zeros = 0;
  while (zeros < str.length && str[zeros] === '1') zeros += 1;
  return new Uint8Array([...new Array(zeros).fill(0), ...bytes]);
}
