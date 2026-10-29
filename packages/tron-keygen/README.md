# Offline TRON wallet generator — `@tronless/tron-keygen`

[![npm](https://img.shields.io/npm/v/@tronless/tron-keygen)](https://www.npmjs.com/package/@tronless/tron-keygen) [![CI](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml/badge.svg)](https://github.com/TronLess/tron-tools/actions/workflows/tools-ci.yml) ![node](https://img.shields.io/badge/node-%3E%3D18.17-brightgreen) ![license](https://img.shields.io/badge/license-MIT-blue)

Generate TRON private keys, addresses and BIP-39 mnemonics without a network connection. Derivation follows `m/44'/195'/0'/0/n`, the same path TronLink, Ledger and `TronWeb.fromMnemonic` use, so a mnemonic generated here opens in any of them. Also finds vanity addresses.

**Part of [TronLess Tools](../../README.md)** — free, MIT-licensed TRON developer tools by [TronLess](https://tronless.app), the TRON energy rental service.

> **Security.** Everything runs locally with `crypto.randomBytes` — no key or mnemonic ever leaves the process. Still: generate production keys on a machine you trust, keep them out of shell history and CI logs, and treat anything printed to a terminal as compromised if that terminal is shared.

## Why

- **Compatible derivation.** SLIP-44 coin type 195, path `m/44'/195'/0'/0/0`. Verified in the test suite against `TronWeb.fromMnemonic` vectors.
- **Offline by construction.** No HTTP client is even imported, so an air-gapped machine works the same as a laptop.
- **Deterministic testing.** Derive 50 funded test accounts from one mnemonic in a test fixture, reproducibly.
- **Vanity search** with an honest estimate of how many keys you will have to try.

## Install

```bash
npm i @tronless/tron-keygen
```

## Quick start (CLI)

```bash
# a fresh random account
npx @tronless/tron-keygen

# address:     TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# hex:         41xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# private key: <64 hex chars>

# a 12-word mnemonic plus its first account
npx @tronless/tron-keygen --mnemonic

# 24 words instead
npx @tronless/tron-keygen --mnemonic --words 24

# derive five accounts from an existing mnemonic
npx @tronless/tron-keygen --from-mnemonic "test test test test test test test test test test test junk" --count 5

# what address does this private key control?
npx @tronless/tron-keygen --from-private-key 0000000000000000000000000000000000000000000000000000000000000001
# → TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC

# vanity address (prints keys/s while searching)
npx @tronless/tron-keygen --vanity TLess --ignore-case
```

Add `--json` for machine-readable output and `--no-warning` to silence the safety notice in scripts.

## Usage (JavaScript)

```js
import { createAccount, createMnemonicAccount, fromMnemonic, deriveAccounts, privateKeyToAddress } from '@tronless/tron-keygen';

const account = createAccount();
// { privateKey, publicKey, address: 'T…', hexAddress: '41…', evmAddress: '0x…' }

const wallet = createMnemonicAccount({ words: 12 });
// { mnemonic: 'word word …', address, privateKey, path: "m/44'/195'/0'/0/0", … }

// deterministic test fixtures
const MNEMONIC = 'test test test test test test test test test test test junk';
fromMnemonic(MNEMONIC).address;             // TWer2Ygk5TEheHp3TPuYeqxmB6SsGZmaL6
fromMnemonic(MNEMONIC, { index: 1 }).address; // TPjjvMwjPoDC32V2dGDYTkLH4E5LAtBZ6C
const ten = deriveAccounts(MNEMONIC, 10);

// recover an address from a key you already have
privateKeyToAddress('4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318');
// TE2H9hWjzYdwzDFRJfx9BFhr4MmjH1CHaz
```

A passphrase (BIP-39 "25th word") produces a completely different wallet:

```js
fromMnemonic(MNEMONIC, { passphrase: 'my-extra-secret' }).address; // different account
```

## Vanity addresses

```js
import { findVanityAddress, estimateVanityAttempts } from '@tronless/tron-keygen';

estimateVanityAttempts({ prefix: 'TABC' });   // ~195k keys on average
const hit = findVanityAddress({ prefix: 'TAB', onProgress: (n) => process.stderr.write(`${n}\r`) });
console.log(hit.address, hit.attempts);
```

Every TRON address starts with `T`, so that character is free. Each additional fixed character multiplies the work by about 58 (or about 34 with `caseSensitive: false`):

| Pattern | Average keys to try | Rough time at ~50k keys/s |
|---|---|---|
| `TA` | ~58 | instant |
| `TABC` | ~195,000 | a few seconds |
| `TLess` | ~11 million | minutes |
| `TLess` + 2-char suffix | ~37 billion | not on one laptop |

Base58 has no `0`, `O`, `I` or `l`, so patterns containing them are rejected immediately rather than searched forever.

## API

| Function | Description |
|---|---|
| `createAccount()` | Random account: private key, public key, all address forms |
| `generatePrivateKey()` | 32 random bytes, guaranteed inside the secp256k1 order |
| `privateKeyToAddress(pk)` / `privateKeyToPublicKey(pk, { compressed })` | Derivations from a key |
| `accountFromPrivateKey(pk)` | Full account object for an existing key |
| `generateMnemonic({ words })` | BIP-39 mnemonic: 12, 15, 18, 21 or 24 words |
| `isValidMnemonic(phrase)` | Checksum-aware validation |
| `fromMnemonic(phrase, { index, path, passphrase })` | Derive one account |
| `deriveAccounts(phrase, count, { startIndex })` | Derive a range |
| `createMnemonicAccount(options)` | New mnemonic plus its first account |
| `findVanityAddress(options)` / `estimateVanityAttempts(options)` | Vanity search and its cost |
| `TRON_DERIVATION_PATH`, `TRON_COIN_TYPE` | `m/44'/195'/0'/0`, `195` |

TypeScript definitions are included.

## When this does not work

- **It does not sign or broadcast transactions.** It produces keys and addresses; use `tronweb` for signing.
- **A generated address is not yet activated on-chain.** TRON accounts come into existence when they first receive funds; sending TRX to a fresh address burns 1 TRX for activation. Until then explorers show nothing.
- **Vanity search scales exponentially.** Anything past four or five fixed characters needs GPU tooling, not Node.js. The estimate function tells you before you start.
- **Multi-sig and permission-based accounts** are outside its scope: it deals with plain single-key accounts only.

## FAQ

### What derivation path does TRON use?

`m/44'/195'/0'/0/0` — SLIP-44 assigns coin type 195 to TRON. TronLink, Ledger Live and `TronWeb.fromMnemonic` all use it, so an account derived here at index 0 is the first account those wallets show for the same mnemonic. Later accounts are index 1, 2 and so on.

### Is generating a wallet in Node.js safe?

The randomness is, because `crypto.randomBytes` is a CSPRNG. The risk is the environment: shell history, terminal scrollback, a compromised dependency, or writing the key into a log. For meaningful amounts, generate on an offline machine and move the address out, never the key.

### Can I get the address of a private key I already have?

Yes: `privateKeyToAddress(hex)`, or `npx @tronless/tron-keygen --from-private-key <hex>`. The key is used locally to compute the public key and is never transmitted.

### Why does my mnemonic produce a different address than my wallet shows?

Three usual causes: a different account index, a BIP-39 passphrase set in the wallet, or a non-standard path. Pass `{ index }` or `{ path }` explicitly and compare against index 0 first.

### How long does a vanity address take?

About 58 attempts per fixed character after the leading `T`, so a four-character pattern averages around 195,000 keys — seconds on a laptop. Five characters is roughly 11 million, i.e. minutes. Use `estimateVanityAttempts` before committing to a pattern.

## Related tools

- [`@tronless/tron-address`](../tron-address) — validate and convert addresses between Base58, hex and 0x
- [`@tronless/tron-account-resources`](../tron-account-resources) — check whether an address is activated and how much energy it has
- [`@tronless/tron-address-watcher`](../tron-address-watcher) — watch generated deposit addresses for incoming USDT
- [`@tronless/tron-units`](../tron-units) — SUN ⇄ TRX and token decimals

## License

MIT © [TronLess](https://tronless.app)
