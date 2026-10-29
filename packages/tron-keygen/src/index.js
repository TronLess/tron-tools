/**
 * @tronless/tron-keygen
 * Offline key and address generation for TRON.
 *
 * Nothing here touches the network. Keep generated private keys and mnemonics offline.
 */
import { randomBytes } from 'node:crypto';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { generateMnemonic as bip39Generate, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist as english } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { fromPublicKey, toBase58 } from '@tronless/tron-address';

/** SLIP-44 coin type 195 = TRON. Same path TronLink, Ledger and TronWeb use. */
export const TRON_DERIVATION_PATH = "m/44'/195'/0'/0";
export const TRON_COIN_TYPE = 195;

const CURVE_ORDER = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');

function normalizePrivateKey(privateKey) {
  const hex = String(privateKey).trim().replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error('Private key must be 32 bytes (64 hex chars)');
  const n = BigInt(`0x${hex}`);
  if (n === 0n || n >= CURVE_ORDER) throw new Error('Private key is out of the secp256k1 range');
  return hex;
}

/** Cryptographically random 32-byte private key, guaranteed inside the curve order. */
export function generatePrivateKey() {
  for (;;) {
    const hex = bytesToHex(randomBytes(32));
    const n = BigInt(`0x${hex}`);
    if (n > 0n && n < CURVE_ORDER) return hex;
  }
}

/**
 * Derive the secp256k1 public key from a private key.
 * @param {string} privateKey hex (with or without 0x)
 * @param {{compressed?: boolean}} [options] default uncompressed (04 + X + Y), the form TRON uses
 */
export function privateKeyToPublicKey(privateKey, options = {}) {
  const hex = normalizePrivateKey(privateKey);
  return bytesToHex(secp256k1.getPublicKey(hexToBytes(hex), options.compressed === true));
}

/** Private key → TRON Base58 address (T...). */
export function privateKeyToAddress(privateKey) {
  return fromPublicKey(privateKeyToPublicKey(privateKey)).base58;
}

/** Build a full account object from a private key. */
export function accountFromPrivateKey(privateKey, extra = {}) {
  const pk = normalizePrivateKey(privateKey);
  const publicKey = privateKeyToPublicKey(pk);
  const addr = fromPublicKey(publicKey);
  return {
    privateKey: pk,
    publicKey,
    address: addr.base58,
    hexAddress: addr.hex,
    evmAddress: addr.evm,
    ...extra,
  };
}

/** Create a brand-new random TRON account. */
export function createAccount() {
  return accountFromPrivateKey(generatePrivateKey());
}

/**
 * Generate a BIP-39 mnemonic.
 * @param {{words?: 12|15|18|21|24}} [options]
 */
export function generateMnemonic(options = {}) {
  const words = options.words || 12;
  const strength = { 12: 128, 15: 160, 18: 192, 21: 224, 24: 256 }[words];
  if (!strength) throw new Error('words must be 12, 15, 18, 21 or 24');
  return bip39Generate(english, strength);
}

/** Is this a valid BIP-39 English mnemonic (checksum included)? */
export function isValidMnemonic(mnemonic) {
  try {
    return validateMnemonic(String(mnemonic).trim().toLowerCase().split(/\s+/).join(' '), english);
  } catch {
    return false;
  }
}

/**
 * Derive a TRON account from a BIP-39 mnemonic.
 * Default path m/44'/195'/0'/0/{index} matches TronLink, Ledger and TronWeb.fromMnemonic.
 * @param {string} mnemonic
 * @param {{index?: number, path?: string, passphrase?: string}} [options]
 */
export function fromMnemonic(mnemonic, options = {}) {
  const phrase = String(mnemonic).trim().toLowerCase().split(/\s+/).join(' ');
  if (!validateMnemonic(phrase, english)) throw new Error('Invalid BIP-39 mnemonic');
  const index = options.index ?? 0;
  const path = options.path || `${TRON_DERIVATION_PATH}/${index}`;
  const seed = mnemonicToSeedSync(phrase, options.passphrase || '');
  const child = HDKey.fromMasterSeed(seed).derive(path);
  if (!child.privateKey) throw new Error('Derivation produced no private key');
  return accountFromPrivateKey(bytesToHex(child.privateKey), { path });
}

