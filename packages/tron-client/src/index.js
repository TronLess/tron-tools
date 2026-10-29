/**
 * @tronless/tron-client
 * Minimal HTTP client for TRON full nodes and TronGrid.
 *
 * - Network presets: mainnet, nile, shasta (override with `fullNode`)
 * - Sends `TRON-PRO-API-KEY` when an API key is provided (or TRON_PRO_API_KEY env)
 * - Timeout per request, retry with backoff on 429 / 5xx / TronGrid "rate exceeded" bodies
 * - Injectable `fetch` for tests
 */

export const NETWORKS = Object.freeze({
  mainnet: Object.freeze({
    name: 'mainnet',
    fullNode: 'https://api.trongrid.io',
    explorer: 'https://tronscan.org',
    usdt: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  }),
  nile: Object.freeze({
    name: 'nile',
    fullNode: 'https://nile.trongrid.io',
    explorer: 'https://nile.tronscan.org',
    // Widely used USDT test token on Nile. Verify before relying on it.
    usdt: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
  }),
  shasta: Object.freeze({
    name: 'shasta',
    fullNode: 'https://api.shasta.trongrid.io',
    explorer: 'https://shasta.tronscan.org',
    // Widely used USDT test token on Shasta. Verify before relying on it.
    usdt: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs',
  }),
});

export class TronClientError extends Error {
  /**
   * @param {string} message
   * @param {{status?: number, body?: unknown, url?: string, cause?: unknown}} [info]
   */
  constructor(message, info = {}) {
    super(message);
    this.name = 'TronClientError';
    this.status = info.status;
    this.body = info.body;
    this.url = info.url;
    if (info.cause) this.cause = info.cause;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isBase58Address(value) {
  return typeof value === 'string' && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value);
}

function looksRateLimited(body) {
  if (!body || typeof body !== 'object') return false;
  const msg = String(body.Error || body.error || '');
  return /rate|quota|too many/i.test(msg);
}

function suspendedSeconds(body) {
  if (!body || typeof body !== 'object') return 0;
  const m = /suspended for (\d+) ?s/i.exec(String(body.Error || body.error || ''));
  return m ? Number(m[1]) : 0;
}

export class TronClient {
  /**
   * @param {{
   *   network?: 'mainnet'|'nile'|'shasta',
   *   fullNode?: string,
   *   apiKey?: string,
   *   timeoutMs?: number,
   *   retries?: number,
   *   retryDelayMs?: number,
   *   headers?: Record<string,string>,
   *   fetch?: typeof fetch,
   * }} [options]
   */
  constructor(options = {}) {
    const preset = NETWORKS[options.network || 'mainnet'];
    if (!preset && !options.fullNode) {
      throw new TronClientError(`Unknown network "${options.network}". Use mainnet, nile, shasta or pass fullNode.`);
    }
    this.network = preset ? preset.name : 'custom';
    this.baseUrl = String(options.fullNode || preset.fullNode).replace(/\/+$/, '');
    this.explorer = preset ? preset.explorer : null;
    this.apiKey = options.apiKey ?? process.env.TRON_PRO_API_KEY ?? '';
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.retries = options.retries ?? 2;
    this.retryDelayMs = options.retryDelayMs ?? 1000;
    this.extraHeaders = options.headers || {};
    this._fetch = options.fetch || globalThis.fetch;
    if (typeof this._fetch !== 'function') {
      throw new TronClientError('No fetch implementation available. Use Node.js 18+ or pass { fetch }.');
    }
  }

  /** Preset info for the current network (null for custom nodes). */
  get preset() {
    return NETWORKS[this.network] || null;
  }

