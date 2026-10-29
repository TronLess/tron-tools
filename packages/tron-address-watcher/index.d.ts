import { EventEmitter } from 'node:events';
import type { TronClient } from '@tronless/tron-client';

export interface Transfer {
  kind: 'TRC20' | 'TRX';
  txid: string;
  /** the watched address this transfer was found for */
  address: string;
  direction: 'in' | 'out';
  from: string;
  to: string;
  token: { address: string | null; symbol: string | null; name: string | null; decimals: number };
  amountRaw: string;
  amount: string;
  timestamp: number;
  time: string;
  type: string;
}

export interface FetchOptions {
  client?: TronClient;
  network?: string;
  since?: number;
  until?: number;
  limit?: number;
  maxPages?: number;
  onlyConfirmed?: boolean;
  contracts?: string[];
}

export interface WatcherOptions {
  addresses: string[];
  client?: TronClient;
  network?: string;
  pollIntervalMs?: number;
  delayBetweenAddressesMs?: number;
  trc20?: boolean;
  trx?: boolean;
  contracts?: string[];
  direction?: 'in' | 'out' | 'both';
  since?: number;
  onlyConfirmed?: boolean;
  webhookUrl?: string;
  webhookHeaders?: Record<string, string>;
  fetch?: typeof fetch;
  maxSeen?: number;
}

export function fetchTrc20Transfers(address: string, options?: FetchOptions): Promise<Transfer[]>;
export function fetchTrxTransfers(address: string, options?: Omit<FetchOptions, 'contracts'>): Promise<Transfer[]>;

export class AddressWatcher extends EventEmitter {
  constructor(options: WatcherOptions);
  addresses: string[];
  client: TronClient;
  running: boolean;
  cursor: Map<string, number>;
  start(): this;
  stop(): this;
  pollOnce(): Promise<Transfer[]>;
  on(event: 'transfer', listener: (transfer: Transfer) => void): this;
  on(event: 'poll', listener: (info: { address: string; count: number; at: number }) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'webhook', listener: (info: { ok: boolean; status: number; transfer: Transfer; error?: string }) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}

export function watchAddresses(
  addresses: string[],
  options?: Omit<WatcherOptions, 'addresses'> & { onTransfer?: (t: Transfer) => void; onError?: (e: Error) => void },
): AddressWatcher;

declare const _default: {
  AddressWatcher: typeof AddressWatcher;
  watchAddresses: typeof watchAddresses;
  fetchTrc20Transfers: typeof fetchTrc20Transfers;
  fetchTrxTransfers: typeof fetchTrxTransfers;
};
export default _default;
