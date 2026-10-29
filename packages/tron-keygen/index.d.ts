export interface TronAccount {
  /** 64 hex chars, no 0x */
  privateKey: string;
  /** uncompressed secp256k1 public key, 130 hex chars starting with 04 */
  publicKey: string;
  /** Base58 T... */
  address: string;
  /** 41... hex */
  hexAddress: string;
  /** 0x... EIP-55 */
  evmAddress: string;
  /** derivation path when derived from a mnemonic */
  path?: string;
}

export const TRON_DERIVATION_PATH: "m/44'/195'/0'/0";
export const TRON_COIN_TYPE: 195;

export function generatePrivateKey(): string;
export function privateKeyToPublicKey(privateKey: string, options?: { compressed?: boolean }): string;
export function privateKeyToAddress(privateKey: string): string;
export function accountFromPrivateKey(privateKey: string, extra?: Record<string, unknown>): TronAccount;
export function createAccount(): TronAccount;
export function generateMnemonic(options?: { words?: 12 | 15 | 18 | 21 | 24 }): string;
export function isValidMnemonic(mnemonic: string): boolean;
export function fromMnemonic(mnemonic: string, options?: { index?: number; path?: string; passphrase?: string }): TronAccount;
export function deriveAccounts(mnemonic: string, count?: number, options?: { startIndex?: number; passphrase?: string }): TronAccount[];
export function createMnemonicAccount(options?: { words?: 12 | 15 | 18 | 21 | 24; passphrase?: string }): TronAccount & { mnemonic: string };
export function estimateVanityAttempts(options?: { prefix?: string; suffix?: string; caseSensitive?: boolean }): number;
export function findVanityAddress(options?: {
  prefix?: string;
  suffix?: string;
  caseSensitive?: boolean;
  maxAttempts?: number;
  onProgress?: (attempts: number) => void;
}): TronAccount & { attempts: number };
export function toBase58(input: string): string;

declare const _default: {
  TRON_DERIVATION_PATH: typeof TRON_DERIVATION_PATH;
  TRON_COIN_TYPE: typeof TRON_COIN_TYPE;
  generatePrivateKey: typeof generatePrivateKey;
  privateKeyToPublicKey: typeof privateKeyToPublicKey;
  privateKeyToAddress: typeof privateKeyToAddress;
  accountFromPrivateKey: typeof accountFromPrivateKey;
  createAccount: typeof createAccount;
  generateMnemonic: typeof generateMnemonic;
  isValidMnemonic: typeof isValidMnemonic;
  fromMnemonic: typeof fromMnemonic;
  deriveAccounts: typeof deriveAccounts;
  createMnemonicAccount: typeof createMnemonicAccount;
  estimateVanityAttempts: typeof estimateVanityAttempts;
  findVanityAddress: typeof findVanityAddress;
};
export default _default;
