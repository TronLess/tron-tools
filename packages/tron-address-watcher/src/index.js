/**
 * @tronless/tron-address-watcher
 * Poll TronGrid for TRC-20 and TRX transfers touching a set of addresses.
 *
 * Uses the TronGrid v1 account endpoints, so it works on mainnet, Nile and Shasta without a node:
 *   GET /v1/accounts/{address}/transactions/trc20   (TRC-20 transfers)
 *   GET /v1/accounts/{address}/transactions         (TRX transfers = TransferContract)
 */
import { EventEmitter } from 'node:events';
import { TronClient } from '@tronless/tron-client';
import { toBase58, isValidAddress, isSameAddress } from '@tronless/tron-address';
import { formatUnits, fromSun, TOKENS } from '@tronless/tron-units';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resolveContractFilter(contracts, client) {
  if (!contracts || contracts.length === 0) return null;
  return contracts.map((c) => {
    if (isValidAddress(c)) return toBase58(c);
    const sym = String(c).toUpperCase();
    if (sym === 'USDT') return (client.preset || {}).usdt || TOKENS.USDT.address;
    if (TOKENS[sym]?.address) return TOKENS[sym].address;
    throw new Error(`Unknown token "${c}" — pass a contract address`);
  });
}

/**
 * Fetch TRC-20 transfers for one address since a timestamp (ms). Follows pagination.
 * @returns {Promise<Array<object>>} normalized transfers, oldest first
 */
