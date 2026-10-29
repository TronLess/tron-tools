# Get a USDT TRC-20 balance without a private key — `@tronless/trc20-token`

[![npm](https://img.shields.io/npm/v/@tronless/trc20-token)](https://www.npmjs.com/package/@tronless/trc20-token) [![CI](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml/badge.svg)](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml) ![node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue)

Read any TRC-20 token on TRON — balance, decimals, symbol, total supply, allowance — through `wallet/triggerconstantcontract`. No private key, no signing, no gas: a constant call is executed by the node and discarded, so it costs nothing and cannot move funds.

**Part of [TronLess Tools](../../README.md)** — free, MIT-licensed TRON developer tools by [TronLess](https://tronless.app), the TRON energy rental service.

## Why

- **Read-only by construction.** No key is ever accepted, so this package cannot sign anything. Safe to run on a public API server.
- **Decimals handled for you.** `balanceOf` returns `452000000`; you want `452`. The library reads `decimals()` once and formats with BigInt.
- **Rate-limit friendly.** Calls are sequenced rather than fired in parallel, because anonymous TronGrid allows about 3 requests a second and then suspends you for 5.
- **Any token, any network.** `USDT` resolves to the right contract on mainnet, Nile and Shasta; anything else takes a contract address.

## Install

```bash
npm i @tronless/trc20-token
```

## Quick start (CLI)

```bash
npx @tronless/trc20-token info USDT

# Tether USD (USDT)
# address:  TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
# decimals: 6
# supply:   94268087063.644158
# explorer: https://tronscan.org/#/address/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t

# a balance
npx @tronless/trc20-token balance USDT TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t

# several tokens for one holder
npx @tronless/trc20-token balances TR7NHqje… --tokens USDT,USDC,USDD

# an allowance
npx @tronless/trc20-token allowance USDT <owner> <spender>

# any constant method on any contract
npx @tronless/trc20-token call TR7NHqje… "balanceOf(address)" --args TMoRLxz… --outputs uint256

# testnet
npx @tronless/trc20-token info USDT --network nile
```

## Usage (JavaScript)

```js
import { getUsdtBalance, getBalance, getTokenInfo, getAllowance, callConstant } from '@tronless/trc20-token';

const b = await getUsdtBalance('TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5');
b.balance;  // '452'         human amount
b.raw;      // '452000000'   raw units, safe to keep as a string
b.decimals; // 6

// any token by address
await getBalance('TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8', holder);

// skip the decimals() call when you already know it
await getBalance('TR7NHqje…', holder, { decimals: 6 });

const info = await getTokenInfo('USDT');
// { address, name: 'Tether USD', symbol: 'USDT', decimals: 6, totalSupply: '94268087063.644158', explorer }

await getAllowance('USDT', owner, spender);

// anything else a contract exposes
const res = await callConstant({
  contract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  method: 'balanceOf(address)',
  types: ['address'],
  values: ['TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5'],
  outputs: ['uint256'],
});
res.values[0];   // '452000000'
res.energyUsed;  // what it would have cost if it were a real transaction
```

With an API key and a shared client:

```js
import { TronClient } from '@tronless/tron-client';
const client = new TronClient({ network: 'mainnet', apiKey: process.env.TRON_PRO_API_KEY });
await getUsdtBalance(holder, { client });
```

## How a constant call works

`triggerconstantcontract` takes four things: an `owner_address` (any address — nothing is charged to it), the `contract_address`, a `function_selector` such as `balanceOf(address)`, and a hex `parameter` of 32-byte ABI words. Addresses inside that parameter are the 20 raw bytes left-padded with zeros; the `41` prefix is dropped. The node executes the method against current state and returns the result in `constant_result[0]`, plus the `energy_used` it would have taken. Nothing is written, nothing is signed and no energy is actually consumed.

| Method | Selector | Returns |
|---|---|---|
| `balanceOf(address)` | `70a08231` | `uint256` raw units |
| `decimals()` | `313ce567` | `uint8` |
| `symbol()` / `name()` | `95d89b41` / `06fdde03` | `string` |
| `totalSupply()` | `18160ddd` | `uint256` |
| `allowance(address,address)` | `dd62ed3e` | `uint256` |

## API

| Function | Description |
|---|---|
| `getBalance(token, holder, options)` | Balance with `raw`, `decimals` and formatted `balance` |
| `getUsdtBalance(holder, options)` | Same, with USDT and decimals 6 preset (one request) |
| `getTokenInfo(token, options)` | name, symbol, decimals, total supply, explorer link |
| `getAllowance(token, owner, spender, options)` | Approved amount |
| `getBalances(tokens, holder, options)` | Several tokens, sequentially, errors captured per token |
| `callConstant(call)` | Any constant method, with ABI types in and out |
| `resolveContract(token, client)` | Symbol or address → contract address for the network |

TypeScript definitions are included.

## When this does not work

- **A balance is not spendable by itself.** Moving USDT needs energy; an address holding a million USDT and no energy still burns about 6.4 TRX per transfer. Check with [`@tronless/tron-account-resources`](../tron-account-resources).
- **Rate limits.** Each `getTokenInfo` is four calls and each `getBalance` two. Without `TRON_PRO_API_KEY` you get roughly three requests a second before a 5-second suspension.
- **Only static ABI types.** Arrays and tuples are out of scope; `address`, `uintN`, `intN`, `bool`, `bytesN` and `string` are supported.
- **`totalSupply` on some tokens is not circulating supply**, and old non-standard tokens may return `bytes32` for `name()` — that fallback is handled, but exotic contracts can still fail.
- **Symbols other than USDT are mainnet-only shortcuts.** On Nile and Shasta, pass the contract address.

## FAQ

### How do I get a USDT TRC-20 balance in Node.js?

`await getUsdtBalance('T…')` returns `{ balance: '452', raw: '452000000', decimals: 6 }`, or run `npx @tronless/trc20-token balance USDT <address>`. Under the hood it is a single `triggerconstantcontract` call to `balanceOf(address)` on `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`.

### Do I need a private key to read a balance?

No. Constant calls are executed locally by the node and thrown away; they need only an address to attribute the call to, and this package uses the contract's own address for that. Nothing is signed, nothing is charged.

### Why is the balance a string and not a number?

Because token amounts are integers of arbitrary size and JavaScript numbers stop being exact above 9,007,199,254,740,991. `raw` stays a string you can pass to `BigInt`, and `balance` is a formatted decimal string. See [`@tronless/tron-units`](../tron-units) for the arithmetic.

### Can I check balances for many addresses?

Yes, but pace them. Get a free TronGrid API key, pass it to a shared `TronClient`, and keep concurrency low — the built-in client already backs off correctly when the node reports a rate limit.

### Does this work on the Nile testnet?

Yes. Pass `--network nile`, and `USDT` resolves to the Nile test token `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf`. Shasta works the same way.

## Related tools

- [`@tronless/tron-address-watcher`](../tron-address-watcher) — get notified when that balance changes
- [`@tronless/trc20-decoder`](../trc20-decoder) — decode the calldata and events behind a transfer
- [`@tronless/tron-account-resources`](../tron-account-resources) — energy and bandwidth of the holder
- [`@tronless/tron-units`](../tron-units) — raw units ⇄ human amounts

## License

MIT © [TronLess](https://tronless.app)