/** Derive several consecutive accounts (index 0..count-1) from one mnemonic. */
export function deriveAccounts(mnemonic, count = 5, options = {}) {
  const start = options.startIndex ?? 0;
  const out = [];
  for (let i = start; i < start + count; i += 1) out.push(fromMnemonic(mnemonic, { ...options, index: i }));
  return out;
}

/** New mnemonic + its first account. */
export function createMnemonicAccount(options = {}) {
  const mnemonic = generateMnemonic(options);
  return { mnemonic, ...fromMnemonic(mnemonic, { index: 0, passphrase: options.passphrase }) };
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Estimate how many random keys you need on average to hit a vanity pattern.
 * The first char of every TRON address is "T", so it is free. The second char is
 * constrained by the 0x41 prefix and is not uniformly distributed, so this is a rough guide.
 */
export function estimateVanityAttempts({ prefix = '', suffix = '', caseSensitive = true } = {}) {
  let fixed = 0;
  const p = prefix.startsWith('T') ? prefix.slice(1) : prefix;
  fixed += p.length + suffix.length;
  const perChar = caseSensitive ? 58 : 34; // ~34 case-insensitive classes in Base58
  return Math.round(perChar ** fixed);
}

/**
 * Brute-force a vanity address. Synchronous loop; expect ~50k keys/s on a laptop.
 * Patterns are Base58: no 0, O, I or l. The address always starts with "T".
 * @param {{prefix?: string, suffix?: string, caseSensitive?: boolean, maxAttempts?: number, onProgress?: (n:number)=>void}} options
 * @returns {ReturnType<typeof accountFromPrivateKey> & {attempts: number}}
 */
export function findVanityAddress(options = {}) {
  const { prefix = '', suffix = '', caseSensitive = true, maxAttempts = Infinity, onProgress } = options;
  const pattern = (prefix.startsWith('T') ? prefix : `T${prefix}`).trim();
  for (const ch of pattern.slice(1) + suffix) {
    if (!BASE58_ALPHABET.includes(caseSensitive ? ch : ch)) {
      if (caseSensitive || !BASE58_ALPHABET.toLowerCase().includes(ch.toLowerCase())) {
        throw new Error(`"${ch}" is not a Base58 character (0, O, I and l never appear in TRON addresses)`);
      }
    }
  }
  if (pattern.length + suffix.length > 34) throw new Error('Pattern longer than a TRON address');
  const norm = (s) => (caseSensitive ? s : s.toLowerCase());
  const wantPrefix = norm(pattern);
  const wantSuffix = norm(suffix);
  let attempts = 0;
  for (;;) {
    attempts += 1;
    const pk = generatePrivateKey();
    const pub = secp256k1.getPublicKey(hexToBytes(pk), false);
    const address = fromPublicKey(pub).base58;
    const a = norm(address);
    if (a.startsWith(wantPrefix) && (!wantSuffix || a.endsWith(wantSuffix))) {
      return { ...accountFromPrivateKey(pk), attempts };
    }
    if (onProgress && attempts % 10000 === 0) onProgress(attempts);
    if (attempts >= maxAttempts) throw new Error(`No match after ${attempts} attempts`);
  }
}

/** Re-export for convenience. */
export { toBase58 };

export default {
  TRON_DERIVATION_PATH,
  TRON_COIN_TYPE,
  generatePrivateKey,
  privateKeyToPublicKey,
  privateKeyToAddress,
  accountFromPrivateKey,
  createAccount,
  generateMnemonic,
  isValidMnemonic,
  fromMnemonic,
  deriveAccounts,
  createMnemonicAccount,
  estimateVanityAttempts,
  findVanityAddress,
};
