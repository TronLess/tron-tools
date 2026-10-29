#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { checkEndpoints, formatReport, DEFAULT_ENDPOINTS } from '../src/index.js';

const HELP = `tron-rpc-health — latency, block height and lag of TRON RPC endpoints

Usage:
  tron-rpc-health [--network mainnet|nile|shasta] [--url URL ...] [--json]
  tron-rpc-health list

Options:
  --url <url>          check a custom endpoint (repeatable); add "jsonrpc" in the URL or use --jsonrpc
  --jsonrpc            treat --url endpoints as JSON-RPC
  --timeout <ms>       per-endpoint timeout (default 8000)
  --max-lag <blocks>   blocks behind consensus before an endpoint counts as unhealthy (default 20)
  --api-key <key>      TronGrid API key (or TRON_PRO_API_KEY)
  --json               machine-readable output
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    network: { type: 'string' },
    url: { type: 'string', multiple: true },
    jsonrpc: { type: 'boolean' },
    timeout: { type: 'string' },
    'max-lag': { type: 'string' },
    'api-key': { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help) {
  console.log(HELP);
  process.exit(0);
}
if (positionals[0] === 'list') {
  for (const e of DEFAULT_ENDPOINTS) console.log(`${e.network.padEnd(8)} ${e.kind.padEnd(8)} ${e.url}   (${e.name})`);
  process.exit(0);
}

const endpoints = values.url?.length
  ? values.url.map((url) => ({ url, kind: values.jsonrpc || /jsonrpc/i.test(url) ? 'jsonrpc' : 'http' }))
  : null;

const report = await checkEndpoints(endpoints, {
  network: endpoints ? undefined : values.network || 'mainnet',
  timeoutMs: values.timeout ? Number(values.timeout) : undefined,
  maxLagBlocks: values['max-lag'] ? Number(values['max-lag']) : undefined,
  apiKey: values['api-key'],
});

if (values.json) console.log(JSON.stringify(report, null, 2));
else console.log(formatReport(report));
process.exitCode = report.best ? 0 : 1;
