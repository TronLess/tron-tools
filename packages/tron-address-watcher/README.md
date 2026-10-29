# USDT TRC-20 deposit notifications for TRON — `@tronless/tron-address-watcher`

[![npm](https://img.shields.io/npm/v/@tronless/tron-address-watcher)](https://www.npmjs.com/package/@tronless/tron-address-watcher) [![CI](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml/badge.svg)](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml) ![node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue)

Watch a set of TRON addresses and get an event the moment USDT TRC-20 or TRX arrives — no node to run, no websocket, no indexer. Polls the TronGrid account endpoints, de-duplicates across polls, and optionally POSTs each transfer to your webhook.

**Part of [TronLess Tools](../../README.md)** — free, MIT-licensed TRON developer tools by [TronLess](https://tronless.app), the TRON energy rental service.

## Why

- **De-duplication that actually holds.** TronGrid's `min_timestamp` is inclusive and several transfers share a block timestamp. The cursor stays on the newest block and every transfer is keyed by hash, address, token and amount, so nothing is emitted twice and nothing is skipped.
- **Confirmed by default.** `only_confirmed=true` means solidified blocks only — about 19 blocks, roughly a minute. Crediting an unconfirmed transfer is how exchanges lose money.
- **TRC-20 and TRX in one stream**, normalized to the same shape, with token decimals already applied.
- **Webhooks built in**, with your own headers, and a `webhook` event telling you whether delivery worked.

## Install

```bash
npm i @tronless/tron-address-watcher
```

## Quick start (CLI)

```bash
# watch a deposit address for incoming USDT
npx @tronless/tron-address-watcher TR7NHqje… --only USDT --in

# Watching 1 address(es) on mainnet every 10s… (Ctrl+C to stop)
# 2026-09-08T08:31:51.000Z ⬇ IN  100 USDT from TLCehU3USNEHGWaueS78aoMsraA2i8tJ1P  tx e1e477fe…

# several addresses, JSON lines, straight into a webhook
npx @tronless/tron-address-watcher T1… T2… T3… --json --webhook https://example.com/hooks/tron \
  --header "Authorization: Bearer secret"

# what happened in the last day
npx @tronless/tron-address-watcher T1… --history --since 2026-09-07T00:00:00Z

# testnet, faster polling, TRC-20 only
npx @tronless/tron-address-watcher T1… --network nile --interval 5 --no-trx
```

Set `TRON_PRO_API_KEY` (or `--api-key`) before watching more than a couple of addresses.

## Usage (JavaScript)

```js
import { AddressWatcher, fetchTrc20Transfers } from '@tronless/tron-address-watcher';
import { TronClient } from '@tronless/tron-client';

const watcher = new AddressWatcher({
  addresses: ['TR7NHqje…', 'TMoRLxz…'],
  client: new TronClient({ apiKey: process.env.TRON_PRO_API_KEY }),
  contracts: ['USDT'],     // omit for every TRC-20
  direction: 'in',         // 'in' | 'out' | 'both'
  pollIntervalMs: 10_000,
  webhookUrl: 'https://example.com/hooks/tron',
});

watcher.on('transfer', async (t) => {
  // { kind:'TRC20', txid, direction:'in', from, to, token:{symbol,decimals,address},
  //   amountRaw:'100000000', amount:'100', timestamp, time }
  await credit(t.to, t.amount, t.txid);
});
watcher.on('error', (err) => log.warn(err.message)); // the watcher keeps running
watcher.start();

// or drive the loop yourself
const found = await watcher.pollOnce();

// history, without a watcher
const past = await fetchTrc20Transfers('TR7NHqje…', { since: Date.now() - 86_400_000, contracts: ['USDT'] });
```

Webhook payload:

```json
{
  "event": "transfer",
  "network": "mainnet",
  "transfer": {
    "kind": "TRC20", "txid": "e1e477fe…", "direction": "in",
    "from": "TLCehU3USNEHGWaueS78aoMsraA2i8tJ1P", "to": "TR7NHqje…",
    "token": { "symbol": "USDT", "decimals": 6, "address": "TR7NHqje…" },
    "amountRaw": "100000000", "amount": "100",
    "timestamp": 1788856311000, "time": "2026-09-08T08:31:51.000Z"
  }
}
```

Sent with `content-type: application/json` and `x-tronless-event: transfer`, plus any headers you configure.

## Polling, not websockets

TronGrid has no public websocket, so deposit detection on TRON is polling. The numbers that shape it:

| | Value |
|---|---|
| Block time | 3 s |
| Confirmation (solidified) | ~19 blocks, about 57 s |
| Requests per poll | 2 per address (TRC-20 + TRX), 1 with `--no-trx` |
| Anonymous TronGrid limit | ~3 requests/s, then a 5 s suspension |
| Default poll interval | 10 s, with 400 ms between addresses |

Polling faster than confirmation buys nothing when `onlyConfirmed` is on. For many addresses, either get an API key and raise the interval, or watch one hot wallet with a memo/sub-address scheme instead of hundreds of individual addresses.

## Events

| Event | Payload |
|---|---|
| `transfer` | one new transfer, after filtering and de-duplication |
| `poll` | `{ address, count, at }` after each address is polled |
| `error` | a network or API error; the watcher continues |
| `webhook` | `{ ok, status, transfer, error }` for each delivery attempt |

## API

| Member | Description |
|---|---|
| `new AddressWatcher(options)` | `addresses`, `client`/`network`, `pollIntervalMs`, `contracts`, `direction`, `trc20`, `trx`, `since`, `onlyConfirmed`, `webhookUrl`, `webhookHeaders`, `maxSeen` |
| `start()` / `stop()` / `pollOnce()` | Run continuously, or one pass at a time |
| `watchAddresses(addresses, options)` | Shorthand with `onTransfer` / `onError` callbacks |
| `fetchTrc20Transfers(address, options)` | Paginated TRC-20 history |
| `fetchTrxTransfers(address, options)` | Successful `TransferContract` history |

TypeScript definitions are included.

## When this does not work

- **State lives in memory.** Restarting resets the cursor to "now" unless you pass `since` yourself. Persist the last processed timestamp per address and feed it back at start-up.
- **Chain reorganisations.** Confirmed transfers are safe; if you set `onlyConfirmed: false` for speed, treat what you get as provisional.
- **It does not verify amounts against your ledger.** Always match the token contract as well as the amount — anyone can create a token that calls itself USDT. Compare `token.address`, not `token.symbol`.
- **Hundreds of addresses need an API key** and a longer interval, or a different architecture (one hot wallet plus per-user memos).
- **Outgoing transfers are detected the same way**, so `direction: 'both'` doubles the volume of events you handle.

## FAQ

### How do I get a notification when USDT arrives on a TRON address?

Run the watcher against that address with `--only USDT --in`, or use `AddressWatcher` and handle the `transfer` event. Each event carries the transaction hash, sender, amount in both raw and human form, and the block timestamp. Add `--webhook` to have it POSTed to your backend.

### Does TRON have websockets for new transactions?

Not publicly. TronGrid exposes REST endpoints only, so production deposit detection is polling — either the account endpoints this package uses, or your own full node with an event plugin. Ten-second polling with confirmed-only data is the usual balance.

### How many confirmations should I wait for?

Use solidified blocks, which is what `only_confirmed=true` gives you: about 19 blocks, roughly a minute after inclusion. TRON finality is fast, and anything less means crediting a transfer that can still disappear.

### Can I watch many addresses at once?

Yes, pass them all — polls are sequenced with a small delay to respect rate limits. Beyond a few dozen addresses, get a TronGrid API key and raise the interval, or restructure to fewer addresses with per-user identifiers.

### Will it catch transfers that happened while my process was down?

Only if you tell it where to resume. Store the last `timestamp` you processed and pass it as `since` on start-up; the de-duplication key then prevents replaying anything you already handled.

## Related tools

- [`@tronless/trc20-token`](../trc20-token) — read the resulting balance
- [`@tronless/tron-tx-inspector`](../tron-tx-inspector) — verify a specific deposit's status and fee
- [`@tronless/tron-keygen`](../tron-keygen) — generate the deposit addresses to watch
- [`@tronless/tron-rpc-health`](../tron-rpc-health) — make sure the endpoint you poll is not stale

## License

MIT © [TronLess](https://tronless.app)
