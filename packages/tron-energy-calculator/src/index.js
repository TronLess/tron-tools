/**
 * @tronless/tron-energy-calculator
 * Estimate what a TRON transaction costs in energy, bandwidth and burned TRX.
 *
 * Pricing model (TRON mainnet):
 *   - Energy you do not own is burned at `getEnergyFee` SUN per unit (100 SUN since Aug 2025, 420 before).
 *   - Bandwidth: if free (600/day) + staked bandwidth does not cover the whole tx, the ENTIRE
 *     tx size is paid at `getTransactionFee` SUN per byte (1000 SUN = 0.001 TRX).
 *   - A memo (`data` field) costs `getMemoFee` (1 TRX).
 *   - Sending TRX to a never-seen address activates it: 1 TRX (+0.1 TRX when bandwidth is burned).
 */
import { TronClient } from '@tronless/tron-client';
import { fromSun } from '@tronless/tron-units';

/** Offline defaults, verified against mainnet getchainparameters on 2026-09-08. */
export const DEFAULT_PARAMS = Object.freeze({
  energyFeeSun: 100,
  bandwidthFeeSun: 1000,
  createAccountFeeSun: 100_000,
  createNewAccountFeeInSystemContractSun: 1_000_000,
  memoFeeSun: 1_000_000,
  freeBandwidthPerDay: 600,
  totalEnergyLimit: 180_000_000_000,
  /** TRX staked for energy network-wide; only needed for staking estimates. Refresh with fetchChainParams. */
  totalEnergyWeight: null,
  totalNetLimit: 43_200_000_000,
  totalNetWeight: null,
});

/**
 * Typical resource usage. Energy numbers come from live mainnet receipts and move with the
 * dynamic energy model, so treat them as estimates and override when you have real data.
 */
export const PRESETS = Object.freeze({
  TRX_TRANSFER: Object.freeze({ key: 'TRX_TRANSFER', label: 'TRX transfer', energy: 0, bandwidth: 268 }),
  USDT_TRANSFER: Object.freeze({ key: 'USDT_TRANSFER', label: 'USDT TRC-20 transfer (recipient already holds USDT)', energy: 64_285, bandwidth: 345 }),
  USDT_TRANSFER_NEW_HOLDER: Object.freeze({ key: 'USDT_TRANSFER_NEW_HOLDER', label: 'USDT TRC-20 transfer (recipient has never held USDT)', energy: 130_285, bandwidth: 345 }),
  TRC20_TRANSFER_GENERIC: Object.freeze({ key: 'TRC20_TRANSFER_GENERIC', label: 'Generic TRC-20 transfer (typical token)', energy: 30_000, bandwidth: 345 }),
  TRC20_APPROVE: Object.freeze({ key: 'TRC20_APPROVE', label: 'TRC-20 approve', energy: 25_000, bandwidth: 345 }),
  USDT_TRANSFER_STAKED_ESTIMATE: Object.freeze({ key: 'USDT_TRANSFER_STAKED_ESTIMATE', label: 'USDT transfer (rounded planning figure)', energy: 65_000, bandwidth: 345 }),
});

/** Map a getchainparameters response (array or map) to calculator params. */
export function paramsFromChain(chain, base = DEFAULT_PARAMS) {
  const map = Array.isArray(chain?.chainParameter)
    ? Object.fromEntries(chain.chainParameter.map((p) => [p.key, p.value ?? 0]))
    : chain || {};
  const pick = (key, fallback) => (Number.isFinite(map[key]) ? map[key] : fallback);
  return {
    ...base,
    energyFeeSun: pick('getEnergyFee', base.energyFeeSun),
    bandwidthFeeSun: pick('getTransactionFee', base.bandwidthFeeSun),
    createAccountFeeSun: pick('getCreateAccountFee', base.createAccountFeeSun),
    createNewAccountFeeInSystemContractSun: pick('getCreateNewAccountFeeInSystemContract', base.createNewAccountFeeInSystemContractSun),
    memoFeeSun: pick('getMemoFee', base.memoFeeSun),
    freeBandwidthPerDay: pick('getFreeNetLimit', base.freeBandwidthPerDay),
    totalEnergyLimit: pick('getTotalEnergyCurrentLimit', pick('getTotalEnergyLimit', base.totalEnergyLimit)),
    totalNetLimit: pick('getTotalNetLimit', base.totalNetLimit),
  };
}

