#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { AddressWatcher, fetchTrc20Transfers, fetchTrxTransfers } from '../src/index.js';
import { clientFromFlags } from '@tronless/tron-client';

const HELP = `tron-address-watcher — watch TRON addresses for USDT TRC-20 / TRX transfers

Usage:
  tron-address-watcher <address> [<address> ...] [options]        run until Ctrl+C
  tron-address-watcher <address> --history [--since <ms|ISO>]     print past transfers and exit

Options:
  --network mainnet|nile|shasta   (default mainnet)
  --interval <sec>                poll interval (default 10)
  --only USDT,USDC,T...           only these TRC-20 tokens (symbol or contract)
  --in | --out                    only incoming / only outgoing
  --no-trx                        ignore plain TRX transfers
  --no-trc20                      ignore TRC-20 transfers
  --since <ms|ISO>                start from this time (default: now)
  --unconfirmed                   include unconfirmed transfers
  --webhook <url>                 POST every transfer as JSON to this URL
  --header "Name: value"          extra webhook header (repeatable)
  --json                          one JSON object per line
  --api-key <key>                 TronGrid API key (or TRON_PRO_API_KEY) — recommended
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    network: { type: 'string' },
    node: { type: 'string' },
    'api-key': { type: 'string' },
    interval: { type: 'string' },
    only: { type: 'string' },
    in: { type: 'boolean' },
    out: { type: 'boolean' },
    'no-trx': { type: 'boolean' },
    'no-trc20': { type: 'boolean' },
    since: { type: 'string' },
    unconfirmed: { type: 'boolean' },
    webhook: { type: 'string' },
    header: { type: 'string', multiple: true },
    history: { type: 'boolean' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || positionals.length === 0) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

const parseSince = (s) => (s === undefined ? undefined : /^\d+$/.test(s) ? Number(s) : Date.parse(s));
const client = clientFromFlags(values);
const contracts = values.only ? values.only.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
const headers = Object.fromEntries((values.header || []).map((h) => h.split(/:\s*/, 2)));
const direction = values.in ? 'in' : values.out ? 'out' : 'both';

const line = (t) => {
  if (values.json) return JSON.stringify(t);
  const arrow = t.direction === 'in' ? '⬇ IN ' : '⬆ OUT';
  return `${t.time} ${arrow} ${t.amount} ${t.token.symbol || t.token.address} ${t.direction === 'in' ? `from ${t.from}` : `to ${t.to}`}  tx ${t.txid}`;
};

try {
  if (values.history) {
    const since = parseSince(values.since) ?? Date.now() - 24 * 3600 * 1000;
    for (const address of positionals) {
      const opts = { client, since, onlyConfirmed: !values.unconfirmed };
      let all = [];
      if (!values['no-trc20']) all = all.concat(await fetchTrc20Transfers(address, { ...opts, contracts }));
      if (!values['no-trx']) all = all.concat(await fetchTrxTransfers(address, opts));
      all.sort((a, b) => a.timestamp - b.timestamp);
      for (const t of all) if (direction === 'both' || t.direction === direction) console.log(line(t));
    }
  } else {
    const watcher = new AddressWatcher({
    addresses: positionals,
    client,
    pollIntervalMs: values.interval ? Number(values.interval) * 1000 : undefined,
    contracts,
    trc20: !values['no-trc20'],
    trx: !values['no-trx'],
    direction,
    since: parseSince(values.since),
    onlyConfirmed: !values.unconfirmed,
    webhookUrl: values.webhook,
    webhookHeaders: headers,
  });
    watcher.on('transfer', (t) => console.log(line(t)));
    watcher.on('error', (e) => console.error(`[watcher] ${e.message}`));
    watcher.on('webhook', (w) => { if (!w.ok) console.error(`[webhook] delivery failed (${w.status}) ${w.error || ''}`); });
    if (!values.json) console.error(`Watching ${positionals.length} address(es) on ${client.network} every ${watcher.pollIntervalMs / 1000}s… (Ctrl+C to stop)`);
    watcher.start();
    process.on('SIGINT', () => { watcher.stop(); process.exitCode = 0; });
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
}
