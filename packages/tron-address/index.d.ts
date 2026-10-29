export type AddressFormat = 'base58' | 'hex' | 'evm';

export interface NormalizedAddress {
  input: string;
  format: AddressFormat;
  /** T... (34 chars, checksum-verified) */
  base58: string;
  /** 41 + 40 hex chars, lowercase */
  hex: string;
  /** 0x + 40 hex chars, EIP-55 checksummed */
  evm: string;
  evmLower: string;
  bytes: Uint8Array;
}

export const ADDRESS_PREFIX: '41';
export const ADDRESS_PREFIX_BYTE: 0x41;

export function base58Encode(bytes: Uint8Array): string;
export function base58Decode(str: string): Uint8Array;
export function detectFormat(input: string): AddressFormat | null;
export function toBytes(input: string): Uint8Array;
export function isValidAddress(input: string, options?: { formats?: AddressFormat[] }): boolean;
export function isBase58Address(input: string): boolean;
export function toBase58(input: string): string;
export function toHex(input: string): string;
export function toChecksumEvm(evmLower: string): string;
export function toEvm(input: string, options?: { checksum?: boolean }): string;
export function normalize(input: string): NormalizedAddress;
export function isSameAddress(a: string, b: string): boolean;
export function fromPublicKey(publicKey: string | Uint8Array): { base58: string; hex: string; evm: string };
export function explorerUrl(input: string, network?: 'mainnet' | 'nile' | 'shasta'): string;

declare const _default: {
  detectFormat: typeof detectFormat;
  isValidAddress: typeof isValidAddress;
  isBase58Address: typeof isBase58Address;
  toBase58: typeof toBase58;
  toHex: typeof toHex;
  toEvm: typeof toEvm;
  toBytes: typeof toBytes;
  normalize: typeof normalize;
  isSameAddress: typeof isSameAddress;
  fromPublicKey: typeof fromPublicKey;
  explorerUrl: typeof explorerUrl;
};
export default _default;
