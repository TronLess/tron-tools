# Decode TRC-20 transactions, calldata and event logs — `@tronless/trc20-decoder`

[![npm](https://img.shields.io/npm/v/@tronless/trc20-decoder)](https://www.npmjs.com/package/@tronless/trc20-decoder) [![CI](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml/badge.svg)](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml) ![node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue)

Turn `a9059cbb000000000000000000000000b80ea17f…01af0f900` into `transfer(to: TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu, value: 452000000)` — no ABI file, no `tronweb`, no network call. Also decodes `Transfer` and `Approval` event logs, whole transaction objects from `gettransactionbyid`, and encodes calldata when you need to build a call.

**Part of [TronLess Tools](../../README.md)** — free, MIT-licensed TRON developer tools by [TronLess](https://tronless.app), the TRON energy rental service.

## Why

- **No ABI needed.** Two dozen standard TRC-20 selectors are built in, keyed by their real keccak-256 prefix. Unknown selectors decode too, once you pass a signature.
- **Addresses come out in TRON form.** An ABI word holds 20 raw bytes; this converts them to `T…` Base58 with the `41` prefix restored, which is what you want in a log or a database.
- **Whole transactions.** `TransferContract`, `TransferAssetContract` and `TriggerSmartContract` are normalized into one shape with sender, recipient, amount, memo and result.
- **Encoding too**, so the same package builds the `parameter` field for a read-only `triggerconstantcontract` call.

## Install

```bash
npm i @tronless/trc20-decoder
```

## Quick start (CLI)

```bash
# decode calldata
npx @tronless/trc20-decoder a9059cbb000000000000000000000000b80ea17fb9e827efd08c34b0e59a53b7a8506210000000000000000000000000000000000000000000000000000000001af0f900

# transfer(address,uint256)
#   to (address): TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu / 41b80ea17fb9e827efd08c34b0e59a53b7a8506210
#   value (uint256): 452000000

# fetch and decode a whole transaction with its events
npx @tronless/trc20-decoder --tx b86bfe8c777cd3419c22dd254763d157ee35146b410540c9f7c2864e283ef415

# compute a selector or an event topic
npx @tronless/trc20-decoder --selector "transfer(address,uint256)"        # a9059cbb
npx @tronless/trc20-decoder --topic "Transfer(address,address,uint256)"   # ddf252ad…

# build transfer() calldata
npx @tronless/trc20-decoder --encode-transfer TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu 452000000

# an unknown method
npx @tronless/trc20-decoder 0xdeadbeef0000… --signature "myMethod(address,uint256)"

# every selector this package knows
npx @tronless/trc20-decoder --list
```

## Usage (JavaScript)

```js
import { decodeInput, decodeEventLog, decodeTransaction, decodeTransactionById, encodeTransfer, selector } from '@tronless/trc20-decoder';

const call = decodeInput('a9059cbb000000000000000000000000b80ea17f…01af0f900');
call.name;   // 'transfer'
call.to;     // 'TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu'
call.value;  // '452000000'  (raw units — 452 USDT at 6 decimals)

// an event log exactly as gettransactioninfobyid returns it
const event = decodeEventLog({
  address: 'a614f803b6fd780986a42c78ec9c7f77e6ded13c',
  topics: ['ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', '000…09b', '000…210'],
  data: '000000000000000000000000000000000000000000000000000000001af0f900',
});
event.name;     // 'Transfer'
event.from;     // 'TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5'
event.contract; // 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

// one call: fetch a transaction and decode calldata + logs
const { transaction, events } = await decodeTransactionById('b86bfe8c…3ef415');

// encoding
encodeTransfer('TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu', 452_000_000n); // 'a9059cbb…'
selector('balanceOf(address)');                                      // '70a08231'
```

## Anatomy of TRC-20 calldata

`transfer(address,uint256)` calldata is always 4 + 32 + 32 bytes:

| Part | Bytes | Example | Meaning |
|---|---|---|---|
| selector | 4 | `a9059cbb` | first 4 bytes of `keccak256("transfer(address,uint256)")` |
| recipient | 32 | `000…000b80ea17f…6210` | 12 zero bytes then the 20-byte address; the `41` prefix is dropped |
| amount | 32 | `000…01af0f900` | `uint256` in the token's smallest unit: `0x1af0f900` = 452,000,000 = 452 USDT |

Event logs work the same way: `topics[0]` is the full keccak-256 of the event signature, indexed parameters occupy the remaining topics, and everything else is packed into `data`.

## Known selectors

`transfer`, `approve`, `transferFrom`, `balanceOf`, `allowance`, `totalSupply`, `decimals`, `name`, `symbol`, `mint` (both forms), `burn`, `burnFrom`, `increaseAllowance`, `decreaseAllowance`, `owner`, `transferOwnership`, `paused`, `pause`, `unpause`, `addBlackList`, `removeBlackList`, `getBlackListStatus`, `deposit`, `withdraw`. Events: `Transfer`, `Approval`, `OwnershipTransferred`, `Paused`, `Unpaused`.

Every one of them is verified in the test suite by recomputing its keccak-256 hash, so the table cannot drift.

## API

| Function | Description |
|---|---|
| `decodeInput(hex, { signature })` | Calldata → `{ name, signature, args, to, value, … }` |
| `decodeEventLog(log)` | One log entry → named arguments with Base58 addresses |
| `decodeTransaction(tx)` | `gettransactionbyid` object → normalized summary |
| `decodeTransactionInfoLogs(info)` | All logs of a `gettransactioninfobyid` response |
| `decodeTransactionById(txid, options)` | Fetch both and decode in one call |
| `encodeCall(signature, values)` / `encodeTransfer(to, amount)` | Build calldata |
| `encodeParameters(types, values)` / `decodeParameters(types, hex)` | ABI words without a selector |
| `selector(sig)` / `eventTopic(sig)` / `keccakHex(text)` | Hashing primitives |
| `FUNCTIONS`, `EVENTS` | The built-in tables |

TypeScript definitions are included.

## When this does not work

- **Arrays and tuples are not supported.** The decoder handles `address`, `uintN`, `intN`, `bool`, `bytesN`, `string` and `bytes` — enough for every standard TRC-20 method, not enough for a DEX router. Use a full ABI decoder there.
- **Unknown selectors need a signature.** There is no 4-byte directory lookup, because that would mean a network call and an unverifiable answer. Pass `--signature` when you know it.
- **A decoded `Transfer` is not a settled transfer.** Always check that the transaction succeeded and is confirmed — [`@tronless/tron-tx-inspector`](../tron-tx-inspector) does both.
- **Raw amounts are not human amounts.** `452000000` is 452 USDT only because USDT has 6 decimals. Convert with [`@tronless/tron-units`](../tron-units).

## FAQ

### How do I decode TRC-20 transaction input data?

Pass the `data` field of the `TriggerSmartContract` parameter to `decodeInput`. It reads the 4-byte selector, looks the signature up, and returns typed arguments with addresses already converted to Base58. On the command line it is one `npx @tronless/trc20-decoder <hex>`.

### What is the selector a9059cbb?

The first four bytes of `keccak256("transfer(address,uint256)")` — the standard ERC-20 and TRC-20 transfer method. If a transaction's calldata starts with it, someone is moving tokens. `approve` is `095ea7b3` and `transferFrom` is `23b872dd`.

### Why does the address in the calldata have no 41 prefix?

ABI encoding stores an address as 20 raw bytes padded to 32. TRON's `41` prefix belongs to the address encoding, not the ABI, so it is stripped on the way in and restored on the way out. This package does that for you, which is why the decoded value is a valid `T…` address.

### Can I decode logs returned by TronGrid's event API?

Yes. `decodeEventLog` accepts both shapes: the raw `log[]` entries from `gettransactioninfobyid` (contract address as 40 hex chars) and Base58 addresses. Unknown topics come back with `known: false` and the raw data intact.

### Does it need a network connection?

Only `decodeTransactionById`, which fetches the transaction for you. Everything else — calldata, logs, selectors, encoding — is offline and runs anywhere.

## Related tools

- [`@tronless/tron-tx-inspector`](../tron-tx-inspector) — status, events and fee breakdown for a transaction hash
- [`@tronless/trc20-token`](../trc20-token) — call `balanceOf`, `decimals` and friends without a key
- [`@tronless/tron-units`](../tron-units) — raw units ⇄ human amounts
- [`@tronless/tron-address`](../tron-address) — address validation and conversion

## License

MIT © [TronLess](https://tronless.app)
