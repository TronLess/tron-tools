# TRON HTTP client for Node.js (TronGrid / full node) — `@tronless/tron-client`

[![npm](https://img.shields.io/npm/v/@tronless/tron-client)](https://www.npmjs.com/package/@tronless/tron-client) [![CI](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml/badge.svg)](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml) ![node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue)

A 200-line, zero-dependency HTTP client for the TRON full-node API and TronGrid. It knows the mainnet, Nile and Shasta endpoints, sends your `TRON-PRO-API-KEY`, times out, and retries automatically when TronGrid answers *"request rate exceeded the allowed_rps(3), and the query server is suspended for 5 s"*. Use it when `tronweb` is too heavy for a backend job that only needs a handful of `/wallet/*` or `/v1/*` calls.

**Part of [TronLess Tools](../../README.md)** — free, MIT-licensed TRON developer tools by [TronLess](https://tronless.app), the TRON energy rental service.

## Why

- **Zero dependencies.** Built on the global `fetch` of Node.js 18+. Nothing to audit, nothing to bundle.
- **Rate-limit aware.** Anonymous TronGrid allows about 3 requests per second and then suspends you for 5 seconds. The client reads that message and waits exactly as long as needed before retrying.
- **Network presets.** `mainnet`, `nile`, `shasta` with the right full node, explorer and USDT test-token addresses. Or point it at your own node.
- **Testable.** Inject `fetch` and the whole call is deterministic — every TronLess tool is unit-tested this way.

## Install

```bash
npm i @tronless/tron-client
```

Requires Node.js 18.17 or newer.

## Quick start (CLI)

```bash
# current block on mainnet
npx @tronless/tron-client /wallet/getnowblock

# chain parameters (energy price, bandwidth price, …)
npx @tronless/tron-client /wallet/getchainparameters

# any POST endpoint
npx @tronless/tron-client /wallet/getaccount --post '{"address":"TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t","visible":true}'

# TronGrid v1 extension API on Nile
npx @tronless/tron-client /v1/accounts/TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf/transactions/trc20 --network nile

# list presets
npx @tronless/tron-client networks
```

Set `TRON_PRO_API_KEY` in the environment (or pass `--api-key`) to lift the anonymous limit.

## Usage (JavaScript)

```js
import { TronClient } from '@tronless/tron-client';

const client = new TronClient({ network: 'mainnet', apiKey: process.env.TRON_PRO_API_KEY });

const block = await client.getNowBlock();
console.log(block.block_header.raw_data.number);

const params = await client.getChainParametersMap();
console.log(params.getEnergyFee); // 100 (SUN per energy unit, Sept 2026)

const account = await client.getAccount('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
const resource = await client.getAccountResource('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');

// read-only contract call, no key needed
const res = await client.triggerConstantContract({
  contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  functionSelector: 'decimals()',
});
console.log(res.constant_result[0]); // 0000…0006

// TronGrid v1
const txs = await client.v1('accounts/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t/transactions/trc20', { limit: 5, only_confirmed: true });
```

Custom node:

```js
const local = new TronClient({ fullNode: 'http://127.0.0.1:8090', network: 'custom' });
```

## API

| Member | Description |
|---|---|
| `new TronClient(options)` | `network` (`mainnet` \| `nile` \| `shasta`), `fullNode`, `apiKey`, `timeoutMs` (15000), `retries` (2), `retryDelayMs` (1000), `headers`, `fetch` |
| `get(path, query)` / `post(path, body)` | Raw requests. Throws `TronClientError` with `status`, `body`, `url` |
| `getNowBlock()`, `getBlockByNum(n)` | Blocks |
| `getChainParameters()`, `getChainParametersMap()` | Network parameters as array or `{ getEnergyFee: 100, … }` |
| `getAccount(addr)`, `getAccountResource(addr)` | Account data; `visible: true` is set automatically for Base58 input |
| `getTransactionById(txid)`, `getTransactionInfoById(txid)` | Transaction and receipt |
| `triggerConstantContract({ contractAddress, functionSelector, parameter, ownerAddress })` | Read-only contract calls |
| `v1(path, query)` | TronGrid `/v1/…` endpoints |
| `explorerTx(txid)`, `explorerAddress(addr)` | TronScan links for the current network |
| `NETWORKS` | Presets: full node, explorer and USDT address per network |
| `clientFromFlags(flags)` | Build a client from `--network`, `--node`, `--api-key`, `--timeout` CLI flags |

TypeScript definitions are included.

## Retry behaviour

| Condition | Action |
|---|---|
| HTTP 429 or 5xx | wait `retryDelayMs × 2^attempt` (or `Retry-After`) and retry, up to `retries` times |
| Body says *rate exceeded … suspended for N s* (even with HTTP 200) | wait N + 0.5 s and retry |
| Timeout / network error | retry with backoff, then throw `TronClientError` |
| HTTP 4xx other than 429 | throw immediately |

## FAQ

### Do I need a TronGrid API key?

Not for a few calls. Without a key TronGrid accepts about 3 requests per second per IP and suspends you for 5 seconds when you exceed it. Anything that polls (deposit watchers, balance dashboards) should use a free key from trongrid.io and pass it as `apiKey` or `TRON_PRO_API_KEY`.

### Which endpoint should I use for Nile or Shasta?

`new TronClient({ network: 'nile' })` uses `https://nile.trongrid.io`; `shasta` uses `https://api.shasta.trongrid.io`. Both accept the same API key as mainnet.

### Does it sign transactions?

No. This client is read-only by design: queries, receipts and constant contract calls. For signing use `tronweb` or the offline helpers in `@tronless/tron-keygen`.

### Can I use it in the browser?

Yes, if the node allows CORS (TronGrid does). Pass `fetch` explicitly in environments without a global one.

## Related tools

- [`@tronless/tron-rpc-health`](../tron-rpc-health) — measure latency and lag of public TRON endpoints and pick the best one
- [`@tronless/tron-tx-inspector`](../tron-tx-inspector) — receipt and fee breakdown for any transaction
- [`@tronless/tron-account-resources`](../tron-account-resources) — energy, bandwidth and staking of an address
- [`@tronless/trc20-token`](../trc20-token) — TRC-20 balances and metadata without a key

## License

MIT © [TronLess](https://tronless.app)
