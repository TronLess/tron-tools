# TRON energy and USDT TRC-20 fee calculator — `@tronless/tron-energy-calculator`

[![npm](https://img.shields.io/npm/v/@tronless/tron-energy-calculator)](https://www.npmjs.com/package/@tronless/tron-energy-calculator) [![CI](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml/badge.svg)](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml) ![node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue)

A USDT TRC-20 transfer from an address with no energy costs **6.4285 TRX** on TRON mainnet today: 64,285 energy at 100 SUN per unit, with the 345 bytes of bandwidth covered by the free daily allowance. This package computes that number from live chain parameters instead of a hardcoded guess, and shows what changes when the recipient is new, when you already have energy, or when you rent it.

**Part of [TronLess Tools](../../README.md)** — free, MIT-licensed TRON developer tools by [TronLess](https://tronless.app), the TRON energy rental service.

## Why

- **Live parameters.** `getEnergyFee` dropped from 420 to 100 SUN in August 2025 and Super Representatives can vote it again. `--live` reads the current value from `wallet/getchainparameters`; offline defaults are there for tests.
- **Models the real rules.** Energy is charged only for the part you cannot cover; bandwidth is all-or-nothing; a memo costs 1 TRX; activating a fresh account burns another 1 TRX. Wallet estimates that ignore this are wrong in both directions.
- **Answers business questions**, not just protocol ones: rent versus burn versus stake, for N transfers a day, in TRX and in dollars.
- **Verified against a real receipt** (`b86bfe8c…3ef415`, block 86,060,671) in the test suite.

## Install

```bash
npm i @tronless/tron-energy-calculator
```

## Quick start (CLI)

```bash
# the default question: what does a USDT transfer cost?
npx @tronless/tron-energy-calculator usdt

# USDT TRC-20 transfer (recipient already holds USDT)
# Energy:     64285 needed, 0 covered, 64285 burned → 6.4285 TRX
# Bandwidth:  345 bytes, covered → 0 TRX
# TOTAL:      6.4285 TRX   (worst case with zero resources: 6.7735 TRX)

# recipient has never held USDT — a new storage slot, about twice the energy
npx @tronless/tron-energy-calculator usdt --new-recipient        # 13.0285 TRX

# you already have 60,000 energy delegated
npx @tronless/tron-energy-calculator usdt --available-energy 60000  # 0.4285 TRX

# read today's real prices from the chain
npx @tronless/tron-energy-calculator usdt --live

# rent vs burn for a payout service
npx @tronless/tron-energy-calculator compare --per-day 100 --rent-price 2.3 --trx-usd 0.30
# Burn TRX:     6.4285 TRX per transfer → 19285.5 TRX per period (~$5785.65)
# Rent energy:  2.3 TRX per transfer → 6900 TRX per period (~$2070)
# Saved:        12385.5 TRX (64%) ≈ $3715.65

# how much TRX would I have to stake instead? (needs the network)
npx @tronless/tron-energy-calculator stake --energy-per-day 65000

# plain TRX transfer to a brand-new address
npx @tronless/tron-energy-calculator trx --new-recipient          # 1 TRX activation
```

## Usage (JavaScript)

```js
import { estimateUsdtTransfer, estimateFee, fetchChainParams, compareRentVsBurn } from '@tronless/tron-energy-calculator';

// offline, with the defaults shipped in the package
const quick = estimateUsdtTransfer();
quick.total.trx;        // '6.4285'
quick.energy.required;  // 64285

// with today's real prices
const params = await fetchChainParams();          // one HTTP call
const live = estimateUsdtTransfer({ params, availableEnergy: 30_000 });
live.energy.burned;     // 34285
live.total.trx;         // '3.4285'

// anything else: your own measured energy usage
estimateFee({ energy: 30_000, bandwidth: 400, availableBandwidth: 0, memo: true, params });

// business case
compareRentVsBurn({ transfersPerDay: 50, rentPricePerTransferTrx: 2.5, trxPriceUsd: 0.3 });
// { burn:{…}, rent:{…}, saved:{ perPeriodTrx, perPeriodUsd, percent } }
```

## How a TRON fee is actually built

| Component | Rule | Price today |
|---|---|---|
| Energy | charged only for units you cannot cover from stake or delegation | 100 SUN per unit (`getEnergyFee`) |
| Bandwidth | **all or nothing** — if free + staked bandwidth does not cover the whole transaction, the entire size is charged | 1,000 SUN per byte (`getTransactionFee`) |
| Free bandwidth | every address gets a daily allowance | 600 bytes (`getFreeNetLimit`) |
| Memo | any `data` field on the transaction | 1 TRX (`getMemoFee`) |
| Account activation | sending TRX to a never-used address | 1 TRX, plus 0.1 TRX if bandwidth is also burned |

A TRC-20 transfer is about 345 bytes, a plain TRX transfer about 268 — both fit inside the free 600 bytes once per day, which is why bandwidth usually costs nothing and energy is the whole bill.

## Built-in presets

| Preset | Energy | Bandwidth | Burned cost at 100 SUN |
|---|---|---|---|
| `USDT_TRANSFER` (recipient holds USDT) | 64,285 | 345 | 6.4285 TRX |
| `USDT_TRANSFER_NEW_HOLDER` | 130,285 | 345 | 13.0285 TRX |
| `TRC20_TRANSFER_GENERIC` | 30,000 | 345 | 3 TRX |
| `TRC20_APPROVE` | 25,000 | 345 | 2.5 TRX |
| `TRX_TRANSFER` | 0 | 268 | 0 TRX |

The USDT figures come from a real mainnet receipt, including the 49,635 units of `energy_penalty_total` that the dynamic energy model adds on a contract as busy as USDT. Generic TRC-20 numbers are order-of-magnitude estimates — measure your own contract with [`@tronless/tron-tx-inspector`](../tron-tx-inspector) and pass the result.

## API

| Function | Description |
|---|---|
| `estimateFee(input)` | Core estimator: `energy`, `bandwidth`, `availableEnergy`, `availableBandwidth`, `memo`, `activatesAccount`, `params` |
| `estimateUsdtTransfer(options)` | USDT preset, with `recipientHoldsUsdt` |
| `estimateTrxTransfer(options)` | TRX transfer, with `recipientIsNew` and `memo` |
| `fetchChainParams(options)` | Live `getchainparameters` plus network staking weights |
| `paramsFromChain(response)` | Pure mapper, for cached parameters |
| `compareRentVsBurn(options)` | Rent vs burn over N transfers a day, optionally in USD |
| `trxToStakeForEnergy(energyPerDay, params)` | TRX to stake for a given daily energy (needs live weights) |
| `DEFAULT_PARAMS`, `PRESETS` | Offline defaults and usage presets |

Every result carries both `sun` and `trx`, plus a `worstCase` figure for an address with no resources at all.

## When this does not work

- **Energy usage is an estimate, not a promise.** TRON's dynamic energy model raises the cost of calls to popular contracts, and a token's own logic (blacklists, fee-on-transfer, first-time recipients) changes it further. For an exact number, simulate with `triggerconstantcontract` and read `energy_used`, or inspect a comparable past transaction.
- **`fee_limit` is a separate ceiling.** A transaction reverts with `OUT_OF_ENERGY` if the fee would exceed the limit your wallet set, even when your account could pay. Wallets typically default to 60 TRX; the chain maximum is 15,000 TRX.
- **Staking estimates need live network weights**, so the `stake` command requires a network call. The ratio moves as total staked TRX changes across the network.
- **Rental prices are market data**, not a chain parameter. Pass the price you are actually quoted.

## FAQ

### How much energy does a USDT TRC-20 transfer need?

About 64,285 units when the recipient already holds USDT, and roughly double — around 130,000 — when they have never held it, because the contract has to create a new storage slot. At 100 SUN per unit that is 6.4285 TRX versus about 13 TRX if you have no energy and burn TRX instead.

### Why is my first transfer to a new wallet twice as expensive?

Writing a balance entry that does not exist yet costs more than updating one that does. That is a property of the token contract's storage, not a fee TRON adds, and it applies to most TRC-20 tokens. Pass `--new-recipient` to see the number.

### What is the difference between energy and bandwidth?

Bandwidth pays for the size of the transaction in bytes; energy pays for executing smart contract code. A plain TRX transfer only uses bandwidth and is usually free thanks to the 600-byte daily allowance. Any TRC-20 transfer is a contract call and needs energy, which is where the cost comes from.

### Is renting energy cheaper than staking TRX?

Usually, unless your volume is constant and large. Around 9.6 energy per staked TRX per day means roughly 6,800 TRX locked to cover one USDT transfer a day, and unstaking takes 14 days. Renting the same energy costs about 2–3 TRX per transfer with no capital locked — run `compare` with your own numbers, or see how [TronLess](https://tronless.app/tron-energy) prices it.

### Where do the numbers come from?

`getEnergyFee`, `getTransactionFee`, `getFreeNetLimit`, `getMemoFee` and the account-creation fees come straight from `wallet/getchainparameters` when you pass `--live`. Energy usage figures come from real mainnet receipts, which the test suite pins.

## Related tools

- [`@tronless/tron-tx-inspector`](../tron-tx-inspector) — what a specific transaction actually cost
- [`@tronless/tron-account-resources`](../tron-account-resources) — how much energy an address has right now
- [`@tronless/tron-units`](../tron-units) — SUN ⇄ TRX conversions
- [`@tronless/tron-client`](../tron-client) — the HTTP client used for `--live`

## License

MIT © [TronLess](https://tronless.app)
