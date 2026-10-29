#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { TronClient, NETWORKS } from '../src/index.js';

const HELP = `tron-client — call any TRON full-node / TronGrid HTTP endpoint

Usage:
  tron-client <path> [--post '{"json":true}'] [--network mainnet|nile|shasta] [--node URL] [--api-key KEY]
  tron-client networks

Examples:
  tron-client /wallet/getnowblock
  tron-client /wallet/getchainparameters
  tron-client /wallet/getaccount --post '{"address":"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t","visible":true}'
  tron-client /v1/accounts/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t/transactions/trc20 --network mainnet

Environment:
  TRON_PRO_API_KEY   TronGrid API key (raises the 3 req/s anonymous limit)
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    post: { type: 'string' },
    network: { type: 'string' },
    node: { type: 'string' },
    'api-key': { type: 'string' },
    timeout: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help || positionals.length === 0) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

if (positionals[0] === 'networks') {
  console.log(JSON.stringify(NETWORKS, null, 2));
  process.exit(0);
}

const client = new TronClient({
  network: values.network || 'mainnet',
  fullNode: values.node,
  apiKey: values['api-key'],
  timeoutMs: values.timeout ? Number(values.timeout) : undefined,
});

try {
  const path = positionals[0];
  const result = values.post ? await client.post(path, JSON.parse(values.post)) : await client.get(path);
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
}
