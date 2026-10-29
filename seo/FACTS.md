# Verified facts sheet for TronLess tools content (as of 2026-09-08)

Every number below was read from TRON mainnet on 2026-09-08 with the tools in this repo, or is a protocol constant.
Content (READMEs, blog posts, landing pages) must use these numbers or values computed from them. Anything else is an estimate and must be labelled as such.

## Network parameters (mainnet `wallet/getchainparameters`, 2026-09-08)

| Parameter | Value | Meaning |
|---|---|---|
| `getEnergyFee` | 100 SUN | price of 1 energy unit when burned (0.0001 TRX). Was 420 SUN until the August 2025 reduction |
| `getTransactionFee` | 1000 SUN | price of 1 byte of bandwidth when burned (0.001 TRX) |
| `getFreeNetLimit` | 600 | free bandwidth per address per day |
| `getMemoFee` | 1,000,000 SUN | 1 TRX for a transaction memo (`data` field) |
| `getCreateNewAccountFeeInSystemContract` | 1,000,000 SUN | 1 TRX burned when a TRX transfer activates a new account |
| `getCreateAccountFee` | 100,000 SUN | extra 0.1 TRX when that activation also burns bandwidth |
| `getTotalEnergyLimit` / `getTotalEnergyCurrentLimit` | 180,000,000,000 | energy the whole network gets per day |
| `getTotalNetLimit` | 43,200,000,000 | bandwidth the whole network gets per day |
| `getMaxFeeLimit` | 15,000,000,000 SUN | 15,000 TRX max fee_limit |
| Energy per staked TRX per day | ≈ 9.6 | `TotalEnergyLimit / TotalEnergyWeight` from `getaccountresource` on 2026-09-08 (≈ 18.75 B TRX staked for energy network-wide) |
| Block time | 3 s | protocol constant |
| Block height | 86,060,680 | at 2026-09-08 07:50 UTC |

## A real USDT TRC-20 transfer receipt (mainnet)

Transaction `b86bfe8c777cd3419c22dd254763d157ee35146b410540c9f7c2864e283ef415`, block 86,060,671, 2026-09-08 07:50:09 UTC:

- 452 USDT from `TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5` to `TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu`
- `energy_usage_total` 64,285 (includes `energy_penalty_total` 49,635 from the dynamic energy model on the USDT contract)
- `net_usage` 345 bytes (covered by free bandwidth → 0 TRX)
- `fee` 6,428,500 SUN = **6.4285 TRX** (64,285 × 100 SUN), sender had no energy
- `fee_limit` 60,000,000 SUN (60 TRX) — the wallet's default cap
- calldata: `a9059cbb` + recipient (20 bytes, left-padded) + amount `0x1af0f900` = 452,000,000 raw units

## Derived planning figures

- USDT transfer to an address that already holds USDT: ≈ 65,000 energy (64,285 observed) → ≈ 6.43–6.5 TRX burned
- USDT transfer to an address that has never held USDT: ≈ 130,000–131,000 energy → ≈ 13.0–13.1 TRX burned (new storage slot)
- Bandwidth for a TRC-20 transfer ≈ 345 bytes; plain TRX transfer ≈ 268 bytes; 600 free bytes/day cover one of either
- Renting 65,000 energy on the market costs about 2–3 TRX (TronLess and competitors, Aug 2026) → ≈ 64% cheaper than burning at 6.43 TRX
- Staking for 65,000 energy/day at 9.6 energy per TRX ≈ 6,800 TRX locked (unstaking takes 14 days)
- 100 USDT transfers/day: burning ≈ 19,286 TRX/month; renting at 2.3 TRX ≈ 6,900 TRX/month; saving ≈ 12,386 TRX/month

## Addresses and formats

- Base58 address: 34 chars, starts with `T`, checksum = first 4 bytes of sha256(sha256(0x41 + 20-byte hash))
- Hex form: `41` + 40 hex chars; EVM/0x form: same 20 bytes with `0x` (EIP-55 checksum optional)
- USDT TRC-20 contract: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` = `41a614f803b6fd780986a42c78ec9c7f77e6ded13c` = `0xa614f803B6FD780986A42c78Ec9c7f77e6DeD13C`; decimals 6; on-chain `totalSupply()` on 2026-09-08 = 94,268,087,063.644158 USDT
- USDC `TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8` (6), USDD `TPYmHEhy5n8TCEfYGqW2rPxsghSfzghPDn` (18), WTRX `TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR` (6)
- 1 TRX = 1,000,000 SUN
- Derivation path (TronLink, Ledger, TronWeb): `m/44'/195'/0'/0/0` — SLIP-44 coin type 195
- Test vector: private key `0000…0001` → `TMVQGm1qAQYVdetCeGRRkTWYYrLXuHK2HC`; mnemonic `test test test test test test test test test test test junk` → `TWer2Ygk5TEheHp3TPuYeqxmB6SsGZmaL6` (index 0), `TPjjvMwjPoDC32V2dGDYTkLH4E5LAtBZ6C` (index 1)
- Selectors: `transfer` a9059cbb, `approve` 095ea7b3, `transferFrom` 23b872dd, `balanceOf` 70a08231; `Transfer` event topic ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef

## Endpoints

- Mainnet: https://api.trongrid.io (HTTP + /jsonrpc), https://api.tronstack.io, https://tron-rpc.publicnode.com/jsonrpc
- Nile testnet: https://nile.trongrid.io — USDT test token `TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf`
- Shasta testnet: https://api.shasta.trongrid.io — USDT test token `TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs`
- TronGrid without API key: ~3 requests/s, then "query server is suspended for 5 s". Header `TRON-PRO-API-KEY` lifts it.
- Measured 2026-09-08 from Europe: TronGrid HTTP ≈ 270 ms, TronGrid JSON-RPC ≈ 190 ms, TronStack ≈ 850 ms, PublicNode JSON-RPC ≈ 110 ms. Ankr's public TRON JSON-RPC now returns 403 without a key.

## TronLess

- Product: energy rental for TRON — Telegram bot `@tronless_bot`, site https://tronless.app, API docs https://tronless.app/api
- Existing pages to link: https://tronless.app/tron-energy, https://tronless.app/usdt-trc20-transfer-fee, https://tronless.app/tron-energy-vs-trx, https://tronless.app/blog/how-to-reduce-usdt-trc20-fee (EN), https://tronless.app/blog/kak-snizit-komissiyu-usdt-trc20 (RU)
- Tools repo: https://github.com/TronLess/tron-tools/tree/main — npm scope `@tronless`
