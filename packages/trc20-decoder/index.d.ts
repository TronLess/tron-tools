import type { TronClient } from '@tronless/tron-client';

export interface AddressValue {
  base58: string;
  hex: string;
}
export type AbiValue = string | boolean | AddressValue;

export interface DecodedArg {
  name: string;
  type: string;
  value: AbiValue;
}

export interface DecodedInput {
  selector: string;
  known: boolean;
  name: string | null;
  signature: string | null;
  args: DecodedArg[];
  raw: string;
  to?: string;
  from?: string;
  spender?: string;
  owner?: string;
  value?: string;
}

export interface DecodedEvent {
  known: boolean;
  name: string | null;
  signature: string | null;
  topic0: string;
  contract: string | null;
  args: DecodedArg[];
  topics?: string[];
  data?: string;
  from?: string;
  to?: string;
  owner?: string;
  spender?: string;
  value?: string;
}

export interface DecodedTransaction {
  txid: string | null;
  type: string;
  from: string | null;
  to?: string | null;
  timestamp: number | null;
  expiration: number | null;
  feeLimit: number | null;
  result: string | null;
  memo: string | null;
  raw: Record<string, unknown>;
  amountSun?: number;
  amountRaw?: string | number | null;
  asset?: string;
  assetType?: string;
  contract?: string | null;
  callValueSun?: number;
  method?: string | null;
  input?: DecodedInput | null;
}

export const FUNCTIONS: Readonly<Record<string, string>>;
export const EVENTS: Readonly<Record<string, { name: string; signature: string; inputs: string[]; indexed: boolean[] }>>;

export function keccakHex(text: string): string;
export function selector(signature: string): string;
export function eventTopic(signature: string): string;
export function decodeParameters(types: string[], dataHex: string): AbiValue[];
export function encodeParameter(type: string, value: unknown): string;
export function encodeParameters(types: string[], values: unknown[]): string;
export function encodeCall(signature: string, values?: unknown[]): string;
export function encodeTransfer(to: string, amountRaw: bigint | string | number): string;
export function decodeInput(dataHex: string, options?: { signature?: string }): DecodedInput;
export function decodeEventLog(log: { address?: string; topics: string[]; data?: string }): DecodedEvent;
export function decodeTransaction(tx: any): DecodedTransaction;
export function decodeTransactionInfoLogs(info: any): DecodedEvent[];
export function decodeTransactionById(txid: string, options?: { client?: TronClient; network?: string }): Promise<{
  transaction: DecodedTransaction;
  events: DecodedEvent[];
  info: any;
}>;

declare const _default: {
  FUNCTIONS: typeof FUNCTIONS;
  EVENTS: typeof EVENTS;
  keccakHex: typeof keccakHex;
  selector: typeof selector;
  eventTopic: typeof eventTopic;
  decodeParameters: typeof decodeParameters;
  encodeParameter: typeof encodeParameter;
  encodeParameters: typeof encodeParameters;
  encodeCall: typeof encodeCall;
  encodeTransfer: typeof encodeTransfer;
  decodeInput: typeof decodeInput;
  decodeEventLog: typeof decodeEventLog;
  decodeTransaction: typeof decodeTransaction;
  decodeTransactionInfoLogs: typeof decodeTransactionInfoLogs;
  decodeTransactionById: typeof decodeTransactionById;
};
export default _default;