  /**
   * Low-level request with timeout and retry.
   * @param {'GET'|'POST'} method
   * @param {string} path e.g. "/wallet/getnowblock" or "/v1/accounts/T.../transactions"
   * @param {{body?: object, query?: Record<string, string|number|boolean|undefined>}} [opts]
   */
  async request(method, path, opts = {}) {
    const url = new URL(path ? this.baseUrl + (path.startsWith('/') ? path : `/${path}`) : this.baseUrl);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v === undefined || v === null || v === '') continue;
        url.searchParams.set(k, String(v));
      }
    }
    const headers = { accept: 'application/json', ...this.extraHeaders };
    if (this.apiKey) headers['TRON-PRO-API-KEY'] = this.apiKey;
    let bodyText;
    if (opts.body !== undefined) {
      headers['content-type'] = 'application/json';
      bodyText = JSON.stringify(opts.body);
    }

    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this._fetch(url.toString(), {
          method,
          headers,
          body: bodyText,
          signal: controller.signal,
        });
        const text = await res.text();
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }
        const retryable = res.status === 429 || res.status >= 500 || looksRateLimited(json);
        if (retryable && attempt < this.retries) {
          const retryAfter = Number(res.headers?.get?.('retry-after')) || 0;
          // TronGrid: "request rate exceeded ... the query server is suspended for 5 s"
          const suspended = suspendedSeconds(json);
          await sleep(retryAfter ? retryAfter * 1000 : suspended ? suspended * 1000 + 500 : this.retryDelayMs * 2 ** attempt);
          continue;
        }
        if (!res.ok || looksRateLimited(json)) {
          throw new TronClientError(
            `TRON API ${method} ${url.pathname} failed with status ${res.status}: ${
              (json && (json.Error || json.error || json.message)) || text.slice(0, 200)
            }`,
            { status: res.status, body: json ?? text, url: url.toString() },
          );
        }
        if (json === null && text) {
          throw new TronClientError(`TRON API returned non-JSON body for ${url.pathname}`, {
            status: res.status,
            body: text,
            url: url.toString(),
          });
        }
        return json;
      } catch (err) {
        if (err instanceof TronClientError) throw err;
        lastError = err;
        const aborted = err && (err.name === 'AbortError' || err.code === 'ABORT_ERR');
        if (attempt < this.retries) {
          await sleep(this.retryDelayMs * 2 ** attempt);
          continue;
        }
        throw new TronClientError(
          aborted
            ? `TRON API request timed out after ${this.timeoutMs} ms: ${url}`
            : `TRON API request failed: ${err.message}`,
          { url: url.toString(), cause: err },
        );
      } finally {
        clearTimeout(timer);
      }
    }
    throw new TronClientError(`TRON API request failed: ${lastError?.message || 'unknown error'}`, {
      url: url.toString(),
      cause: lastError,
    });
  }

  get(path, query) {
    return this.request('GET', path, { query });
  }

  post(path, body) {
    return this.request('POST', path, { body });
  }

  // ---- Full node HTTP API helpers (https://developers.tron.network/reference) ----

  /** GET /wallet/getnowblock */
  getNowBlock() {
    return this.get('/wallet/getnowblock');
  }

  /** GET /wallet/getchainparameters → { chainParameter: [{key, value}] } */
  getChainParameters() {
    return this.get('/wallet/getchainparameters');
  }

  /** Chain parameters as a plain object { getEnergyFee: 100, ... } */
  async getChainParametersMap() {
    const res = await this.getChainParameters();
    const out = {};
    for (const p of res?.chainParameter || []) out[p.key] = p.value ?? 0;
    return out;
  }

  /** POST /wallet/getaccount */
  getAccount(address) {
    return this.post('/wallet/getaccount', { address, visible: isBase58Address(address) });
  }

  /** POST /wallet/getaccountresource */
  getAccountResource(address) {
    return this.post('/wallet/getaccountresource', { address, visible: isBase58Address(address) });
  }

  /** POST /wallet/gettransactionbyid */
  getTransactionById(txid) {
    return this.post('/wallet/gettransactionbyid', { value: txid, visible: true });
  }

  /** POST /wallet/gettransactioninfobyid */
  getTransactionInfoById(txid) {
    return this.post('/wallet/gettransactioninfobyid', { value: txid });
  }

  /** POST /wallet/getblockbynum */
  getBlockByNum(num) {
    return this.post('/wallet/getblockbynum', { num, visible: true });
  }

  /**
   * POST /wallet/triggerconstantcontract — read-only contract call, no key needed.
   * @param {{ownerAddress?: string, contractAddress: string, functionSelector: string, parameter?: string}} call
   */
  triggerConstantContract(call) {
    const owner = call.ownerAddress || call.contractAddress;
    return this.post('/wallet/triggerconstantcontract', {
      owner_address: owner,
      contract_address: call.contractAddress,
      function_selector: call.functionSelector,
      parameter: call.parameter || '',
      visible: isBase58Address(call.contractAddress),
    });
  }

  /** GET /v1/... TronGrid extension API (accounts, contracts, events). */
  v1(path, query) {
    return this.get(path.startsWith('/v1') ? path : `/v1/${path.replace(/^\/+/, '')}`, query);
  }

  /** Link to a transaction on the matching explorer, or null for custom nodes. */
  explorerTx(txid) {
    return this.explorer ? `${this.explorer}/#/transaction/${txid}` : null;
  }

  /** Link to an address on the matching explorer, or null for custom nodes. */
  explorerAddress(address) {
    return this.explorer ? `${this.explorer}/#/address/${address}` : null;
  }
}

/** Convenience factory. */
export function createClient(options) {
  return new TronClient(options);
}

/** Shared CLI helper: build a client from `--network`, `--node`, `--api-key` flags. */
export function clientFromFlags(flags = {}) {
  return new TronClient({
    network: flags.network || 'mainnet',
    fullNode: flags.node,
    apiKey: flags['api-key'],
    timeoutMs: flags.timeout ? Number(flags.timeout) : undefined,
  });
}

export default TronClient;
