export type NetworkName = 'mainnet' | 'nile' | 'shasta';

export interface NetworkPreset {
  name: NetworkName;
  fullNode: string;
  explorer: string;
  usdt: string;
}

export const NETWORKS: Readonly<Record<NetworkName, NetworkPreset>>;

export class TronClientError extends Error {
  status?: number;
  body?: unknown;
  url?: string;
}

export interface TronClientOptions {
  network?: NetworkName;
  fullNode?: string;
  apiKey?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

export interface ConstantCall {
  ownerAddress?: string;
  contractAddress: string;
  functionSelector: string;
  parameter?: string;
}

export class TronClient {
  constructor(options?: TronClientOptions);
  network: NetworkName | 'custom';
  baseUrl: string;
  explorer: string | null;
  apiKey: string;
  timeoutMs: number;
  retries: number;
  readonly preset: NetworkPreset | null;
  request(method: 'GET' | 'POST', path: string, opts?: { body?: unknown; query?: Record<string, unknown> }): Promise<any>;
  get(path: string, query?: Record<string, unknown>): Promise<any>;
  post(path: string, body?: unknown): Promise<any>;
  getNowBlock(): Promise<any>;
  getChainParameters(): Promise<{ chainParameter: Array<{ key: string; value?: number }> }>;
  getChainParametersMap(): Promise<Record<string, number>>;
  getAccount(address: string): Promise<any>;
  getAccountResource(address: string): Promise<any>;
  getTransactionById(txid: string): Promise<any>;
  getTransactionInfoById(txid: string): Promise<any>;
  getBlockByNum(num: number): Promise<any>;
  triggerConstantContract(call: ConstantCall): Promise<any>;
  v1(path: string, query?: Record<string, unknown>): Promise<any>;
  explorerTx(txid: string): string | null;
  explorerAddress(address: string): string | null;
}

export function createClient(options?: TronClientOptions): TronClient;
export function clientFromFlags(flags?: Record<string, unknown>): TronClient;
export default TronClient;
