#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { toSun, fromSun, parseToken, formatToken, TOKENS, resolveToken } from '../src/index.js';

const HELP = `tron-units — convert SUN ⇄ TRX and raw ⇄ human TRC-20 amounts

Usage:
  tron-units <amount> --to-sun            TRX  → SUN      (1.5 → 1500000)
  tron-units <amount> --from-sun          SUN  → TRX      (1500000 → 1.5)
  tron-units <amount> --token USDT --raw  human → raw     (12.5 → 12500000)
  tron-units <amount> --token USDT        raw   → human   (12500000 → 12.5)
  tron-units <amount> --decimals 18       raw   → human with custom decimals
  tron-units tokens                       list known mainnet tokens

Options:
  --json     machine-readable output
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'to-sun': { type: 'boolean' },
    'from-sun': { type: 'boolean' },
    token: { type: 'string' },
    decimals: { type: 'string' },
    raw: { type: 'boolean' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || positionals.length === 0) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

if (positionals[0] === 'tokens') {
  if (values.json) console.log(JSON.stringify(TOKENS, null, 2));
  else for (const t of Object.values(TOKENS)) console.log(`${t.symbol.padEnd(6)} decimals=${String(t.decimals).padEnd(3)} ${t.address || '(native)'}`);
  process.exit(0);
}

const amount = positionals[0];
try {
  let result;
  if (values['to-sun']) result = { input: amount, sun: toSun(amount).toString(), unit: 'SUN' };
  else if (values['from-sun']) result = { input: amount, trx: fromSun(amount), unit: 'TRX' };
  else if (values.token || values.decimals) {
    const token = values.token ? resolveToken(values.token) : { decimals: Number(values.decimals), symbol: '' };
    if (values.raw) result = { input: amount, raw: parseToken(amount, token).toString(), decimals: token.decimals, symbol: token.symbol };
    else result = { input: amount, amount: formatToken(amount, token), decimals: token.decimals, symbol: token.symbol };
  } else {
    // Default: show both directions for TRX/SUN.
    result = { input: amount, asTrxToSun: toSun(amount).toString(), asSunToTrx: fromSun(amount) };
  }
  if (values.json) console.log(JSON.stringify(result, null, 2));
  else {
    const line = result.sun ?? result.trx ?? result.raw ?? result.amount;
    if (line !== undefined) console.log(`${line}${result.symbol ? ' ' + result.symbol : ''}`);
    else console.log(`${amount} TRX = ${result.asTrxToSun} SUN\n${amount} SUN = ${result.asSunToTrx} TRX`);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
}
