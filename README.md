# TRON developer tools by TronLess

Ten small, focused Node.js packages for building on the TRON network: address validation, unit conversion, offline key generation, energy and fee calculation, account resources, TRC-20 decoding and reading, transaction inspection, RPC health checks and deposit watching. MIT-licensed, ESM, TypeScript definitions included, no `tronweb` required.

Built and maintained by [TronLess](https://tronless.app), the TRON energy rental service — we use these in production and publish them because everyone writing TRON integrations rewrites the same helpers.

## The tools

| Package | What it does | CLI |
|---|---|---|
| [`@tronless/tron-address`](packages/tron-address) | Validate a TRON address with its real checksum; convert Base58 ⇄ hex ⇄ 0x | `tron-address` |
| [`@tronless/tron-units`](packages/tron-units) | SUN ⇄ TRX and TRC-20 decimals, BigInt-safe | `tron-units` |
| [`@tronless/tron-keygen`](packages/tron-keygen) | Offline keys, BIP-39 mnemonics on `m/44'/195'`, vanity addresses | `tron-keygen` |
| [`@tronless/tron-energy-calculator`](packages/tron-energy-calculator) | What a USDT transfer costs in energy, bandwidth and TRX; rent vs burn vs stake | `tron-energy-calculator` |
| [`@tronless/tron-account-resources`](packages/tron-account-resources) | Energy, bandwidth, staking and delegations of any address | `tron-account-resources` |
| [`@tronless/trc20-decoder`](packages/trc20-decoder) | Decode TRC-20 calldata, event logs and whole transactions; encode calls | `trc20-decoder` |
| [`@tronless/trc20-token`](packages/trc20-token) | Balances, decimals, supply and allowances without a private key | `trc20-token` |
| [`@tronless/tron-tx-inspector`](packages/tron-tx-inspector) | Status, decoded method and full fee breakdown for a transaction hash | `tron-tx-inspector` |
| [`@tronless/tron-rpc-health`](packages/tron-rpc-health) | Latency, height and lag of public TRON endpoints; pick the best node | `tron-rpc-health` |
| [`@tronless/tron-address-watcher`](packages/tron-address-watcher) | USDT TRC-20 and TRX deposit notifications with webhooks | `tron-address-watcher` |

All of them share one small foundation: [`@tronless/tron-client`](packages/tron-client), a zero-dependency HTTP client for TronGrid and full nodes with API-key support and correct rate-limit backoff. It is published too, and usable on its own.

## Try one without installing anything

```bash
npx @tronless/tron-address TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
npx @tronless/tron-energy-calculator usdt
npx @tronless/tron-tx-inspector b86bfe8c777cd3419c22dd254763d157ee35146b410540c9f7c2864e283ef415
npx @tronless/tron-rpc-health --network mainnet
```

## A worked example

Estimate a USDT payout, check the sender can afford it, send it with your own signer, then verify the receipt:

```js
import { getAccountResources, canCover } from '@tronless/tron-account-resources';
import { estimateUsdtTransfer, fetchChainParams } from '@tronless/tron-energy-calculator';
import { inspectTransaction } from '@tronless/tron-tx-inspector';
import { getUsdtBalance } from '@tronless/trc20-token';

const from = 'TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5';

const params = await fetchChainParams();                 // live getEnergyFee etc.
const resources = await getAccountResources(from);
const estimate = estimateUsdtTransfer({ params, availableEnergy: resources.energy.available });

console.log(`this transfer will burn ${estimate.total.trx} TRX`);
if (!canCover(resources, { energy: estimate.energy.required, bandwidth: 345 })) {
  console.log('no energy — rent some first: https://tronless.app/tron-energy');
}

const balance = await getUsdtBalance(from);
// … sign and broadcast with tronweb …
const receipt = await inspectTransaction(txid);
console.log(receipt.status, receipt.fee.totalTrx, receipt.tokenTransfers);
```

## Design rules

- **Small and separate.** Each package solves one problem and can be installed alone. The only shared dependency is the HTTP client, and half the packages do not even need that.
- **Offline where possible.** Address conversion, unit maths, key generation and calldata decoding never touch the network, so they run in tests, browsers and air-gapped machines.
- **No key handling in networked code.** Nothing here signs or broadcasts. The one package that touches private keys is offline by construction.
- **Honest numbers.** Fee constants come from `wallet/getchainparameters` and real mainnet receipts, pinned in the test suite; anything estimated is labelled as an estimate. See [`seo/FACTS.md`](seo/FACTS.md) for the sheet every number in this repo traces back to.
- **Testable.** Every network call goes through an injectable `fetch`, so the unit tests run without a node. Live tests against mainnet run separately.

## Development

```bash
npm install          # npm workspaces, one install for all packages
npm test             # unit tests, no network
npm run test:live    # also runs the tests that hit TRON mainnet
npm run check        # metadata, bin, types and README checks before publishing
npm run site         # build static landing pages into site/dist/
```

Requires Node.js 20 or newer. Tests use the built-in `node --test` runner; there is no test framework to install.

Continuous integration runs the unit tests on Node 20, 22 and 24 on Linux and Windows, and a weekly live run against mainnet so that fee defaults and the endpoint list cannot silently rot.

## Contributing

Issues and pull requests are welcome at [github.com/TronLess/tron-tools](https://github.com/TronLess/tron-tools). Two rules: every network call must be mockable through an injected `fetch`, and any on-chain number added to the code or the docs must come with the command that produced it.

## About TronLess

[TronLess](https://tronless.app) rents TRON energy so that USDT TRC-20 transfers cost a fraction of burning TRX. There is a [Telegram bot](https://t.me/tronless_bot) for one-off rentals and an [API](https://tronless.app/api) for exchanges, payment services and bots. These tools are independent of that service and work fine without it — they exist because we needed them ourselves.

Further reading on the fee mechanics these tools model:

- [How to reduce USDT TRC-20 transfer fees](https://tronless.app/blog/how-to-reduce-usdt-trc20-fee) (EN) · [Как снизить комиссию USDT TRC-20](https://tronless.app/blog/kak-snizit-komissiyu-usdt-trc20) (RU)
- [TRON energy explained](https://tronless.app/tron-energy) · [USDT TRC-20 transfer fee](https://tronless.app/usdt-trc20-transfer-fee)

## License

MIT © [TronLess](https://tronless.app)
