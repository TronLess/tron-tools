import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateFee, estimateUsdtTransfer, estimateTrxTransfer, paramsFromChain, fetchChainParams,
  compareRentVsBurn, trxToStakeForEnergy, DEFAULT_PARAMS, PRESETS,
} from '../src/index.js';

test('defaults match mainnet parameters (2026-09)', () => {
  assert.equal(DEFAULT_PARAMS.energyFeeSun, 100);
  assert.equal(DEFAULT_PARAMS.bandwidthFeeSun, 1000);
  assert.equal(DEFAULT_PARAMS.memoFeeSun, 1_000_000);
  assert.equal(PRESETS.USDT_TRANSFER.energy, 64_285);
});

test('USDT transfer with no energy burns 6.4285 TRX (matches a real receipt)', () => {
  // Real mainnet receipt: energy_usage_total 64285, net_usage 345, fee 6428500 SUN
  const r = estimateUsdtTransfer();
  assert.equal(r.energy.burned, 64_285);
  assert.equal(r.energy.cost.sun, 6_428_500);
  assert.equal(r.total.trx, '6.4285');
  assert.equal(r.bandwidth.covered, true, '345 bytes fit in 600 free bandwidth');
  assert.equal(r.bandwidth.cost.sun, 0);
});

test('USDT transfer to a new holder costs roughly double', () => {
  const r = estimateUsdtTransfer({ recipientHoldsUsdt: false });
  assert.equal(r.preset, 'USDT_TRANSFER_NEW_HOLDER');
  assert.equal(r.energy.required, 130_285);
  assert.equal(r.total.trx, '13.0285');
});

test('available energy covers part of the cost', () => {
  const r = estimateUsdtTransfer({ availableEnergy: 60_000 });
  assert.equal(r.energy.covered, 60_000);
  assert.equal(r.energy.burned, 4_285);
  assert.equal(r.total.sun, 428_500);
  const full = estimateUsdtTransfer({ availableEnergy: 100_000 });
  assert.equal(full.total.sun, 0);
});

test('bandwidth is all-or-nothing', () => {
  const r = estimateUsdtTransfer({ availableBandwidth: 100 });
  assert.equal(r.bandwidth.covered, false);
  assert.equal(r.bandwidth.burned, 345);
  assert.equal(r.bandwidth.cost.sun, 345_000);
  assert.equal(r.total.sun, 6_428_500 + 345_000);
});

test('TRX transfer: free with bandwidth, activation for new account, memo fee', () => {
  assert.equal(estimateTrxTransfer().total.sun, 0);
  const n = estimateTrxTransfer({ recipientIsNew: true });
  assert.equal(n.activation.sun, 1_000_000);
  assert.equal(n.total.trx, '1');
  const nb = estimateTrxTransfer({ recipientIsNew: true, availableBandwidth: 0 });
  assert.equal(nb.activation.sun, 1_100_000);
  assert.equal(nb.bandwidth.cost.sun, 268_000);
  assert.equal(nb.total.sun, 1_368_000);
  assert.equal(estimateTrxTransfer({ memo: true }).total.trx, '1');
});

test('custom estimate with old 420 SUN price', () => {
  const r = estimateFee({ energy: 65_000, bandwidth: 345, params: { energyFeeSun: 420 } });
  assert.equal(r.total.trx, '27.3');
  assert.equal(r.worstCase.sun, 65_000 * 420 + 345_000);
});

test('paramsFromChain reads getchainparameters response', () => {
  const p = paramsFromChain({
    chainParameter: [
      { key: 'getEnergyFee', value: 420 },
      { key: 'getTransactionFee', value: 1000 },
      { key: 'getMemoFee', value: 1000000 },
      { key: 'getFreeNetLimit', value: 600 },
      { key: 'getSomethingElse' },
    ],
  });
  assert.equal(p.energyFeeSun, 420);
  assert.equal(p.memoFeeSun, 1_000_000);
  assert.equal(p.createAccountFeeSun, DEFAULT_PARAMS.createAccountFeeSun);
  assert.equal(paramsFromChain({ getEnergyFee: 210 }).energyFeeSun, 210);
});

test('fetchChainParams with mocked client', async () => {
  const client = {
    network: 'mainnet',
    getChainParameters: async () => ({ chainParameter: [{ key: 'getEnergyFee', value: 100 }] }),
    getAccountResource: async () => ({ TotalEnergyWeight: 25_000_000_000, TotalEnergyLimit: 180_000_000_000 }),
  };
  const p = await fetchChainParams({ client });
  assert.equal(p.energyFeeSun, 100);
  assert.equal(p.totalEnergyWeight, 25_000_000_000);
  const stake = trxToStakeForEnergy(65_000, p);
  assert.equal(stake.energyPerTrxPerDay, 7.2);
  assert.equal(stake.trxToStake, Math.ceil(65_000 / 7.2));
  assert.throws(() => trxToStakeForEnergy(1000, {}));
});

test('compareRentVsBurn', () => {
  const c = compareRentVsBurn({ transfersPerDay: 10, rentPricePerTransferTrx: 2.3, trxPriceUsd: 0.3, days: 30 });
  assert.equal(c.burn.perTransferTrx, 6.4285);
  assert.equal(c.burn.perPeriodTrx, 1928.55);
  assert.equal(c.rent.perPeriodTrx, 690);
  assert.equal(c.saved.perPeriodTrx, 1238.55);
  assert.equal(c.saved.percent, 64);
  assert.ok(Math.abs(c.saved.perPeriodUsd - 371.565) < 0.01);
});

test('live: chain params from mainnet', { skip: !process.env.TRON_LIVE }, async () => {
  const p = await fetchChainParams();
  assert.ok(p.energyFeeSun > 0);
  assert.ok(p.totalEnergyWeight > 0);
});
