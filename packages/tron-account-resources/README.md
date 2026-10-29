# Check TRON energy, bandwidth and staking of an address — `@tronless/tron-account-resources`

[![npm](https://img.shields.io/npm/v/@tronless/tron-account-resources)](https://www.npmjs.com/package/@tronless/tron-account-resources) [![CI](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml/badge.svg)](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml) ![node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue)

`wallet/getaccountresource` returns a dozen fields with names like `freeNetUsed`, `NetLimit` and `TotalEnergyWeight`, and none of them directly answer the question you have: *can this address send a USDT transfer without burning TRX?* This package merges that response with `getaccount`, normalizes it, and answers exactly that.

**Part of [TronLess Tools](../../README.md)** — free, MIT-licensed TRON developer tools by [TronLess](https://tronless.app), the TRON energy rental service.

## Why

- **Available, not just limits.** Energy and bandwidth are reported as limit and used; what matters is the difference, split into free and staked bandwidth.
- **Stake 2.0 aware.** Reads `frozenV2` and `unfrozenV2`: staked for energy, staked for bandwidth, delegated out, acquired from someone else, and pending unstakes with the date they become withdrawable.
- **Answers in transfers.** "150,000 energy available" becomes "covers about 2 USDT transfers".
- **Testable.** The normalizer is pure — feed it cached JSON and assert on the result, no network needed.

## Install

```bash
npm i @tronless/tron-account-resources
```

## Quick start (CLI)

```bash
npx @tronless/tron-account-resources TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t

# TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t (mainnet)
# Balance:    1086255.130757 TRX
# Energy:     0 available of 0 (used 0)
# Bandwidth:  600 available (free 600/600, staked 0/0)
# Staked:     0 TRX for energy, 0 TRX for bandwidth
# Delegated:  in 0 TRX (energy) / out 0 TRX (energy)
# Covers:     ~0 USDT transfers by energy, ~1 by bandwidth
# Network:    9.600 energy per staked TRX per day
# Explorer:   https://tronscan.org/#/address/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t

# testnets and JSON
npx @tronless/tron-account-resources TXYZ… --network nile --json
```

## Usage (JavaScript)

```js
import { getAccountResources, canCover, normalizeResources } from '@tronless/tron-account-resources';

const r = await getAccountResources('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');

r.energy.available;                    // 0
r.bandwidth.available;                 // 600
r.covers.usdtTransfersByEnergy;        // 0
r.staking.forEnergyTrx;                // '0'
r.staking.delegatedIn.energyTrx;       // energy rented to this address
r.network_totals.energyPerStakedTrxPerDay; // 9.6

// gate a payout before you sign it
if (!canCover(r, { energy: 65_000, bandwidth: 345 })) {
  // rent energy, or accept that ~6.4 TRX will be burned
}

// pure form, for tests and cached data
const report = normalizeResources(resourceJson, accountJson, { network: 'mainnet' });
```

## What the fields mean

| Node field | In this package | Meaning |
|---|---|---|
| `freeNetLimit` / `freeNetUsed` | `bandwidth.free` | the 600-byte daily allowance every address gets |
| `NetLimit` / `NetUsed` | `bandwidth.staked` | bandwidth from your own staked TRX |
| `EnergyLimit` / `EnergyUsed` | `energy` | energy from staked **and delegated** TRX |
| `frozenV2` | `staking.forEnergyTrx`, `forBandwidthTrx` | Stake 2.0 positions |
| `delegated_frozenV2_balance_for_energy` | `staking.delegatedOut.energyTrx` | energy you lend to others |
| `acquired_delegated_frozenV2_balance_for_energy` | `staking.delegatedIn.energyTrx` | energy rented **to** you |
| `unfrozenV2` | `staking.unfreezing[]` | pending unstakes, with `withdrawable` and `expiresAt` |
| `TotalEnergyLimit` / `TotalEnergyWeight` | `network_totals` | network-wide daily energy and staked TRX; their ratio is energy per staked TRX |

Rented energy shows up inside `EnergyLimit`, which is why an address with zero staked TRX can still have hundreds of thousands of energy available — that is exactly what a delegation from a service like [TronLess](https://tronless.app/tron-energy) looks like on-chain.

## API

| Function | Description |
|---|---|
| `getAccountResources(address, options)` | Fetch and normalize; `client`, `network`, `includeAccount`, `hints` |
| `normalizeResources(resource, account, meta)` | Pure normalizer over raw node JSON |
| `canCover(report, { energy, bandwidth })` | Can this address pay from its own resources? |
| `USAGE_HINTS` | Planning figures behind `covers` (65,000 energy and 345 bytes per USDT transfer) |

TypeScript definitions are included.

## When this does not work

- **An unactivated address returns almost nothing.** TRON accounts exist only after they first receive funds; before that `activated` is `false` and every counter is zero. That is a real answer, not an error.
- **`covers` is a planning hint.** It uses 65,000 energy per USDT transfer. Your contract, or a first-time recipient, will differ — see [`@tronless/tron-energy-calculator`](../tron-energy-calculator).
- **Delegations are not itemized.** The node reports totals, not who delegated what to you or when a rental expires. For per-delegation detail you need `getdelegatedresourcev2` or the TronScan API.
- **Anonymous TronGrid allows about 3 requests a second** and this makes two per address. Set `TRON_PRO_API_KEY` before checking addresses in a loop.

## FAQ

### How do I check the energy of a TRON address?

Run `npx @tronless/tron-account-resources <address>`, or call `getAccountResources(address)` and read `energy.available`. It is the difference between `EnergyLimit` and `EnergyUsed` in the node's `getaccountresource` response, and it includes energy delegated to you by someone else.

### Why did my USDT transfer burn TRX even though I had energy?

Three common reasons: the energy was less than the roughly 64,285 units the transfer needed, so the remainder was burned at 100 SUN each; the energy had already been used earlier the same day; or a delegation expired before you sent. `canCover` answers the first two before you sign.

### Does rented energy appear in this report?

Yes. Delegated energy is added to `EnergyLimit`, so it shows in `energy.available`, and the TRX behind it appears separately in `staking.delegatedIn.energyTrx`. An address with 0 TRX staked and a large energy balance is almost always renting.

### How much TRX must I stake to get 65,000 energy per day?

At about 9.6 energy per staked TRX per day, roughly 6,800 TRX — for one USDT transfer a day. The exact ratio is `TotalEnergyLimit / TotalEnergyWeight`, both included in `network_totals`, and it drifts as the network stakes more. Remember unstaking takes 14 days.

### Can I use this on Nile or Shasta?

Yes, pass `--network nile` or `--network shasta` on the CLI, or `{ network: 'nile' }` in code. The explorer link switches with it.

## Related tools

- [`@tronless/tron-energy-calculator`](../tron-energy-calculator) — what a transfer will cost given those resources
- [`@tronless/tron-tx-inspector`](../tron-tx-inspector) — what a past transaction actually cost
- [`@tronless/trc20-token`](../trc20-token) — token balances for the same address
- [`@tronless/tron-address`](../tron-address) — validate the address first

## License

MIT © [TronLess](https://tronless.app)
