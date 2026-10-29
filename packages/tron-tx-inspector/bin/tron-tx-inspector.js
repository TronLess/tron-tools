#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { inspectTransaction, formatReceipt } from '../src/index.js';
import { clientFromFlags } from '@tronless/tron-client';

const HELP = `tron-tx-inspector — status, decoded data and fee breakdown for a TRON transaction

Usage:
  tron-tx-inspector <txid> [<txid> ...] [--network mainnet|nile|shasta] [--json] [--raw]

Options:
  --node <url>      custom full node
  --api-key <key>   TronGrid API key (or TRON_PRO_API_KEY)
  --json            machine-readable output (raw node responses omitted unless --raw)
  --raw             include raw node responses in JSON output

Exit code is 1 if any transaction failed or was not found.
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: 'boolean' },
    raw: { type: 'boolean' },
    network: { type: 'string' },
    node: { type: 'string' },
    'api-key': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || positionals.length === 0) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

const client = clientFromFlags(values);
let failed = false;
const results = [];
for (const txid of positionals) {
  try {
    const r = await inspectTransaction(txid, { client });
    if (r.status !== 'SUCCESS') failed = true;
    if (!values.raw) delete r.raw;
    results.push(r);
    if (!values.json) console.log(formatReceipt(r) + '\n');
  } catch (err) {
    failed = true;
    results.push({ txid, error: err.message });
    if (!values.json) console.error(`${txid}\n  Error: ${err.message}\n`);
  }
}
if (values.json) console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
process.exitCode = failed ? 1 : 0;
