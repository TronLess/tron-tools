# SUN to TRX converter and TRC-20 amount formatter — `@tronless/tron-units`

[![npm](https://img.shields.io/npm/v/@tronless/tron-units)](https://www.npmjs.com/package/@tronless/tron-units) [![CI](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml/badge.svg)](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml) ![node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue)

1 TRX = 1,000,000 SUN, USDT TRC-20 has 6 decimals and USDD has 18. Get any of those conversions wrong by one zero and you send a hundred times too much. This package does them with BigInt, so `0.1 + 0.2` never becomes `0.30000000000000004` in a payout, and refuses silently-lossy input instead of rounding it away.

**Part of [TronLess Tools](../../README.md)** — free, MIT-licensed TRON developer tools by [TronLess](https://tronless.app), the TRON energy rental service.

## Why

- **BigInt end to end.** JavaScript numbers hold 53 bits of integer precision (up to 9,007,199,254,740,991). An 18-decimal token amount blows past that; a 6-decimal one survives until about 9 billion tokens. Both are handled exactly here.
- **Fails loudly.** `toSun('1.0000001')` throws instead of quietly truncating a user's amount. That is the behaviour you want between a form field and a signed transaction.
- **Token decimals built in.** USDT, USDC, USDD, WTRX, TUSD, BTT, JST, SUN and WIN are included with their mainnet contract addresses, and any other token works via `{ decimals }`.
- **Zero dependencies**, works in Node.js and the browser.

## Install

```bash
npm i @tronless/tron-units
```

## Quick start (CLI)

```bash
npx @tronless/tron-units 1.5 --to-sun        # 1500000
npx @tronless/tron-units 6428500 --from-sun  # 6.4285
npx @tronless/tron-units 12.5 --token USDT --raw   # 12500000
npx @tronless/tron-units 452000000 --token USDT    # 452
npx @tronless/tron-units 1000000000000000000 --decimals 18  # 1
npx @tronless/tron-units tokens              # list known mainnet tokens
```

## Usage (JavaScript)

```js
import { toSun, fromSun, formatTrx, parseToken, formatToken, formatTokenAmount, TOKENS } from '@tronless/tron-units';

toSun('1.5');            // 1500000n
toSun('0.000001');       // 1n         (the smallest unit of TRX)
fromSun(6428500n);       // '6.4285'   (a real USDT transfer fee)
formatTrx(6428500);      // '6.4285 TRX'

parseToken('12.5', 'USDT');        // 12500000n
formatToken(452000000n, 'USDT');   // '452'
formatTokenAmount(452000000n, 'USDT'); // '452 USDT'

// any token, by decimals
parseToken('1', { decimals: 18 });  // 1000000000000000000n
formatToken(5n, 2);                 // '0.05'

TOKENS.USDT; // { symbol:'USDT', decimals:6, address:'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', name:'Tether USD' }
```

Formatting options:

```js
import { formatUnits } from '@tronless/tron-units';

formatUnits(1500000n, 6);                      // '1.5'      trailing zeros trimmed
formatUnits(1500000n, 6, { trim: false });     // '1.500000'
formatUnits(1500000n, 6, { fixed: 2 });        // '1.50'
formatUnits(1234567000000n, 6, { thousands: true }); // '1,234,567'
```

BigInt does not survive `JSON.stringify` — the package ships the replacer for it:

```js
import { bigintReplacer } from '@tronless/tron-units';
JSON.stringify({ amount: 12500000n }, bigintReplacer); // '{"amount":"12500000"}'
```

## Units on TRON

| Unit | Value | Used for |
|---|---|---|
| SUN | 0.000001 TRX | every amount in node responses: `balance`, `amount`, `fee`, `energy_fee` |
| TRX | 1,000,000 SUN | what users see in wallets |
| Energy price | 100 SUN per unit | `getEnergyFee`, since the August 2025 reduction from 420 SUN |
| Bandwidth price | 1,000 SUN per byte | `getTransactionFee` |

TRC-20 amounts are separate: they use the token's own `decimals()` and have nothing to do with SUN. USDT and USDC use 6, USDD and TUSD use 18. Reading a token's decimals from the chain is one call — see [`@tronless/trc20-token`](../trc20-token).

## API

| Function | Description |
|---|---|
| `toSun(trx)` / `fromSun(sun, options)` | TRX ⇄ SUN; `fromSun` returns a string |
| `parseUnits(value, decimals)` | Human decimal → BigInt smallest unit; throws on excess precision |
| `formatUnits(raw, decimals, options)` | Smallest unit → decimal string; `trim`, `fixed`, `thousands` |
| `parseToken(value, token)` / `formatToken(raw, token)` | Same, by token symbol, decimals number, or `{ decimals }` |
| `formatTokenAmount(raw, token)` | `'452 USDT'` |
| `formatTrx(sun)` | `'6.4285 TRX'` |
| `sunToNumber(sun)` | Float, for display only |
| `resolveToken(token)` | Symbol / number / object → `{ symbol, decimals, address }` |
| `TOKENS`, `SUN_PER_TRX`, `TRX_DECIMALS` | Constants |
| `bigintReplacer` | `JSON.stringify` replacer for BigInt |

TypeScript definitions are included.

## When this does not work

- `parseUnits` rejects an amount with more decimals than the token allows rather than rounding it. If your UI lets people type `0.0000001` USDT, round it yourself first and decide explicitly whether that is up, down or an error.
- `sunToNumber` and any `Number(...)` conversion lose precision above 9,007,199,254,740,991 raw units. Keep BigInt all the way to the RPC call and only format at the edge.
- The bundled `TOKENS` list is a convenience for mainnet. On Nile and Shasta the same symbols have different contracts, so pass the address or decimals explicitly there.
- Token decimals are a property of each contract, not of the network. If you accept arbitrary tokens, read `decimals()` on-chain instead of guessing 6.

## FAQ

### How many SUN are in one TRX?

Exactly 1,000,000. So 1 SUN is 0.000001 TRX, and a 6.4285 TRX fee is 6,428,500 SUN — the number a node actually returns in the `fee` field of a transaction receipt.

### Why use BigInt instead of plain numbers?

Because token amounts are integers of arbitrary size and JavaScript numbers are floats. With 18 decimals, one whole token is 10^18 raw units, which is beyond the 53-bit exact-integer range; even at 6 decimals, arithmetic like `0.1 + 0.2` introduces error that ends up in a signed transaction. BigInt has no such failure mode.

### How many decimals does USDT TRC-20 have?

Six. So 452 USDT is `452000000` raw units, which is what the `transfer(address,uint256)` calldata carries. USDC also uses 6, while USDD and TUSD use 18 — always check the token rather than assuming.

### Does this package talk to the network?

No. It is pure arithmetic with zero dependencies, so it runs in tests, browsers and workers. To read real balances or a token's decimals from the chain, use [`@tronless/trc20-token`](../trc20-token).

### How do I format an amount for a UI without losing exactness?

Keep the raw BigInt in your data layer and call `formatUnits` only when rendering. Use `{ fixed: 2 }` for aligned columns and `{ thousands: true }` for large balances; the underlying value never changes.

## Related tools

- [`@tronless/trc20-token`](../trc20-token) — read balances, decimals and supply from the chain
- [`@tronless/tron-energy-calculator`](../tron-energy-calculator) — what a transfer costs in energy, bandwidth and TRX
- [`@tronless/tron-address`](../tron-address) — validate and convert TRON addresses
- [`@tronless/tron-tx-inspector`](../tron-tx-inspector) — fee breakdown for any transaction

## License

MIT © [TronLess](https://tronless.app)
