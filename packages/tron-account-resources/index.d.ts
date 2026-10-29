import type { TronClient } from '@tronless/tron-client';

export interface UsageHints {
  usdtTransferEnergy: number;
  usdtTransferBandwidth: number;
  trxTransferBandwidth: number;
}

export interface ResourceReport {
  address: string | null;
  network: string | null;
  activated: boolean;
  balanceSun: number;
  balanceTrx: string;
  bandwidth: {
    free: { limit: number; used: number; available: number };
    staked: { limit: number; used: number; available: number };
    available: number;
  };
  energy: { limit: number; used: number; available: number };
  staking: {
    forEnergyTrx: string;
    forBandwidthTrx: string;
    forTronPowerTrx: string;
    delegatedOut: { energyTrx: string; bandwidthTrx: string };
    delegatedIn: { energyTrx: string; bandwidthTrx: string };
    unfreezing: Array<{ resource: string; amountSun: number; amountTrx: string; expiresAt: string | null; withdrawable: boolean }>;
    tronPower: { limit: number; used: number };
  };
  network_totals: {
    totalEnergyLimit: number;
    totalEnergyWeight: number;
    energyPerStakedTrxPerDay: number | null;
    totalNetLimit: number;
    totalNetWeight: number;
    bandwidthPerStakedTrxPerDay: number | null;
  };
  covers: {
    usdtTransfersByEnergy: number;
    usdtTransfersByBandwidth: number;
    trxTransfersByBandwidth: number;
  };
  explorer?: string | null;
}

export const USAGE_HINTS: Readonly<UsageHints>;
export function normalizeResources(resource?: any, account?: any, meta?: { address?: string; network?: string; hints?: Partial<UsageHints> }): ResourceReport;
export function getAccountResources(address: string, options?: { client?: TronClient; network?: string; includeAccount?: boolean; hints?: Partial<UsageHints> }): Promise<ResourceReport>;
export function canCover(report: ResourceReport, need?: { energy?: number; bandwidth?: number }): boolean;

declare const _default: {
  USAGE_HINTS: typeof USAGE_HINTS;
  normalizeResources: typeof normalizeResources;
  getAccountResources: typeof getAccountResources;
  canCover: typeof canCover;
};
export default _default;
