# TRON address validator and converter — `@tronless/tron-address`

[![npm](https://img.shields.io/npm/v/@tronless/tron-address)](https://www.npmjs.com/package/@tronless/tron-address) [![CI](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml/badge.svg)](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml) ![node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue)

Validate a TRON address and convert it between all three forms it appears in: Base58 (`TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`), TRON hex (`41a614f803b6fd780986a42c78ec9c7f77e6ded13c`) and EVM-style (`0xa614f803B6FD780986A42c78Ec9c7f77e6DeD13C`). Base58 addresses are checked against their real double-SHA-256 checksum, so a typo in a withdrawal form is caught before you sign anything.

**Part of [TronLess Tools](../../README.md)** — free, MIT-licensed TRON developer tools by [TronLess](https://tronless.app), the TRON energy rental service.

## Why

- **Real checksum validation.** A regex like `/^T[A-Za-z0-9]{33}$/` accepts `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u` — one character off from the USDT contract, and a total loss if a user pastes it. This library rejects it.
- **All three formats.** The same account is `T…` in wallets, `41…` in node responses and `0x…` in ABI-encoded parameters. Convert in any direction.
- **No `tronweb`.** One small dependency (`@noble/hashes`) instead of a 3 MB SDK with a full HTTP client attached.
- **Offline.** Nothing here touches the network, so it is safe in validation middleware, CI and browsers.

## Install

```bash
npm i @tronless/tron-address
```

Requires Node.js 18.17 or newer. Works in browsers and edge runtimes too.

## Quick start (CLI)

```bash
# validate and convert; exit code 1 if any address is invalid
npx @tronless/tron-address TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t

# TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
#   valid:    yes (base58)
#   base58:   TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
#   hex:      41a614f803b6fd780986a42c78ec9c7f77e6ded13c
#   evm:      0xa614f803B6FD780986A42c78Ec9c7f77e6DeD13C
#   explorer: https://tronscan.org/#/address/TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t

# one form only, for shell pipelines
npx @tronless/tron-address 41a614f803b6fd780986a42c78ec9c7f77e6ded13c --to base58

# machine-readable
npx @tronless/tron-address TR7NHqje... --json

# check a whole file of addresses, one per line
cat addresses.txt | npx @tronless/tron-address --stdin

# derive the address of a public key
npx @tronless/tron-address --public-key 0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8
```

## Usage (JavaScript)

```js
import { isValidAddress, isBase58Address, toBase58, toHex, toEvm, normalize, isSameAddress } from '@tronless/tron-address';

isValidAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');  // true
isValidAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u');  // false — bad checksum
isBase58Address('41a614f803b6fd780986a42c78ec9c7f77e6ded13c'); // false — hex, not Base58

toHex('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');  // '41a614f803b6fd780986a42c78ec9c7f77e6ded13c'
toBase58('0xa614f803B6FD780986A42c78Ec9c7f77e6DeD13C'); // 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
toEvm('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');  // '0xa614f803B6FD780986A42c78Ec9c7f77e6DeD13C' (EIP-55)

// compare addresses that arrived in different formats
isSameAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', '41a614f803b6fd780986a42c78ec9c7f77e6ded13c'); // true

normalize('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
// { input, format: 'base58', base58, hex, evm, evmLower, bytes: Uint8Array(21) }
```

Validating user input in an API:

```js
import { isBase58Address } from '@tronless/tron-address';

app.post('/withdraw', (req, res) => {
  if (!isBase58Address(req.body.to)) {
    return res.status(400).json({ error: 'Not a valid TRON address' });
  }
  // …
});
```

## The three address formats

| Form | Example | Where you see it |
|---|---|---|
| Base58Check | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | wallets, explorers, anything a human copies |
| TRON hex | `41a614f803b6fd780986a42c78ec9c7f77e6ded13c` | node responses when `visible` is false, protobuf |
| EVM / 0x | `0xa614f803B6FD780986A42c78Ec9c7f77e6DeD13C` | ABI-encoded call parameters, JSON-RPC, EVM tooling |

All three are the same 20 bytes. The Base58 form wraps them in a `0x41` prefix plus a 4-byte checksum — the first 4 bytes of `sha256(sha256(0x41 ‖ 20 bytes))` — which is what makes typos detectable. TRON addresses are always 34 characters and always start with `T`, and Base58 contains no `0`, `O`, `I` or `l`.

## API

| Function | Description |
|---|---|
| `isValidAddress(input, { formats })` | Validity in any (or only the listed) formats |
| `isBase58Address(input)` | Strict `T…` check with checksum — what withdrawal forms want |
| `detectFormat(input)` | `'base58'` \| `'hex'` \| `'evm'` \| `null` |
| `toBase58`, `toHex`, `toEvm(input, { checksum })` | Conversions; throw on invalid input |
| `normalize(input)` | All forms plus raw `bytes` at once |
| `isSameAddress(a, b)` | Format-agnostic comparison, `false` on invalid input |
| `fromPublicKey(key)` | Address from a 33-, 64- or 65-byte secp256k1 public key |
| `toChecksumEvm(lower)` | EIP-55 mixed-case checksum |
| `base58Encode`, `base58Decode` | Raw Base58 primitives |
| `explorerUrl(input, network)` | TronScan link for mainnet, Nile or Shasta |

TypeScript definitions are included.

## When this does not work

- It cannot tell whether an address is **activated** on-chain, holds a balance or is a contract. That needs a node — see [`@tronless/tron-account-resources`](../tron-account-resources).
- A valid EVM address from Ethereum converts cleanly to a TRON address, because the encoding is the same. That does **not** mean the same person controls it on both chains. Never assume cross-chain ownership from a conversion.
- Base58 validation catches typos, not malice: a checksum-valid address supplied by an attacker is still an attacker's address.

## FAQ

### How do I convert a TRON address to hex without tronweb?

`toHex('T…')` returns the `41…` form, and `toBase58('41…')` converts back. Both are pure functions with no network access, so they run in tests, browsers and edge functions where `tronweb` would be too heavy.

### Why does my address regex accept invalid addresses?

Because a regex only checks the alphabet and the length. The last 4 bytes of a TRON address are a double-SHA-256 checksum of the rest; without verifying it, a single mistyped character still matches the pattern. `isBase58Address` verifies the checksum, so `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u` is rejected.

### Is a TRON address the same as an Ethereum address?

Structurally, yes: both are the last 20 bytes of a keccak-256 hash of the public key. TRON prepends the byte `0x41` and encodes the result in Base58Check. That is why every TRON address has an equivalent `0x` form, which is what you pass inside ABI-encoded contract parameters.

### Can I derive an address from a private key with this package?

Not directly — this one only takes public keys, so it can stay free of signing code. Use [`@tronless/tron-keygen`](../tron-keygen) for private keys, mnemonics and offline wallet generation.

### Does it work in the browser?

Yes. The package is pure ESM with a single dependency (`@noble/hashes`) and no Node-specific APIs, so bundlers ship it as is.

## Related tools

- [`@tronless/tron-keygen`](../tron-keygen) — generate keys, mnemonics and vanity addresses offline
- [`@tronless/tron-units`](../tron-units) — SUN ⇄ TRX and TRC-20 decimals without rounding bugs
- [`@tronless/tron-account-resources`](../tron-account-resources) — energy, bandwidth and staking of an address
- [`@tronless/trc20-decoder`](../trc20-decoder) — decode TRC-20 calldata and events

## License

MIT © [TronLess](https://tronless.app)
