import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResources, getAccountResources, canCover } from '../src/index.js';

const RESOURCE = {
  freeNetLimit: 600,
  freeNetUsed: 100,
  NetLimit: 2000,
  NetUsed: 500,
  EnergyLimit: 200_000,
  EnergyUsed: 50_000,
  TotalEnergyLimit: 180_000_000_000,
  TotalEnergyWeight: 25_000_000_000,
  TotalNetLimit: 43_200_000_000,
  TotalNetWeight: 10_000_000_000,
  tronPowerLimit: 10,
  tronPowerUsed: 3,
};
const ACCOUNT = {
  address: '41a614f803b6fd780986a42c78ec9c7f77e6ded13c',
  balance: 12_345_678,
  create_time: 1,
  frozenV2: [{ amount: 5_000_000 }, { type: 'ENERGY', amount: 10_000_000 }, { type: 'TRON_POWER' }],
  unfrozenV2: [{ type: 'ENERGY', unfreeze_amount: 1_000_000, unfreeze_expire_time: 1 }, { unfreeze_amount: 2_000_000, unfreeze_expire_time: 4102444800000 }],
  account_resource: { delegated_frozenV2_balance_for_energy: 3_000_000, acquired_delegated_frozenV2_balance_for_energy: 7_000_000 },
  delegated_frozenV2_balance_for_bandwidth: 1_000_000,
};

test('normalizeResources', () => {
  const r = normalizeResources(RESOURCE, ACCOUNT, { network: 'mainnet' });
  assert.equal(r.address, 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
  assert.equal(r.activated, true);
  assert.equal(r.balanceTrx, '12.345678');
  assert.equal(r.bandwidth.available, 500 + 1500);
  assert.equal(r.energy.available, 150_000);
  assert.equal(r.staking.forEnergyTrx, '10');
  assert.equal(r.staking.forBandwidthTrx, '5');
  assert.equal(r.staking.delegatedOut.energyTrx, '3');
  assert.equal(r.staking.delegatedIn.energyTrx, '7');
  assert.equal(r.staking.delegatedOut.bandwidthTrx, '1');
  assert.equal(r.staking.unfreezing.length, 2);
  assert.equal(r.staking.unfreezing[0].withdrawable, true);
  assert.equal(r.staking.unfreezing[1].withdrawable, false);
  assert.equal(r.staking.unfreezing[1].resource, 'BANDWIDTH');
  assert.equal(r.network_totals.energyPerStakedTrxPerDay, 7.2);
  assert.equal(r.covers.usdtTransfersByEnergy, 2);
  assert.equal(r.covers.usdtTransfersByBandwidth, 5);
  assert.equal(r.covers.trxTransfersByBandwidth, 7);
  assert.equal(canCover(r, { energy: 65_000, bandwidth: 345 }), true);
  assert.equal(canCover(r, { energy: 200_000 }), false);
});

test('empty / unactivated account', () => {
  const r = normalizeResources({ freeNetLimit: 600 }, {});
  assert.equal(r.activated, false);
  assert.equal(r.bandwidth.available, 600);
  assert.equal(r.energy.available, 0);
  assert.equal(r.covers.usdtTransfersByEnergy, 0);
  assert.equal(r.network_totals.energyPerStakedTrxPerDay, null);
});

test('getAccountResources with mocked client', async () => {
  const calls = [];
  const client = {
    network: 'nile',
    getAccountResource: async (a) => (calls.push(a), RESOURCE),
    getAccount: async () => ACCOUNT,
    explorerAddress: (a) => `https://nile.tronscan.org/#/address/${a}`,
  };
  const r = await getAccountResources('41a614f803b6fd780986a42c78ec9c7f77e6ded13c', { client });
  assert.equal(calls[0], 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
  assert.equal(r.network, 'nile');
  assert.match(r.explorer, /nile\.tronscan/);
  await assert.rejects(() => getAccountResources('nope', { client }), /Invalid TRON address/);
});

test('live: USDT contract account on mainnet', { skip: !process.env.TRON_LIVE }, async () => {
  const r = await getAccountResources('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
  assert.equal(r.activated, true);
  assert.ok(r.network_totals.totalEnergyWeight > 0);
});
