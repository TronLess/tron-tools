#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { getAccountResources } from '../src/index.js';
import { clientFromFlags } from '@tronless/tron-client';

const HELP = `tron-account-resources — energy, bandwidth and staking of any TRON address

Usage:
  tron-account-resources <address> [--network mainnet|nile|shasta] [--json]

Options:
  --node <url>      custom full node
  --api-key <key>   TronGrid API key (or TRON_PRO_API_KEY)
  --json            machine-readable output
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: 'boolean' },
    network: { type: 'string' },
    node: { type: 'string' },
    'api-key': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || !positionals[0]) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

try {
  const r = await getAccountResources(positionals[0], { client: clientFromFlags(values) });
  if (values.json) {
    console.log(JSON.stringify(r, null, 2));
  } else {
  console.log(`${r.address} (${r.network})${r.activated ? '' : '  — NOT ACTIVATED'}`);
  console.log(`Balance:    ${r.balanceTrx} TRX`);
  console.log(`Energy:     ${r.energy.available.toLocaleString()} available of ${r.energy.limit.toLocaleString()} (used ${r.energy.used.toLocaleString()})`);
  console.log(`Bandwidth:  ${r.bandwidth.available.toLocaleString()} available (free ${r.bandwidth.free.available}/${r.bandwidth.free.limit}, staked ${r.bandwidth.staked.available}/${r.bandwidth.staked.limit})`);
  console.log(`Staked:     ${r.staking.forEnergyTrx} TRX for energy, ${r.staking.forBandwidthTrx} TRX for bandwidth`);
  console.log(`Delegated:  in ${r.staking.delegatedIn.energyTrx} TRX (energy) / out ${r.staking.delegatedOut.energyTrx} TRX (energy)`);
  if (r.staking.unfreezing.length) {
    for (const u of r.staking.unfreezing) console.log(`Unstaking:  ${u.amountTrx} TRX (${u.resource}) ${u.withdrawable ? 'withdrawable now' : `until ${u.expiresAt}`}`);
  }
  console.log(`Covers:     ~${r.covers.usdtTransfersByEnergy} USDT transfers by energy, ~${r.covers.usdtTransfersByBandwidth} by bandwidth`);
  if (r.network_totals.energyPerStakedTrxPerDay) console.log(`Network:    ${r.network_totals.energyPerStakedTrxPerDay.toFixed(3)} energy per staked TRX per day`);
  if (r.explorer) console.log(`Explorer:   ${r.explorer}`);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
}
