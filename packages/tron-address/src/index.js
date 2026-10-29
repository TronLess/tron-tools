/**
 * @tronless/tron-address
 * Validate and convert TRON addresses between Base58 (T...), hex (41...) and EVM (0x...) forms.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { base58Encode, base58Decode } from './base58.js';

export { base58Encode, base58Decode };

export const ADDRESS_PREFIX_BYTE = 0x41;
export const ADDRESS_PREFIX = '41';

const HEX_RE = /^[0-9a-fA-F]+$/;

function hexToBytes(hex) {
  if (hex.length % 2 !== 0 || !HEX_RE.test(hex)) throw new Error('Invalid hex string');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes) {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

function checksum(payload) {
  return sha256(sha256(payload)).slice(0, 4);
}

/**
 * Detect the format of an address string.
 * @param {string} input
 * @returns {'base58'|'hex'|'evm'|null}
 */
export function detectFormat(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim();
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(s)) return 'base58';
  if (/^41[0-9a-fA-F]{40}$/.test(s)) return 'hex';
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return 'evm';
  return null;
}

/**
 * Convert any supported form to raw 21-byte TRON address bytes (0x41 + 20 bytes).
 * Throws on invalid input (including a bad Base58 checksum).
 * @param {string} input
 * @returns {Uint8Array}
 */
export function toBytes(input) {
  const format = detectFormat(input);
  const s = String(input).trim();
  if (format === 'base58') {
    const decoded = base58Decode(s);
    if (decoded.length !== 25) throw new Error('Invalid TRON address length');
    const payload = decoded.slice(0, 21);
    const check = decoded.slice(21);
    const expected = checksum(payload);
    for (let i = 0; i < 4; i += 1) {
      if (check[i] !== expected[i]) throw new Error('Invalid TRON address checksum');
    }
    if (payload[0] !== ADDRESS_PREFIX_BYTE) throw new Error('Invalid TRON address prefix');
    return payload;
  }
  if (format === 'hex') return hexToBytes(s.toLowerCase());
  if (format === 'evm') return hexToBytes(ADDRESS_PREFIX + s.slice(2).toLowerCase());
  throw new Error(`Not a TRON address: ${JSON.stringify(input)}`);
}

/**
 * Is this a valid TRON address in Base58, hex (41...) or EVM (0x...) form?
 * Base58 addresses are checksum-verified.
 * @param {string} input
 * @param {{formats?: Array<'base58'|'hex'|'evm'>}} [options] restrict accepted formats
 */
export function isValidAddress(input, options = {}) {
  const format = detectFormat(input);
  if (!format) return false;
  if (options.formats && !options.formats.includes(format)) return false;
  try {
    toBytes(input);
    return true;
  } catch {
    return false;
  }
}

/** Strict Base58 (T...) validation with checksum — what wallets and exchanges usually want. */
export function isBase58Address(input) {
  return isValidAddress(input, { formats: ['base58'] });
}

/** Convert to Base58 (T...). */
export function toBase58(input) {
  const payload = toBytes(input);
  const full = new Uint8Array(25);
  full.set(payload, 0);
  full.set(checksum(payload), 21);
  return base58Encode(full);
}

/** Convert to TRON hex form: "41" + 40 hex chars, lowercase. */
export function toHex(input) {
  return bytesToHex(toBytes(input));
}

/** EIP-55 mixed-case checksum for a 20-byte EVM address. */
export function toChecksumEvm(evmLower) {
  const addr = evmLower.toLowerCase().replace(/^0x/, '');
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(addr)));
  let out = '0x';
  for (let i = 0; i < addr.length; i += 1) {
    out += parseInt(hash[i], 16) >= 8 ? addr[i].toUpperCase() : addr[i];
  }
  return out;
}

/**
 * Convert to EVM-style 0x address (20 bytes). Checksummed (EIP-55) by default.
 * @param {string} input
 * @param {{checksum?: boolean}} [options]
 */
export function toEvm(input, options = {}) {
  const hex = toHex(input).slice(2);
  return options.checksum === false ? `0x${hex}` : toChecksumEvm(hex);
}

/** All forms at once. Throws on invalid input. */
export function normalize(input) {
  const bytes = toBytes(input);
  const hex = bytesToHex(bytes);
  const evmLower = `0x${hex.slice(2)}`;
  return {
    input: String(input).trim(),
    format: detectFormat(input),
    base58: toBase58(input),
    hex,
    evm: toChecksumEvm(evmLower),
    evmLower,
    bytes,
  };
}

/** Compare two addresses in any form. Invalid input returns false. */
export function isSameAddress(a, b) {
  try {
    return toHex(a) === toHex(b);
  } catch {
    return false;
  }
}

// ---- secp256k1 point decompression (only needed for compressed public keys) ----
const P = 2n ** 256n - 2n ** 32n - 977n;

function modPow(base, exp, mod) {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1n;
  }
  return result;
}

function decompressPublicKey(bytes33) {
  const prefix = bytes33[0];
  const x = BigInt(`0x${bytesToHex(bytes33.slice(1))}`);
  const y2 = (modPow(x, 3n, P) + 7n) % P;
  let y = modPow(y2, (P + 1n) / 4n, P);
  if ((y * y) % P !== y2) throw new Error('Invalid compressed public key');
  const odd = y & 1n;
  if ((prefix === 0x03 && odd === 0n) || (prefix === 0x02 && odd === 1n)) y = P - y;
  const out = new Uint8Array(65);
  out[0] = 0x04;
  out.set(hexToBytes(x.toString(16).padStart(64, '0')), 1);
  out.set(hexToBytes(y.toString(16).padStart(64, '0')), 33);
  return out;
}

/**
 * Derive a TRON address from a secp256k1 public key.
 * Accepts 65-byte uncompressed (04...), 64-byte raw XY, or 33-byte compressed (02/03...) hex.
 * @param {string|Uint8Array} publicKey
 * @returns {{base58: string, hex: string, evm: string}}
 */
export function fromPublicKey(publicKey) {
  let bytes = typeof publicKey === 'string' ? hexToBytes(publicKey.replace(/^0x/, '')) : publicKey;
  if (bytes.length === 33) bytes = decompressPublicKey(bytes);
  if (bytes.length === 65) {
    if (bytes[0] !== 0x04) throw new Error('Uncompressed public key must start with 0x04');
    bytes = bytes.slice(1);
  }
  if (bytes.length !== 64) throw new Error('Public key must be 33, 64 or 65 bytes');
  const hash = keccak_256(bytes);
  const hex = ADDRESS_PREFIX + bytesToHex(hash.slice(12));
  return { base58: toBase58(hex), hex, evm: toChecksumEvm(hex.slice(2)) };
}

/** Explorer link on TronScan (mainnet by default). */
export function explorerUrl(input, network = 'mainnet') {
  const hosts = { mainnet: 'https://tronscan.org', nile: 'https://nile.tronscan.org', shasta: 'https://shasta.tronscan.org' };
  return `${hosts[network] || hosts.mainnet}/#/address/${toBase58(input)}`;
}

export default {
  detectFormat,
  isValidAddress,
  isBase58Address,
  toBase58,
  toHex,
  toEvm,
  toBytes,
  normalize,
  isSameAddress,
  fromPublicKey,
  explorerUrl,
};
