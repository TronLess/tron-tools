#!/usr/bin/env node
import { parseArgs } from 'node:util';
import {
  estimateUsdtTransfer, estimateTrxTransfer, estimateFee, fetchChainParams, compareRentVsBurn,
  trxToStakeForEnergy, DEFAULT_PARAMS, PRESETS,
} from '../src/index.js';

const HELP = `tron-energy-calculator — what a TRON / USDT TRC-20 transfer costs in energy, bandwidth and TRX

Usage:
  tron-energy-calculator usdt [--new-recipient] [--available-energy N] [--available-bandwidth N]
  tron-energy-calculator trx  [--new-recipient] [--memo]
  tron-energy-calculator custom --energy N --bandwidth N [--memo] [--activate]
  tron-energy-calculator compare --per-day 100 --rent-price 2.3 [--trx-usd 0.30] [--days 30]
  tron-energy-calculator stake --energy-per-day 65000        (needs --live)
  tron-energy-calculator presets

Options:
  --live                fetch getchainparameters from the network instead of offline defaults
  --network <name>      mainnet (default) | nile | shasta
  --energy-fee <sun>    override energy price (SUN per unit), e.g. 420 for pre-2025 pricing
  --json                machine-readable output

Environment:
  TRON_PRO_API_KEY      TronGrid API key (optional)
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'new-recipient': { type: 'boolean' },
    'available-energy': { type: 'string' },
    'available-bandwidth': { type: 'string' },
    energy: { type: 'string' },
    bandwidth: { type: 'string' },
    memo: { type: 'boolean' },
    activate: { type: 'boolean' },
    'per-day': { type: 'string' },
    'rent-price': { type: 'string' },
    'trx-usd': { type: 'string' },
    days: { type: 'string' },
    'energy-per-day': { type: 'string' },
    'energy-fee': { type: 'string' },
    live: { type: 'boolean' },
    network: { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

const cmd = positionals[0] || 'usdt';
if (values.help || !['usdt', 'trx', 'custom', 'compare', 'stake', 'presets'].includes(cmd)) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

const num = (v) => (v === undefined ? undefined : Number(v));

try {
  let params = { ...DEFAULT_PARAMS };
  if (values.live || cmd === 'stake') params = await fetchChainParams({ network: values.network });
  if (values['energy-fee']) params.energyFeeSun = Number(values['energy-fee']);

  let result;
  if (cmd === 'presets') {
    result = PRESETS;
  } else if (cmd === 'usdt') {
    result = estimateUsdtTransfer({
      recipientHoldsUsdt: !values['new-recipient'],
      availableEnergy: num(values['available-energy']),
      availableBandwidth: num(values['available-bandwidth']),
      params,
    });
  } else if (cmd === 'trx') {
    result = estimateTrxTransfer({
      recipientIsNew: values['new-recipient'],
      memo: values.memo,
      availableBandwidth: num(values['available-bandwidth']),
      params,
    });
  } else if (cmd === 'custom') {
    result = estimateFee({
      energy: num(values.energy) || 0,
      bandwidth: num(values.bandwidth) || 0,
      availableEnergy: num(values['available-energy']),
      availableBandwidth: num(values['available-bandwidth']),
      memo: values.memo,
      activatesAccount: values.activate,
      params,
    });
  } else if (cmd === 'compare') {
    if (!values['per-day'] || !values['rent-price']) throw new Error('compare needs --per-day and --rent-price');
    result = compareRentVsBurn({
      transfersPerDay: Number(values['per-day']),
      rentPricePerTransferTrx: Number(values['rent-price']),
      trxPriceUsd: num(values['trx-usd']),
      days: num(values.days),
      energyPerTransfer: num(values.energy),
      params,
    });
  } else if (cmd === 'stake') {
    result = trxToStakeForEnergy(num(values['energy-per-day']) || PRESETS.USDT_TRANSFER.energy, params);
  }

  if (values.json) {
    console.log(JSON.stringify({ ...result, chainParams: values.live ? params : undefined }, null, 2));
  } else if (cmd === 'presets') {
    for (const p of Object.values(PRESETS)) console.log(`${p.key.padEnd(32)} energy=${String(p.energy).padEnd(8)} bandwidth=${p.bandwidth}  ${p.label}`);
  } else if (cmd === 'compare') {
    console.log(`Transfers/day: ${result.transfersPerDay}, period: ${result.days} days, energy/transfer: ${result.energyPerTransfer}`);
    console.log(`Burn TRX:     ${result.burn.perTransferTrx} TRX per transfer → ${result.burn.perPeriodTrx} TRX per period${result.burn.perPeriodUsd != null ? ` (~$${result.burn.perPeriodUsd})` : ''}`);
    console.log(`Rent energy:  ${result.rent.perTransferTrx} TRX per transfer → ${result.rent.perPeriodTrx} TRX per period${result.rent.perPeriodUsd != null ? ` (~$${result.rent.perPeriodUsd})` : ''}`);
    console.log(`Saved:        ${result.saved.perPeriodTrx} TRX (${result.saved.percent}%)${result.saved.perPeriodUsd != null ? ` ≈ $${result.saved.perPeriodUsd}` : ''}`);
  } else if (cmd === 'stake') {
    console.log(`To get ${result.energyPerDay} energy per day you need to stake ≈ ${result.trxToStake.toLocaleString()} TRX`);
    console.log(`(${result.energyPerTrxPerDay.toFixed(4)} energy per staked TRX per day; TotalEnergyLimit=${result.totalEnergyLimit}, TotalEnergyWeight=${result.totalEnergyWeight})`);
  } else {
    if (result.label) console.log(result.label);
    console.log(`Energy:     ${result.energy.required} needed, ${result.energy.covered} covered, ${result.energy.burned} burned → ${result.energy.cost.trx} TRX`);
    console.log(`Bandwidth:  ${result.bandwidth.required} bytes, ${result.bandwidth.covered ? 'covered' : 'NOT covered'} → ${result.bandwidth.cost.trx} TRX`);
    if (result.memo.sun) console.log(`Memo:       ${result.memo.trx} TRX`);
    if (result.activation.sun) console.log(`Activation: ${result.activation.trx} TRX`);
    console.log(`TOTAL:      ${result.total.trx} TRX   (worst case with zero resources: ${result.worstCase.trx} TRX)`);
    console.log(`Prices:     energy ${result.params.energyFeeSun} SUN/unit, bandwidth ${result.params.bandwidthFeeSun} SUN/byte${values.live ? ' (live)' : ' (offline defaults, use --live to refresh)'}`);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
}
