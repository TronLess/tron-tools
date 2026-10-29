import type { TronClient } from '@tronless/tron-client';

export interface ClientOptions {
  client?: TronClient;
  network?: 'mainnet' | 'nile' | 'shasta';
}

export interface ConstantCallResult {
  contract: string;
  method: string;
  raw: string;
  values: Array<string | boolean | { base58: string; hex: string }>;
  energyUsed: number | null;
}

export interface TokenInfo {
  address: string;
  network: string;
  name: string | null;
  symbol: string | null;
  decimals: number;
  totalSupplyRaw: string | null;
  totalSupply: string | null;
  explorer: string | null;
}

export interface TokenBalance {
  contract: string;
  holder: string;
  network: string;
  raw: string;
  decimals: number;
  balance: string;
}

export interface TokenAllowance {
  contract: string;
  owner: string;
  spender: string;
  raw: string;
  decimals: number;
  allowance: string;
}

export function resolveContract(token: string, client?: TronClient): string;
export function callConstant(call: ClientOptions & {
  contract: string;
  method: string;
  types?: string[];
  values?: unknown[];
  outputs?: string[];
  from?: string;
}): Promise<ConstantCallResult>;
export function getTokenInfo(token: string, options?: ClientOptions): Promise<TokenInfo>;
export function getBalance(token: string, holder: string, options?: ClientOptions & { decimals?: number }): Promise<TokenBalance>;
export function getUsdtBalance(holder: string, options?: ClientOptions): Promise<TokenBalance>;
export function getAllowance(token: string, owner: string, spender: string, options?: ClientOptions & { decimals?: number }): Promise<TokenAllowance>;
export function getBalances(tokens: string[], holder: string, options?: ClientOptions & { decimals?: number }): Promise<Array<TokenBalance | { contract: string; holder: string; error: string }>>;

declare const _default: {
  resolveContract: typeof resolveContract;
  callConstant: typeof callConstant;
  getTokenInfo: typeof getTokenInfo;
  getBalance: typeof getBalance;
  getUsdtBalance: typeof getUsdtBalance;
  getAllowance: typeof getAllowance;
  getBalances: typeof getBalances;
};
export default _default;
