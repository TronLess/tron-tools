import type { TronClient } from '@tronless/tron-client';
import type { DecodedInput, DecodedEvent } from '@tronless/trc20-decoder';

export interface TokenTransfer {
  contract: string | null;
  symbol: string | null;
  decimals: number | null;
  from: string;
  to: string;
  amountRaw: string;
  amount: string | null;
}

export interface Receipt {
  txid: string | null;
  network: string | null;
  status: 'SUCCESS' | 'PENDING' | 'NOT_FOUND' | string;
  confirmed: boolean;
  contractResult?: string | null;
  failureMessage?: string | null;
  block?: number | null;
  timestamp?: string | null;
  type?: string;
  typeLabel?: string;
  from?: string | null;
  to?: string | null;
  contract?: string | null;
  method?: string | null;
  input?: DecodedInput | null;
  amount?: { asset: string; raw: string; value: string | null } | null;
  memo?: string | null;
  feeLimitSun?: number | null;
  fee?: {
    totalSun: number;
    totalTrx: string;
    energy: {
      total: number;
      fromStake: number;
      fromContractOwner: number;
      burnedUnits: number;
      burnedSun: number;
      burnedTrx: string;
      priceSunPerUnit: number | null;
      penaltyUnits: number;
    };
    bandwidth: { bytes: number; burnedSun: number; burnedTrx: string };
    other: { sun: number; trx: string; note: string | null };
  };
  events?: DecodedEvent[];
  tokenTransfers?: TokenTransfer[];
  explorer: string | null;
  raw?: { transaction: any; info: any };
}

export const CONTRACT_LABELS: Readonly<Record<string, string>>;
export function buildReceipt(tx: any, info?: any, meta?: { network?: string; explorer?: (txid: string) => string | null }): Receipt;
export function inspectTransaction(txid: string, options?: { client?: TronClient; network?: string }): Promise<Receipt>;
export function formatReceipt(receipt: Receipt): string;

declare const _default: {
  CONTRACT_LABELS: typeof CONTRACT_LABELS;
  buildReceipt: typeof buildReceipt;
  inspectTransaction: typeof inspectTransaction;
  formatReceipt: typeof formatReceipt;
};
export default _default;