export async function fetchTrc20Transfers(address, options = {}) {
  const client = options.client || new TronClient({ network: options.network || 'mainnet' });
  const addr = toBase58(address);
  const contracts = resolveContractFilter(options.contracts, client);
  const limit = Math.min(200, options.limit || 200);
  const maxPages = options.maxPages ?? 5;
  const out = [];
  // TronGrid filters by a single contract_address; loop when several are requested.
  const contractList = contracts || [null];
  for (const contract of contractList) {
    let fingerprint;
    for (let page = 0; page < maxPages; page += 1) {
      const res = await client.v1(`accounts/${addr}/transactions/trc20`, {
        limit,
        only_confirmed: options.onlyConfirmed !== false ? true : undefined,
        min_timestamp: options.since ?? undefined,
        max_timestamp: options.until ?? undefined,
        order_by: 'block_timestamp,asc',
        contract_address: contract || undefined,
        fingerprint,
      });
      for (const item of res?.data || []) out.push(normalizeTrc20(item, addr));
      fingerprint = res?.meta?.fingerprint;
      if (!fingerprint || (res?.data || []).length < limit) break;
    }
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

function normalizeTrc20(item, watched) {
  const token = item.token_info || {};
  const decimals = Number(token.decimals ?? 6);
  const from = safe58(item.from);
  const to = safe58(item.to);
  return {
    kind: 'TRC20',
    txid: item.transaction_id,
    address: watched,
    direction: isSameAddress(to, watched) ? 'in' : 'out',
    from,
    to,
    token: { address: safe58(token.address), symbol: token.symbol || null, name: token.name || null, decimals },
    amountRaw: String(item.value),
    amount: formatUnits(item.value, decimals),
    timestamp: Number(item.block_timestamp),
    time: new Date(Number(item.block_timestamp)).toISOString(),
    type: item.type || 'Transfer',
  };
}

/** Fetch plain TRX transfers (TransferContract) for one address since a timestamp (ms). */
export async function fetchTrxTransfers(address, options = {}) {
  const client = options.client || new TronClient({ network: options.network || 'mainnet' });
  const addr = toBase58(address);
  const limit = Math.min(200, options.limit || 200);
  const maxPages = options.maxPages ?? 5;
  const out = [];
  let fingerprint;
  for (let page = 0; page < maxPages; page += 1) {
    const res = await client.v1(`accounts/${addr}/transactions`, {
      limit,
      only_confirmed: options.onlyConfirmed !== false ? true : undefined,
      min_timestamp: options.since ?? undefined,
      max_timestamp: options.until ?? undefined,
      order_by: 'block_timestamp,asc',
      fingerprint,
    });
    for (const tx of res?.data || []) {
      const c = tx.raw_data?.contract?.[0];
      if (!c || c.type !== 'TransferContract') continue;
      if (tx.ret?.[0]?.contractRet && tx.ret[0].contractRet !== 'SUCCESS') continue;
      const v = c.parameter?.value || {};
      const from = safe58(v.owner_address);
      const to = safe58(v.to_address);
      out.push({
        kind: 'TRX',
        txid: tx.txID,
        address: addr,
        direction: isSameAddress(to, addr) ? 'in' : 'out',
        from,
        to,
        token: { address: null, symbol: 'TRX', name: 'TRON', decimals: 6 },
        amountRaw: String(v.amount),
        amount: fromSun(v.amount),
        timestamp: Number(tx.block_timestamp),
        time: new Date(Number(tx.block_timestamp)).toISOString(),
        type: 'Transfer',
      });
    }
    fingerprint = res?.meta?.fingerprint;
    if (!fingerprint || (res?.data || []).length < limit) break;
  }
  return out.sort((a, b) => a.timestamp - b.timestamp);
}

function safe58(a) {
  try {
    return toBase58(a);
  } catch {
    return a;
  }
}

/**
 * Long-running watcher. Emits:
 *   'transfer' (transfer)      — every new TRC-20 / TRX transfer
 *   'poll'     ({address, count, at}) — after each address poll
 *   'error'    (error)         — network errors (watcher keeps running)
 *   'webhook'  ({ok, status, transfer}) — after each webhook delivery attempt
 */
export class AddressWatcher extends EventEmitter {
  /**
   * @param {{
   *   addresses: string[],
   *   client?: TronClient, network?: string,
   *   pollIntervalMs?: number, delayBetweenAddressesMs?: number,
   *   trc20?: boolean, trx?: boolean, contracts?: string[],
   *   direction?: 'in'|'out'|'both',
   *   since?: number, onlyConfirmed?: boolean,
   *   webhookUrl?: string, webhookHeaders?: Record<string,string>, fetch?: typeof fetch,
   *   maxSeen?: number,
   * }} options
   */
  constructor(options) {
    super();
    if (!options || !Array.isArray(options.addresses) || options.addresses.length === 0) {
      throw new Error('AddressWatcher needs at least one address');
    }
    for (const a of options.addresses) if (!isValidAddress(a)) throw new Error(`Invalid TRON address: ${a}`);
    this.addresses = options.addresses.map(toBase58);
    this.client = options.client || new TronClient({ network: options.network || 'mainnet' });
    this.pollIntervalMs = options.pollIntervalMs ?? 10_000;
    this.delayBetweenAddressesMs = options.delayBetweenAddressesMs ?? 400;
    this.trc20 = options.trc20 !== false;
    this.trx = options.trx !== false;
    this.contracts = options.contracts;
    this.direction = options.direction || 'both';
    this.onlyConfirmed = options.onlyConfirmed !== false;
    this.webhookUrl = options.webhookUrl || null;
    this.webhookHeaders = options.webhookHeaders || {};
    this._fetch = options.fetch || globalThis.fetch;
    this.maxSeen = options.maxSeen ?? 10_000;
    this.cursor = new Map(this.addresses.map((a) => [a, options.since ?? Date.now()]));
    this.seen = new Set();
    this._seenOrder = [];
    this.running = false;
    this._timer = null;
  }

  /** Start polling. Resolves immediately; use events. */
  start() {
    if (this.running) return this;
    this.running = true;
    const loop = async () => {
      if (!this.running) return;
      try {
        await this.pollOnce();
      } catch (err) {
        this.emit('error', err);
      }
      if (this.running) this._timer = setTimeout(loop, this.pollIntervalMs);
    };
    loop();
    return this;
  }

  stop() {
    this.running = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
    return this;
  }

  /** One poll pass over all addresses. Returns the new transfers found. */
  async pollOnce() {
    const found = [];
    for (let i = 0; i < this.addresses.length; i += 1) {
      const address = this.addresses[i];
      const since = this.cursor.get(address);
      const opts = { client: this.client, since, onlyConfirmed: this.onlyConfirmed };
      let transfers = [];
      try {
        if (this.trc20) transfers = transfers.concat(await fetchTrc20Transfers(address, { ...opts, contracts: this.contracts }));
        if (this.trx) transfers = transfers.concat(await fetchTrxTransfers(address, opts));
      } catch (err) {
        this.emit('error', err);
        continue;
      }
      transfers.sort((a, b) => a.timestamp - b.timestamp);
      let newest = since;
      for (const t of transfers) {
        newest = Math.max(newest, t.timestamp);
        if (this.direction !== 'both' && t.direction !== this.direction) continue;
        const key = `${t.txid}:${t.address}:${t.kind}:${t.token.address || 'TRX'}:${t.amountRaw}`;
        if (this.seen.has(key)) continue;
        this._remember(key);
        found.push(t);
        this.emit('transfer', t);
        if (this.webhookUrl) await this._deliver(t);
      }
      // TronGrid min_timestamp is inclusive; keep the cursor on the newest block so same-block
      // transfers are re-fetched and de-duplicated via `seen` instead of being skipped.
      this.cursor.set(address, newest);
      this.emit('poll', { address, count: transfers.length, at: Date.now() });
      if (i < this.addresses.length - 1 && this.delayBetweenAddressesMs) await sleep(this.delayBetweenAddressesMs);
    }
    return found;
  }

  _remember(key) {
    this.seen.add(key);
    this._seenOrder.push(key);
    while (this._seenOrder.length > this.maxSeen) this.seen.delete(this._seenOrder.shift());
  }

  async _deliver(transfer) {
    try {
      const res = await this._fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tronless-event': 'transfer', ...this.webhookHeaders },
        body: JSON.stringify({ event: 'transfer', network: this.client.network, transfer }),
      });
      this.emit('webhook', { ok: res.ok, status: res.status, transfer });
    } catch (err) {
      this.emit('webhook', { ok: false, status: 0, transfer, error: err.message });
    }
  }
}

/** Shorthand: create + start a watcher with an `onTransfer` callback. */
export function watchAddresses(addresses, options = {}) {
  const w = new AddressWatcher({ ...options, addresses });
  if (options.onTransfer) w.on('transfer', options.onTransfer);
  if (options.onError) w.on('error', options.onError);
  return w.start();
}

export default { AddressWatcher, watchAddresses, fetchTrc20Transfers, fetchTrxTransfers };
