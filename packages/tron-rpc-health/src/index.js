/**
 * @tronless/tron-rpc-health
 * Probe TRON HTTP full nodes and JSON-RPC endpoints, compare heights and latency.
 */
import { TronClient } from '@tronless/tron-client';

/**
 * Curated public endpoints. `kind`:
 *   http    — TRON full-node HTTP API (/wallet/getnowblock)
 *   jsonrpc — Ethereum-compatible JSON-RPC (eth_blockNumber)
 * TronGrid without an API key is limited to ~3 req/s; set TRON_PRO_API_KEY for more.
 */
export const DEFAULT_ENDPOINTS = Object.freeze([
  { name: 'TronGrid', network: 'mainnet', kind: 'http', url: 'https://api.trongrid.io' },
  { name: 'TronGrid JSON-RPC', network: 'mainnet', kind: 'jsonrpc', url: 'https://api.trongrid.io/jsonrpc' },
  { name: 'TronStack', network: 'mainnet', kind: 'http', url: 'https://api.tronstack.io' },
  { name: 'PublicNode JSON-RPC', network: 'mainnet', kind: 'jsonrpc', url: 'https://tron-rpc.publicnode.com/jsonrpc' },
  { name: 'TronGrid Nile', network: 'nile', kind: 'http', url: 'https://nile.trongrid.io' },
  { name: 'TronGrid Nile JSON-RPC', network: 'nile', kind: 'jsonrpc', url: 'https://nile.trongrid.io/jsonrpc' },
  { name: 'TronGrid Shasta', network: 'shasta', kind: 'http', url: 'https://api.shasta.trongrid.io' },
  { name: 'TronGrid Shasta JSON-RPC', network: 'shasta', kind: 'jsonrpc', url: 'https://api.shasta.trongrid.io/jsonrpc' },
]);

/** TRON produces a block every 3 seconds. */
export const BLOCK_INTERVAL_MS = 3000;

/**
 * Probe one endpoint.
 * @param {{url: string, kind?: 'http'|'jsonrpc', name?: string, network?: string}} endpoint
 * @param {{timeoutMs?: number, apiKey?: string, fetch?: typeof fetch, now?: () => number}} [options]
 */
export async function checkEndpoint(endpoint, options = {}) {
  const kind = endpoint.kind || (endpoint.url.includes('jsonrpc') ? 'jsonrpc' : 'http');
  const timeoutMs = options.timeoutMs ?? 8000;
  const now = options.now || Date.now;
  const started = now();
  const base = { name: endpoint.name || endpoint.url, url: endpoint.url, kind, network: endpoint.network || null };
  try {
    let blockNumber = null;
    let blockTimestamp = null;
    if (kind === 'jsonrpc') {
      const client = new TronClient({ fullNode: endpoint.url, network: 'custom', apiKey: options.apiKey, timeoutMs, retries: 0, fetch: options.fetch });
      const res = await client.post('', { jsonrpc: '2.0', id: 1, method: 'eth_getBlockByNumber', params: ['latest', false] });
      if (res?.error) throw new Error(res.error.message || JSON.stringify(res.error));
      const b = res?.result;
      if (!b || !b.number) throw new Error('empty JSON-RPC result');
      blockNumber = Number(BigInt(b.number));
      blockTimestamp = b.timestamp ? Number(BigInt(b.timestamp)) * 1000 : null;
    } else {
      const client = new TronClient({ fullNode: endpoint.url, network: 'custom', apiKey: options.apiKey, timeoutMs, retries: 0, fetch: options.fetch });
      const b = await client.getNowBlock();
      const raw = b?.block_header?.raw_data;
      if (!raw || raw.number == null) throw new Error('unexpected getnowblock response');
      blockNumber = Number(raw.number);
      blockTimestamp = Number(raw.timestamp);
    }
    const latencyMs = now() - started;
    const lagMs = blockTimestamp ? Math.max(0, now() - blockTimestamp) : null;
    return {
      ...base,
      ok: true,
      latencyMs,
      blockNumber,
      blockTimestamp,
      blockTime: blockTimestamp ? new Date(blockTimestamp).toISOString() : null,
      lagMs,
      lagBlocks: lagMs != null ? Math.floor(lagMs / BLOCK_INTERVAL_MS) : null,
      error: null,
    };
  } catch (err) {
    return { ...base, ok: false, latencyMs: now() - started, blockNumber: null, blockTimestamp: null, blockTime: null, lagMs: null, lagBlocks: null, error: err.message };
  }
}

/**
 * Probe many endpoints with limited concurrency and rank them.
 * @param {Array<object>} [endpoints] defaults to DEFAULT_ENDPOINTS filtered by options.network
 * @param {{network?: string, concurrency?: number, timeoutMs?: number, apiKey?: string, fetch?: typeof fetch, maxLagBlocks?: number, now?: () => number}} [options]
 */
export async function checkEndpoints(endpoints, options = {}) {
  const list = (endpoints && endpoints.length ? endpoints : DEFAULT_ENDPOINTS).filter(
    (e) => !options.network || !e.network || e.network === options.network,
  );
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const results = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        results[i] = await checkEndpoint(list[i], options);
      }
    }),
  );
  const healthy = results.filter((r) => r.ok);
  const consensusHeight = healthy.length ? Math.max(...healthy.map((r) => r.blockNumber)) : null;
  const maxLagBlocks = options.maxLagBlocks ?? 20;
  for (const r of results) {
    r.behindBlocks = r.ok && consensusHeight != null ? consensusHeight - r.blockNumber : null;
    r.healthy = r.ok && r.behindBlocks != null && r.behindBlocks <= maxLagBlocks;
  }
  const ranked = results
    .filter((r) => r.healthy)
    .sort((a, b) => a.behindBlocks - b.behindBlocks || a.latencyMs - b.latencyMs);
  return {
    checkedAt: new Date().toISOString(),
    network: options.network || null,
    consensusHeight,
    results,
    best: ranked[0] || null,
    bestHttp: ranked.find((r) => r.kind === 'http') || null,
    bestJsonRpc: ranked.find((r) => r.kind === 'jsonrpc') || null,
  };
}

/** Pick the fastest healthy HTTP full node for a network (one call for app bootstrap). */
export async function pickBestNode(network = 'mainnet', options = {}) {
  const report = await checkEndpoints(null, { ...options, network });
  return report.bestHttp?.url || null;
}

/** Terminal table. */
export function formatReport(report) {
  const rows = report.results.map((r) => [
    r.healthy ? 'OK ' : r.ok ? 'LAG' : 'ERR',
    r.name,
    r.kind,
    r.ok ? `${r.latencyMs} ms` : '-',
    r.ok ? String(r.blockNumber) : '-',
    r.ok ? `${r.behindBlocks} behind` : (r.error || '').slice(0, 60),
  ]);
  const widths = [3, 26, 7, 9, 10, 0];
  const lines = rows.map((cells) => cells.map((c, i) => (widths[i] ? String(c).padEnd(widths[i]) : c)).join('  '));
  lines.push('');
  lines.push(`Consensus height: ${report.consensusHeight ?? 'n/a'}${report.best ? `   best: ${report.best.name} (${report.best.url})` : ''}`);
  return lines.join('\n');
}

export default { DEFAULT_ENDPOINTS, BLOCK_INTERVAL_MS, checkEndpoint, checkEndpoints, pickBestNode, formatReport };
