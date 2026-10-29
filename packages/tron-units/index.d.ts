export interface TokenInfo {
  symbol: string;
  decimals: number;
  address: string | null;
  name?: string;
}
export interface FormatOptions {
  /** remove trailing zeros (default true) */
  trim?: boolean;
  /** force exactly N fractional digits */
  fixed?: number;
  /** add thousands separators to the integer part */
  thousands?: boolean;
}
export type TokenRef = string | number | { decimals: number; symbol?: string; address?: string | null };

export const TRX_DECIMALS: 6;
export const SUN_PER_TRX: bigint;
export const TOKENS: Readonly<Record<'TRX' | 'USDT' | 'USDC' | 'USDD' | 'WTRX' | 'TUSD' | 'BTT' | 'JST' | 'SUN' | 'WIN', TokenInfo>>;

export function parseUnits(value: string | number | bigint, decimals: number): bigint;
export function formatUnits(raw: bigint | string | number, decimals: number, options?: FormatOptions): string;
export function toSun(trx: string | number | bigint): bigint;
export function fromSun(sun: bigint | string | number, options?: FormatOptions): string;
export function sunToNumber(sun: bigint | string | number): number;
export function formatTrx(sun: bigint | string | number, options?: FormatOptions): string;
export function resolveToken(token: TokenRef): TokenInfo;
export function parseToken(value: string | number | bigint, token: TokenRef): bigint;
export function formatToken(raw: bigint | string | number, token: TokenRef, options?: FormatOptions): string;
export function formatTokenAmount(raw: bigint | string | number, token: TokenRef, options?: FormatOptions): string;
export function bigintReplacer(key: string, value: unknown): unknown;

declare const _default: {
  TRX_DECIMALS: typeof TRX_DECIMALS;
  SUN_PER_TRX: typeof SUN_PER_TRX;
  TOKENS: typeof TOKENS;
  parseUnits: typeof parseUnits;
  formatUnits: typeof formatUnits;
  toSun: typeof toSun;
  fromSun: typeof fromSun;
  sunToNumber: typeof sunToNumber;
  formatTrx: typeof formatTrx;
  resolveToken: typeof resolveToken;
  parseToken: typeof parseToken;
  formatToken: typeof formatToken;
  formatTokenAmount: typeof formatTokenAmount;
  bigintReplacer: typeof bigintReplacer;
};
export default _default;
