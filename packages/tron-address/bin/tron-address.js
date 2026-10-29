#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { normalize, isValidAddress, fromPublicKey, explorerUrl } from '../src/index.js';

const HELP = `tron-address — validate and convert TRON addresses (Base58 ⇄ hex ⇄ 0x)

Usage:
  tron-address <address> [<address> ...] [--json] [--to base58|hex|evm]
  tron-address --public-key <hex>
  echo "T..." | tron-address --stdin

Options:
  --to <format>       print only one form: base58, hex or evm
  --json              machine-readable output
  --public-key <hex>  derive address from a secp256k1 public key (33/64/65 bytes)
  --stdin             read addresses (one per line) from stdin
  --network <name>    explorer link network: mainnet (default), nile, shasta
  -h, --help          show this help

Exit code is 1 if any address is invalid.
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    to: { type: 'string' },
    json: { type: 'boolean' },
    'public-key': { type: 'string' },
    stdin: { type: 'boolean' },
    network: { type: 'string', default: 'mainnet' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help) {
  console.log(HELP);
  process.exit(0);
}

const inputs = [...positionals];
if (values.stdin) {
  const text = await new Promise((resolve) => {
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => (s += d));
    process.stdin.on('end', () => resolve(s));
  });
  inputs.push(...text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
}

if (values['public-key']) {
  try {
    const r = fromPublicKey(values['public-key']);
    if (values.json) console.log(JSON.stringify(r, null, 2));
    else console.log(`base58: ${r.base58}\nhex:    ${r.hex}\nevm:    ${r.evm}`);
    process.exit(0);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

if (inputs.length === 0) {
  console.log(HELP);
  process.exit(1);
}

let failed = false;
const results = [];
for (const input of inputs) {
  const valid = isValidAddress(input);
  if (!valid) {
    failed = true;
    results.push({ input, valid: false });
    continue;
  }
  const n = normalize(input);
  results.push({
    input,
    valid: true,
    format: n.format,
    base58: n.base58,
    hex: n.hex,
    evm: n.evm,
    explorer: explorerUrl(n.base58, values.network),
  });
}

if (values.json) {
  console.log(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
} else {
  for (const r of results) {
    if (!r.valid) {
      console.log(`${r.input}\n  INVALID TRON address`);
      continue;
    }
    if (values.to) {
      const key = values.to === 'base58' ? 'base58' : values.to === 'hex' ? 'hex' : 'evm';
      console.log(r[key]);
      continue;
    }
    console.log(`${r.input}\n  valid:    yes (${r.format})\n  base58:   ${r.base58}\n  hex:      ${r.hex}\n  evm:      ${r.evm}\n  explorer: ${r.explorer}`);
  }
}
process.exit(failed ? 1 : 0);
