# TRON RPC endpoints and node health checker — `@tronless/tron-rpc-health`

[![npm](https://img.shields.io/npm/v/@tronless/tron-rpc-health)](https://www.npmjs.com/package/@tronless/tron-rpc-health) [![CI](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml/badge.svg)](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml) ![node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue)

A curated list of public TRON endpoints for mainnet, Nile and Shasta, plus a probe that measures each one's latency, block height and how far behind consensus it is. Use it to pick an endpoint before shipping, to monitor one in production, or to choose the fastest node at start-up.

**Part of [TronLess Tools](../../README.md)** — free, MIT-licensed TRON developer tools by [TronLess](https://tronless.app), the TRON energy rental service.

## Why

- **A stale node is worse than a dead one.** A node 200 blocks behind still answers happily and tells you a deposit has not arrived. Height comparison against the highest peer catches that; a plain uptime ping does not.
- **Both protocols.** TRON's own HTTP API (`/wallet/getnowblock`) and the Ethereum-compatible JSON-RPC (`eth_getBlockByNumber`) are probed the same way, so you can compare them side by side.
- **Mainnet and testnets in one list**, with the explorer and USDT test-token addresses that go with each.
- **One function for bootstrap:** `pickBestNode('mainnet')` returns a URL your app can use immediately.

## Install

```bash
npm i @tronless/tron-rpc-health
```

## Quick start (CLI)

```bash
npx @tronless/tron-rpc-health --network mainnet

# OK   TronGrid                    http     270 ms     86061626    1 behind
# OK   TronGrid JSON-RPC           jsonrpc  189 ms     86061627    0 behind
# OK   TronStack                   http     854 ms     86061627    0 behind
# OK   PublicNode JSON-RPC         jsonrpc  113 ms     86061626    1 behind
#
# Consensus height: 86061627   best: TronGrid JSON-RPC (https://api.trongrid.io/jsonrpc)

# testnets
npx @tronless/tron-rpc-health --network nile

# your own node, or a paid provider
npx @tronless/tron-rpc-health --url http://127.0.0.1:8090 --url https://api.trongrid.io

# the endpoint list itself
npx @tronless/tron-rpc-health list

# for monitoring: exit code 1 when nothing healthy is left
npx @tronless/tron-rpc-health --json --max-lag 5
```

## Usage (JavaScript)

```js
import { checkEndpoints, pickBestNode, checkEndpoint, DEFAULT_ENDPOINTS } from '@tronless/tron-rpc-health';

// choose a node at start-up
const url = await pickBestNode('mainnet');
const client = new TronClient({ fullNode: url, network: 'custom' });

// full report
const report = await checkEndpoints(null, { network: 'mainnet', maxLagBlocks: 10 });
report.consensusHeight;   // highest height any healthy node reported
report.best;              // fastest node within the lag threshold
report.bestHttp;          // …restricted to the TRON HTTP API
report.results;           // every endpoint with latency, height, behindBlocks, error

// one endpoint, e.g. in a health check route
const own = await checkEndpoint({ url: 'http://127.0.0.1:8090', kind: 'http' });
if (!own.ok || own.lagBlocks > 20) alert('local node is behind');
```

## Public endpoints

| Network | HTTP API | JSON-RPC | Explorer |
|---|---|---|---|
| Mainnet | `https://api.trongrid.io`, `https://api.tronstack.io` | `https://api.trongrid.io/jsonrpc`, `https://tron-rpc.publicnode.com/jsonrpc` | tronscan.org |
| Nile testnet | `https://nile.trongrid.io` | `https://nile.trongrid.io/jsonrpc` | nile.tronscan.org |
| Shasta testnet | `https://api.shasta.trongrid.io` | `https://api.shasta.trongrid.io/jsonrpc` | shasta.tronscan.org |

Nile's USDT test token is `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf`, Shasta's is `TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs`. Both testnets have faucets; Nile is the one that tracks mainnet behaviour more closely.

Latencies measured on 2026-09-08 from a single European location — treat them as a snapshot, not a ranking, and run the check from where your servers actually are.

## HTTP API or JSON-RPC?

| | TRON HTTP API | JSON-RPC |
|---|---|---|
| Endpoint | `/wallet/*`, `/v1/*` | `/jsonrpc` |
| Style | REST-ish, TRON-native | Ethereum-compatible |
| Addresses | Base58 `T…` with `visible: true` | `0x…` only |
| Resources | full energy/bandwidth/staking data | not exposed |
| Account history | TronGrid `/v1/accounts/…/transactions` | not available |
| Use it for | anything TRON-specific | reusing EVM tooling and libraries |

Most TRON work needs the HTTP API; JSON-RPC is a compatibility layer, and several TRON-only concepts simply are not in it.

## API

| Function | Description |
|---|---|
| `checkEndpoints(endpoints, options)` | Probe with limited concurrency, rank, return a report |
| `checkEndpoint(endpoint, options)` | Probe one; never throws, failures come back as `ok: false` |
| `pickBestNode(network, options)` | Fastest healthy HTTP node's URL, or `null` |
| `formatReport(report)` | Terminal table |
| `DEFAULT_ENDPOINTS`, `BLOCK_INTERVAL_MS` | The curated list; 3000 ms per block |

Options: `network`, `concurrency` (4), `timeoutMs` (8000), `maxLagBlocks` (20), `apiKey`, `fetch`.

## When this does not work

- **Latency is measured from wherever you run it.** A node that is fast from Frankfurt may be slow from São Paulo. Run the check on your own infrastructure before choosing.
- **One probe is one sample.** For monitoring, poll on a schedule and look at the distribution, not a single number.
- **Consensus height is the maximum among the nodes checked**, not chain truth. If every endpoint in the list is behind, none is flagged.
- **Rate limits distort results.** Anonymous TronGrid allows about 3 requests a second; a probe fired during a burst of your own traffic can look slow or fail outright. Pass an API key.
- **The endpoint list ages.** Providers change terms — Ankr's public TRON JSON-RPC began returning HTTP 403 without a key and was dropped. Pass `--url` for anything not listed.

## FAQ

### What is the TRON mainnet RPC URL?

`https://api.trongrid.io` for the native HTTP API, and `https://api.trongrid.io/jsonrpc` for the Ethereum-compatible JSON-RPC. `https://api.tronstack.io` is an alternative HTTP endpoint, and `https://tron-rpc.publicnode.com/jsonrpc` a free JSON-RPC one.

### Which TRON testnet should I use, Nile or Shasta?

Nile generally tracks mainnet behaviour more closely and is the usual default for contract testing. Shasta is older and still fine for basic flows. Both are in the built-in list with their own USDT test tokens, so you can switch with a single flag.

### What are TronGrid's rate limits?

Without an API key, roughly 3 requests per second per IP; exceed it and the node replies "request rate exceeded the allowed_rps(3), and the query server is suspended for 5 s". A free key sent as `TRON-PRO-API-KEY` raises that considerably — [`@tronless/tron-client`](../tron-client) sends it and backs off correctly when suspended.

### How far behind can a node be before it matters?

TRON produces a block every 3 seconds, and blocks solidify after about 19 of them, roughly a minute. A node one or two blocks behind is normal. Past about 20 blocks it is materially stale, which is the default `maxLagBlocks`; for deposit detection, tighten it.

### Can I check my own node?

Yes: `--url http://127.0.0.1:8090`, or `checkEndpoint({ url, kind: 'http' })` inside your own health endpoint. Compare its height against the public list to see whether it is syncing.

## Related tools

- [`@tronless/tron-client`](../tron-client) — the HTTP client with API-key support and retries
- [`@tronless/tron-address-watcher`](../tron-address-watcher) — polling that depends on a healthy endpoint
- [`@tronless/tron-tx-inspector`](../tron-tx-inspector) — inspect transactions through any endpoint
- [`@tronless/trc20-token`](../trc20-token) — read tokens on mainnet or either testnet

## License

MIT © [TronLess](https://tronless.app)
