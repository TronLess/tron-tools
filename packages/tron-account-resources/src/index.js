/**
 * @tronless/tron-account-resources
 * Normalize `getaccountresource` + `getaccount` into one readable resource report.
 */
import { TronClient } from '@tronless/tron-client';
import { toBase58, isValidAddress } from '@tronless/tron-address';
import { fromSun } from '@tronless/tron-units';

/** Planning figures used for the "how many transfers does this cover" hints. */
export const USAGE_HINTS = Object.freeze({
  usdtTransferEnergy: 65_000,
  usdtTransferBandwidth: 345,
  trxTransferBandwidth: 268,
});

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Pure normalizer — feed it raw node responses (useful for tests and cached data).
 * @param {object} resource response of wallet/getaccountresource
 * @param {object} [account] response of wallet/getaccount
 * @param {{address?: string, network?: string, hints?: typeof USAGE_HINTS}} [meta]
 */
export function normalizeResources(resource = {}, account = {}, meta = {}) {
  const hints = { ...USAGE_HINTS, ...(meta.hints || {}) };
  const freeLimit = n(resource.freeNetLimit);
  const freeUsed = n(resource.freeNetUsed);
  const stakedLimit = n(resource.NetLimit);
  const stakedUsed = n(resource.NetUsed);
  const energyLimit = n(resource.EnergyLimit);
  const energyUsed = n(resource.EnergyUsed);

  const bandwidthAvailable = Math.max(0, freeLimit - freeUsed) + Math.max(0, stakedLimit - stakedUsed);
  const energyAvailable = Math.max(0, energyLimit - energyUsed);

  // Stake 2.0: frozenV2 entries; the one without `type` is BANDWIDTH.
  const frozen = Array.isArray(account.frozenV2) ? account.frozenV2 : [];
  const stakedForEnergySun = frozen.filter((f) => f.type === 'ENERGY').reduce((s, f) => s + n(f.amount), 0);
  const stakedForBandwidthSun = frozen.filter((f) => !f.type || f.type === 'BANDWIDTH').reduce((s, f) => s + n(f.amount), 0);
  const stakedForTronPowerSun = frozen.filter((f) => f.type === 'TRON_POWER').reduce((s, f) => s + n(f.amount), 0);

  const ar = account.account_resource || {};
  const delegatedOutEnergySun = n(ar.delegated_frozenV2_balance_for_energy);
  const delegatedInEnergySun = n(ar.acquired_delegated_frozenV2_balance_for_energy);
  const delegatedOutBandwidthSun = n(account.delegated_frozenV2_balance_for_bandwidth);
  const delegatedInBandwidthSun = n(account.acquired_delegated_frozenV2_balance_for_bandwidth);

  const unfreezing = (Array.isArray(account.unfrozenV2) ? account.unfrozenV2 : []).map((u) => ({
    resource: u.type || 'BANDWIDTH',
    amountSun: n(u.unfreeze_amount),
    amountTrx: fromSun(n(u.unfreeze_amount)),
    expiresAt: u.unfreeze_expire_time ? new Date(n(u.unfreeze_expire_time)).toISOString() : null,
    withdrawable: u.unfreeze_expire_time ? n(u.unfreeze_expire_time) <= Date.now() : false,
  }));

  const totalEnergyLimit = n(resource.TotalEnergyLimit);
  const totalEnergyWeight = n(resource.TotalEnergyWeight);
  const totalNetLimit = n(resource.TotalNetLimit);
  const totalNetWeight = n(resource.TotalNetWeight);

  return {
    address: meta.address || (account.address ? safeBase58(account.address) : null),
    network: meta.network || null,
    activated: !!(account.address || account.create_time),
    balanceSun: n(account.balance),
    balanceTrx: fromSun(n(account.balance)),
    bandwidth: {
      free: { limit: freeLimit, used: freeUsed, available: Math.max(0, freeLimit - freeUsed) },
      staked: { limit: stakedLimit, used: stakedUsed, available: Math.max(0, stakedLimit - stakedUsed) },
      available: bandwidthAvailable,
    },
    energy: {
      limit: energyLimit,
      used: energyUsed,
      available: energyAvailable,
    },
    staking: {
      forEnergyTrx: fromSun(stakedForEnergySun),
      forBandwidthTrx: fromSun(stakedForBandwidthSun),
      forTronPowerTrx: fromSun(stakedForTronPowerSun),
      delegatedOut: { energyTrx: fromSun(delegatedOutEnergySun), bandwidthTrx: fromSun(delegatedOutBandwidthSun) },
      delegatedIn: { energyTrx: fromSun(delegatedInEnergySun), bandwidthTrx: fromSun(delegatedInBandwidthSun) },
      unfreezing,
      tronPower: { limit: n(resource.tronPowerLimit), used: n(resource.tronPowerUsed) },
    },
    network_totals: {
      totalEnergyLimit,
      totalEnergyWeight,
      energyPerStakedTrxPerDay: totalEnergyWeight ? totalEnergyLimit / totalEnergyWeight : null,
      totalNetLimit,
      totalNetWeight,
      bandwidthPerStakedTrxPerDay: totalNetWeight ? totalNetLimit / totalNetWeight : null,
    },
    covers: {
      usdtTransfersByEnergy: Math.floor(energyAvailable / hints.usdtTransferEnergy),
      usdtTransfersByBandwidth: Math.floor(bandwidthAvailable / hints.usdtTransferBandwidth),
      trxTransfersByBandwidth: Math.floor(bandwidthAvailable / hints.trxTransferBandwidth),
    },
  };
}

function safeBase58(addr) {
  try {
    return toBase58(addr);
  } catch {
    return addr;
  }
}

/**
 * Fetch and normalize resources for an address.
 * @param {string} address any TRON address form
 * @param {{client?: TronClient, network?: string, includeAccount?: boolean}} [options]
 */
export async function getAccountResources(address, options = {}) {
  if (!isValidAddress(address)) throw new Error(`Invalid TRON address: ${address}`);
  const client = options.client || new TronClient({ network: options.network || 'mainnet' });
  const base58 = toBase58(address);
  const [resource, account] = await Promise.all([
    client.getAccountResource(base58),
    options.includeAccount === false ? {} : client.getAccount(base58),
  ]);
  const out = normalizeResources(resource, account, { address: base58, network: client.network, hints: options.hints });
  out.explorer = client.explorerAddress(base58);
  return out;
}

/** True when the address can pay for `energy` + `bandwidth` from its own resources without burning TRX. */
export function canCover(report, { energy = 0, bandwidth = 0 } = {}) {
  return report.energy.available >= energy && report.bandwidth.available >= bandwidth;
}

export default { USAGE_HINTS, normalizeResources, getAccountResources, canCover };
