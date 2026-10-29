import type { TronClient } from '@tronless/tron-client';

export interface CalculatorParams {
  energyFeeSun: number;
  bandwidthFeeSun: number;
  createAccountFeeSun: number;
  createNewAccountFeeInSystemContractSun: number;
  memoFeeSun: number;
  freeBandwidthPerDay: number;
  totalEnergyLimit: number;
  totalEnergyWeight: number | null;
  totalNetLimit: number;
  totalNetWeight: number | null;
  fetchedAt?: string;
  network?: string;
}

export interface Preset {
  key: string;
  label: string;
  energy: number;
  bandwidth: number;
}

export interface Money {
  sun: number;
  trx: string;
}

export interface FeeEstimate {
  input: { energy: number; bandwidth: number; availableEnergy: number; availableBandwidth: number; memo: boolean; activatesAccount: boolean };
  params: Pick<CalculatorParams, 'energyFeeSun' | 'bandwidthFeeSun' | 'memoFeeSun' | 'createNewAccountFeeInSystemContractSun' | 'createAccountFeeSun'>;
  energy: { required: number; covered: number; burned: number; cost: Money };
  bandwidth: { required: number; covered: boolean; burned: number; cost: Money };
  memo: Money;
  activation: Money;
  total: Money;
  worstCase: Money;
}

export interface PresetEstimate extends FeeEstimate {
  preset: string;
  label: string;
}

export const DEFAULT_PARAMS: Readonly<CalculatorParams>;
export const PRESETS: Readonly<Record<
  'TRX_TRANSFER' | 'USDT_TRANSFER' | 'USDT_TRANSFER_NEW_HOLDER' | 'TRC20_TRANSFER_GENERIC' | 'TRC20_APPROVE' | 'USDT_TRANSFER_STAKED_ESTIMATE',
  Preset
>>;

export function paramsFromChain(chain: unknown, base?: CalculatorParams): CalculatorParams;
export function fetchChainParams(options?: { client?: TronClient; network?: string }): Promise<CalculatorParams>;
export function estimateFee(input?: {
  energy?: number;
  bandwidth?: number;
  availableEnergy?: number;
  availableBandwidth?: number;
  memo?: boolean;
  activatesAccount?: boolean;
  params?: Partial<CalculatorParams>;
}): FeeEstimate;
export function estimateUsdtTransfer(options?: {
  recipientHoldsUsdt?: boolean;
  energy?: number;
  bandwidth?: number;
  availableEnergy?: number;
  availableBandwidth?: number;
  params?: Partial<CalculatorParams>;
}): PresetEstimate;
export function estimateTrxTransfer(options?: {
  bandwidth?: number;
  availableBandwidth?: number;
  memo?: boolean;
  recipientIsNew?: boolean;
  params?: Partial<CalculatorParams>;
}): PresetEstimate;
export function trxToStakeForEnergy(energyPerDay: number, params?: Partial<CalculatorParams>): {
  energyPerDay: number;
  energyPerTrxPerDay: number;
  trxToStake: number;
  totalEnergyLimit: number;
  totalEnergyWeight: number;
};
export function compareRentVsBurn(options: {
  transfersPerDay: number;
  energyPerTransfer?: number;
  rentPricePerTransferTrx: number;
  trxPriceUsd?: number;
  params?: Partial<CalculatorParams>;
  days?: number;
}): {
  transfersPerDay: number;
  days: number;
  energyPerTransfer: number;
  burn: { perTransferTrx: number; perDayTrx: number; perPeriodTrx: number; perPeriodUsd: number | null };
  rent: { perTransferTrx: number; perDayTrx: number; perPeriodTrx: number; perPeriodUsd: number | null };
  saved: { perPeriodTrx: number; perPeriodUsd: number | null; percent: number };
};

declare const _default: {
  DEFAULT_PARAMS: typeof DEFAULT_PARAMS;
  PRESETS: typeof PRESETS;
  paramsFromChain: typeof paramsFromChain;
  fetchChainParams: typeof fetchChainParams;
  estimateFee: typeof estimateFee;
  estimateUsdtTransfer: typeof estimateUsdtTransfer;
  estimateTrxTransfer: typeof estimateTrxTransfer;
  trxToStakeForEnergy: typeof trxToStakeForEnergy;
  compareRentVsBurn: typeof compareRentVsBurn;
};
export default _default;
