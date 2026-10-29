#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { getTokenInfo, getBalance, getAllowance, getBalances, callConstant } from '../src/index.js';
import { clientFromFlags } from '@tronless/tron-client';

const HELP = `trc20-token — read TRC-20 tokens (no key needed)

Usage:
  trc20-token info <contract|USDT>
  trc20-token balance <contract|USDT> <holder>
  trc20-token balances <holder> --tokens USDT,USDC,TXYZ...
  trc20-token allowance <contract|USDT> <owner> <spender>
  trc20-token call <contract> "method(type,...)" [--args a,b] [--outputs uint256,string]

Options:
  --network mainnet|nile|shasta    (default mainnet)
  --node <url>                     custom full node
  --api-key <key>                  TronGrid API key (or TRON_PRO_API_KEY)
  --json                           machine-readable output
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    tokens: { type: 'string' },
    args: { type: 'string' },
    outputs: { type: 'string' },
    json: { type: 'boolean' },
    network: { type: 'string' },
    node: { type: 'string' },
    'api-key': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

const [cmd, a, b, c] = positionals;
if (values.help || !cmd) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

const client = clientFromFlags(values);
const out = (obj) => console.log(JSON.stringify(obj, null, 2));

try {
  if (cmd === 'info') {
    const r = await getTokenInfo(a, { client });
    if (values.json) out(r);
    else console.log(`${r.name} (${r.symbol})\naddress:  ${r.address}\ndecimals: ${r.decimals}\nsupply:   ${r.totalSupply ?? 'n/a'}\nexplorer: ${r.explorer}`);
  } else if (cmd === 'balance') {
    if (!b) throw new Error('balance needs <token> <holder>');
    const r = await getBalance(a, b, { client });
    if (values.json) out(r);
    else console.log(`${r.balance} (raw ${r.raw}, decimals ${r.decimals}) — ${r.holder} @ ${r.contract}`);
  } else if (cmd === 'balances') {
    const tokens = (values.tokens || 'USDT').split(',').map((s) => s.trim()).filter(Boolean);
    const r = await getBalances(tokens, a, { client });
    if (values.json) out(r);
    else for (const x of r) console.log(x.error ? `${x.contract}: ERROR ${x.error}` : `${x.contract}: ${x.balance}`);
  } else if (cmd === 'allowance') {
    if (!c) throw new Error('allowance needs <token> <owner> <spender>');
    const r = await getAllowance(a, b, c, { client });
    if (values.json) out(r);
    else console.log(`${r.allowance} (raw ${r.raw})`);
  } else if (cmd === 'call') {
    if (!b) throw new Error('call needs <contract> "method(types)"');
    const types = /\((.*)\)/.exec(b)?.[1]?.split(',').map((s) => s.trim()).filter(Boolean) || [];
    const args = values.args ? values.args.split(',').map((s) => s.trim()) : [];
    const outputs = values.outputs ? values.outputs.split(',').map((s) => s.trim()) : [];
    const r = await callConstant({ client, contract: a, method: b, types, values: args, outputs });
    out(r);
  } else {
    console.log(HELP);
    process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
}
