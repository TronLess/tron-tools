# TRON transaction inspector and fee breakdown — `@tronless/tron-tx-inspector`

[![npm](https://img.shields.io/npm/v/@tronless/tron-tx-inspector)](https://www.npmjs.com/package/@tronless/tron-tx-inspector) [![CI](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml/badge.svg)](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml) ![node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue)

Paste a transaction hash, get a receipt: status, block, decoded method, who sent what to whom, and where every SUN of the fee went — energy burned versus energy from your own stake versus energy paid by the contract owner, plus bandwidth, activation and memo. Answers "why did this cost 6.43 TRX?" without opening TronScan.

**Part of [TronLess Tools](../../README.md)** — free, MIT-licensed TRON developer tools by [TronLess](https://tronless.app), the TRON energy rental service.

## Why

- **The fee, itemized.** `gettransactioninfobyid` returns `energy_usage`, `energy_fee`, `origin_energy_usage`, `energy_usage_total`, `net_usage`, `net_fee` and `fee`. This turns them into a breakdown that adds up, including the leftover that means account activation or a memo.
- **Real status.** `SUCCESS`, a revert reason decoded from `resMessage`, `PENDING` for a transaction not yet in a block, or `NOT_FOUND` — distinguished properly, which matters for a payout job.
- **Token transfers decoded**, with symbols and decimals for well-known tokens, straight from the event logs.
- **Two calls, one object**, and a pure `buildReceipt` you can unit-test against cached JSON.

## Install

```bash
npm i @tronless/tron-tx-inspector
```

## Quick start (CLI)

```bash
npx @tronless/tron-tx-inspector b86bfe8c777cd3419c22dd254763d157ee35146b410540c9f7c2864e283ef415

# b86bfe8c777cd3419c22dd254763d157ee35146b410540c9f7c2864e283ef415
# Status:     SUCCESS
# Type:       Smart contract call → transfer()
# Block:      86060671 @ 2026-09-08T07:50:09.000Z
# From:       TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5
# Contract:   TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
# To:         TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu
# Amount:     452 USDT (raw 452000000)
# Fee:        6.4285 TRX total
#   energy:   64285 used — 0 from stake, 0 from contract owner, 64285 burned = 6.4285 TRX @ 100 SUN
#   bandwidth:345 bytes — 0 TRX burned
# Transfer:   452 USDT  TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5 → TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu
# Explorer:   https://tronscan.org/#/transaction/b86bfe8c…

# several at once; exit code 1 if any of them failed
npx @tronless/tron-tx-inspector <txid1> <txid2> --json

# testnets
npx @tronless/tron-tx-inspector <txid> --network nile
```

The non-zero exit code on failure makes it usable as a check in a deploy script or a cron job.

## Usage (JavaScript)

```js
import { inspectTransaction, formatReceipt, buildReceipt } from '@tronless/tron-tx-inspector';

const r = await inspectTransaction('b86bfe8c…3ef415');

r.status;                   // 'SUCCESS' | 'REVERT' | 'OUT_OF_ENERGY' | 'PENDING' | 'NOT_FOUND'
r.confirmed;                // is it in a block yet
r.fee.totalTrx;             // '6.4285'
r.fee.energy.burnedUnits;   // 64285
r.fee.energy.fromStake;     // 0 — energy covered by the sender's own stake or delegation
r.fee.energy.priceSunPerUnit; // 100
r.fee.bandwidth.bytes;      // 345
r.tokenTransfers;           // [{ symbol:'USDT', amount:'452', from, to, contract }]
r.method;                   // 'transfer'

console.log(formatReceipt(r)); // the terminal view above

// pure: no network, for tests or cached data
buildReceipt(txJson, infoJson, { network: 'mainnet' });
```

Confirming a payout:

```js
const r = await inspectTransaction(txid);
if (r.status === 'SUCCESS' && r.confirmed && r.tokenTransfers.some((t) => t.to === expected && t.amount === '452')) {
  markPaid();
}
```

## Reading the fee fields

| Receipt field | Meaning |
|---|---|
| `energy_usage_total` | all energy the call consumed, however it was paid |
| `energy_usage` | the part covered by the sender's own staked or delegated energy |
| `origin_energy_usage` | the part the contract owner paid, if the contract shares its energy |
| `energy_fee` | the part burned as TRX, in SUN |
| `energy_penalty_total` | surcharge from the dynamic energy model on busy contracts |
| `net_usage` / `net_fee` | transaction size in bytes, and the TRX burned if bandwidth did not cover it |
| `fee` | the total charged, in SUN |

In the example above, 64,285 energy included 49,635 units of penalty, all of it burned because the sender had no energy — 6.4285 TRX at 100 SUN per unit. Had the sender rented energy first, the same transfer would have cost a fraction of that; that is the entire premise of [TronLess](https://tronless.app/tron-energy), and this tool is how you verify it after the fact.

Anything in `fee` that is neither energy nor bandwidth appears as `fee.other`: 1 TRX for a memo, 1 TRX (plus 0.1) for activating a brand-new account, or a multi-signature fee.

## Contract types recognized

`TransferContract` (TRX), `TransferAssetContract` (TRC-10), `TriggerSmartContract` (any contract call, including every TRC-20 transfer), plus labels for staking, delegation, voting, contract deployment and permission updates.

## API

| Function | Description |
|---|---|
| `inspectTransaction(txid, options)` | Fetch both node responses and build the receipt |
| `buildReceipt(tx, info, meta)` | Pure builder over raw JSON |
| `formatReceipt(receipt)` | Terminal-friendly rendering |
| `CONTRACT_LABELS` | Contract type → human label |

TypeScript definitions are included.

## When this does not work

- **A transaction that is not yet in a block** returns `PENDING` with no fee data — a node cannot know the cost before execution. Poll again after a few seconds; blocks are 3 seconds apart and solidify after roughly a minute.
- **`NOT_FOUND` is ambiguous.** It means this node has not seen the hash: it may be too new, on another network, or simply wrong. Check the network before concluding anything.
- **Token symbols are resolved from a built-in list** of well-known mainnet tokens. Other tokens show the raw amount and the contract address; read their decimals with [`@tronless/trc20-token`](../trc20-token).
- **Internal transactions are not expanded.** Contract-to-contract calls appear in the events, not as a separate call tree.
- **It reads history, it does not predict.** For a cost estimate before sending, use [`@tronless/tron-energy-calculator`](../tron-energy-calculator).

## FAQ

### Why did my TRON transaction cost 6.43 TRX?

Because it burned energy. A USDT transfer needs about 64,285 energy, and an address with none pays for all of it at the `getEnergyFee` rate of 100 SUN per unit — exactly 6.4285 TRX. The bandwidth was free because 345 bytes fit inside the 600-byte daily allowance. The `energy` line of the breakdown shows the split.

### What does OUT_OF_ENERGY mean?

The transaction ran out of the energy budget allowed by its `fee_limit` before finishing, so it reverted and the energy consumed was still charged. Raise the fee limit (wallets often default to 60 TRX) or give the account enough energy before sending.

### How do I check whether a USDT payment arrived?

Inspect the hash and check three things: `status === 'SUCCESS'`, `confirmed === true`, and a matching entry in `tokenTransfers` with the expected recipient and amount. Reading only the transaction's own fields is not enough — a contract call can succeed while transferring nothing.

### What is energy_penalty_total?

The dynamic energy model raises the cost of calls to heavily-used contracts. On USDT it added 49,635 units to the 14,650 base cost in the example above, which is most of the fee. It varies with contract load, so treat any energy figure as an estimate until you see the receipt.

### Does it work on Nile and Shasta?

Yes, pass `--network nile` or `--network shasta`. Explorer links follow the network.

## Related tools

- [`@tronless/tron-energy-calculator`](../tron-energy-calculator) — estimate the cost before you send
- [`@tronless/trc20-decoder`](../trc20-decoder) — the decoding layer underneath this tool
- [`@tronless/tron-account-resources`](../tron-account-resources) — why the sender had no energy
- [`@tronless/tron-address-watcher`](../tron-address-watcher) — catch transfers as they arrive

## License

MIT © [TronLess](https://tronless.app)