/**
 * Fetch live chain parameters (and network staking weights) into calculator params.
 * @param {{client?: TronClient, network?: string}} [options]
 */
export async function fetchChainParams(options = {}) {
  const client = options.client || new TronClient({ network: options.network || 'mainnet' });
  const chain = await client.getChainParameters();
  const params = paramsFromChain(chain);
  try {
    // Any address works; we only need the network-wide weights returned alongside.
    const res = await client.getAccountResource('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    if (res?.TotalEnergyWeight) params.totalEnergyWeight = res.TotalEnergyWeight;
    if (res?.TotalEnergyLimit) params.totalEnergyLimit = res.TotalEnergyLimit;
    if (res?.TotalNetWeight) params.totalNetWeight = res.TotalNetWeight;
    if (res?.TotalNetLimit) params.totalNetLimit = res.TotalNetLimit;
  } catch {
    // staking weights are optional
  }
  params.fetchedAt = new Date().toISOString();
  params.network = client.network;
  return params;
}

function money(sun) {
  return { sun, trx: fromSun(sun) };
}

/**
 * Core estimator.
 * @param {{
 *   energy?: number, bandwidth?: number,
 *   availableEnergy?: number, availableBandwidth?: number,
 *   memo?: boolean, activatesAccount?: boolean,
 *   params?: Partial<typeof DEFAULT_PARAMS>,
 * }} input
 */
export function estimateFee(input = {}) {
  const params = { ...DEFAULT_PARAMS, ...(input.params || {}) };
  const energy = Math.max(0, Math.round(input.energy || 0));
  const bandwidth = Math.max(0, Math.round(input.bandwidth || 0));
  const availableEnergy = Math.max(0, Math.round(input.availableEnergy || 0));
  const availableBandwidth = Math.max(0, Math.round(input.availableBandwidth ?? params.freeBandwidthPerDay));

  const energyCovered = Math.min(energy, availableEnergy);
  const energyToBurn = energy - energyCovered;
  const energyBurnSun = energyToBurn * params.energyFeeSun;

  const bandwidthCovered = availableBandwidth >= bandwidth;
  const bandwidthToBurn = bandwidthCovered ? 0 : bandwidth;
  const bandwidthBurnSun = bandwidthToBurn * params.bandwidthFeeSun;

  const memoSun = input.memo ? params.memoFeeSun : 0;
  const activationSun = input.activatesAccount
    ? params.createNewAccountFeeInSystemContractSun + (bandwidthCovered ? 0 : params.createAccountFeeSun)
    : 0;

  const totalSun = energyBurnSun + bandwidthBurnSun + memoSun + activationSun;
  // What the same tx would cost with no resources at all — the "worst case" people see in wallets.
  const worstCaseSun = energy * params.energyFeeSun + bandwidth * params.bandwidthFeeSun + memoSun + activationSun;

  return {
    input: { energy, bandwidth, availableEnergy, availableBandwidth, memo: !!input.memo, activatesAccount: !!input.activatesAccount },
    params: {
      energyFeeSun: params.energyFeeSun,
      bandwidthFeeSun: params.bandwidthFeeSun,
      memoFeeSun: params.memoFeeSun,
      createNewAccountFeeInSystemContractSun: params.createNewAccountFeeInSystemContractSun,
      createAccountFeeSun: params.createAccountFeeSun,
    },
    energy: { required: energy, covered: energyCovered, burned: energyToBurn, cost: money(energyBurnSun) },
    bandwidth: { required: bandwidth, covered: bandwidthCovered, burned: bandwidthToBurn, cost: money(bandwidthBurnSun) },
    memo: money(memoSun),
    activation: money(activationSun),
    total: money(totalSun),
    worstCase: money(worstCaseSun),
  };
}

/**
 * USDT TRC-20 transfer estimate.
 * @param {{recipientHoldsUsdt?: boolean, availableEnergy?: number, availableBandwidth?: number, params?: object, energy?: number}} [options]
 */
export function estimateUsdtTransfer(options = {}) {
  const preset = options.recipientHoldsUsdt === false ? PRESETS.USDT_TRANSFER_NEW_HOLDER : PRESETS.USDT_TRANSFER;
  const result = estimateFee({
    energy: options.energy ?? preset.energy,
    bandwidth: options.bandwidth ?? preset.bandwidth,
    availableEnergy: options.availableEnergy,
    availableBandwidth: options.availableBandwidth,
    params: options.params,
  });
  return { preset: preset.key, label: preset.label, ...result };
}

/** Plain TRX transfer estimate (bandwidth only, plus activation for new accounts). */
export function estimateTrxTransfer(options = {}) {
  const result = estimateFee({
    energy: 0,
    bandwidth: options.bandwidth ?? PRESETS.TRX_TRANSFER.bandwidth,
    availableBandwidth: options.availableBandwidth,
    memo: options.memo,
    activatesAccount: options.recipientIsNew === true,
    params: options.params,
  });
  return { preset: PRESETS.TRX_TRANSFER.key, label: PRESETS.TRX_TRANSFER.label, ...result };
}

/**
 * How much TRX must be staked (Stake 2.0) to receive `energyPerDay` energy every day.
 * energyPerTrxPerDay = TotalEnergyLimit / TotalEnergyWeight.
 */
export function trxToStakeForEnergy(energyPerDay, params = {}) {
  const limit = params.totalEnergyLimit ?? DEFAULT_PARAMS.totalEnergyLimit;
  const weight = params.totalEnergyWeight;
  if (!weight) throw new Error('totalEnergyWeight is required (use fetchChainParams to load it)');
  const energyPerTrx = limit / weight;
  return {
    energyPerDay,
    energyPerTrxPerDay: energyPerTrx,
    trxToStake: Math.ceil(energyPerDay / energyPerTrx),
    totalEnergyLimit: limit,
    totalEnergyWeight: weight,
  };
}

/**
 * Compare burning TRX vs renting energy for N transfers per day.
 * @param {{transfersPerDay: number, energyPerTransfer?: number, rentPricePerTransferTrx: number, trxPriceUsd?: number, params?: object, days?: number}} options
 */
export function compareRentVsBurn(options) {
  const days = options.days ?? 30;
  const params = { ...DEFAULT_PARAMS, ...(options.params || {}) };
  const energy = options.energyPerTransfer ?? PRESETS.USDT_TRANSFER.energy;
  const burnPerTransferTrx = (energy * params.energyFeeSun) / 1_000_000;
  const rentPerTransferTrx = Number(options.rentPricePerTransferTrx);
  const perDayBurn = burnPerTransferTrx * options.transfersPerDay;
  const perDayRent = rentPerTransferTrx * options.transfersPerDay;
  const usd = (trx) => (options.trxPriceUsd ? Number((trx * options.trxPriceUsd).toFixed(2)) : null);
  const savedPerPeriod = (perDayBurn - perDayRent) * days;
  return {
    transfersPerDay: options.transfersPerDay,
    days,
    energyPerTransfer: energy,
    burn: { perTransferTrx: round(burnPerTransferTrx), perDayTrx: round(perDayBurn), perPeriodTrx: round(perDayBurn * days), perPeriodUsd: usd(perDayBurn * days) },
    rent: { perTransferTrx: round(rentPerTransferTrx), perDayTrx: round(perDayRent), perPeriodTrx: round(perDayRent * days), perPeriodUsd: usd(perDayRent * days) },
    saved: { perPeriodTrx: round(savedPerPeriod), perPeriodUsd: usd(savedPerPeriod), percent: burnPerTransferTrx ? Math.round(((burnPerTransferTrx - rentPerTransferTrx) / burnPerTransferTrx) * 100) : 0 },
  };
}

function round(n) {
  return Math.round(n * 1_000_000) / 1_000_000;
}

export default {
  DEFAULT_PARAMS,
  PRESETS,
  paramsFromChain,
  fetchChainParams,
  estimateFee,
  estimateUsdtTransfer,
  estimateTrxTransfer,
  trxToStakeForEnergy,
  compareRentVsBurn,
};
