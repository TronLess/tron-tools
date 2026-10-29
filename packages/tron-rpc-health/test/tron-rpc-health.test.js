import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkEndpoint, checkEndpoints, pickBestNode, formatReport, DEFAULT_ENDPOINTS } from '../src/index.js';

const NOW = 1_788_853_836_000;
function fakeFetch(map) {
  return async (url, init) => {
    const handler = map[url] || map[new URL(url).origin];
    if (!handler) throw new Error(`ECONNREFUSED ${url}`);
    const r = await handler(init);
    return { ok: r.status === 200, status: r.status, headers: { get: () => null }, text: async () => JSON.stringify(r.body) };
  };
}

test('checkEndpoint http', async () => {
  const fetch = fakeFetch({
    'https://node.example': () => ({ status: 200, body: { block_header: { raw_data: { number: 100, timestamp: NOW - 3000 } } } }),
  });
  const r = await checkEndpoint({ url: 'https://node.example', name: 'X' }, { fetch, now: () => NOW });
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'http');
  assert.equal(r.blockNumber, 100);
  assert.equal(r.lagMs, 3000);
  assert.equal(r.lagBlocks, 1);
});

test('checkEndpoint jsonrpc', async () => {
  const fetch = fakeFetch({
    'https://rpc.example/jsonrpc': (init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.method, 'eth_getBlockByNumber');
      return { status: 200, body: { jsonrpc: '2.0', id: 1, result: { number: '0x64', timestamp: '0x' + Math.floor((NOW - 6000) / 1000).toString(16) } } };
    },
  });
  const r = await checkEndpoint({ url: 'https://rpc.example/jsonrpc' }, { fetch, now: () => NOW });
  assert.equal(r.kind, 'jsonrpc');
  assert.equal(r.blockNumber, 100);
  assert.equal(r.lagBlocks, 2);
});

test('checkEndpoint failure', async () => {
  const r = await checkEndpoint({ url: 'https://down.example' }, { fetch: fakeFetch({}), now: () => NOW });
  assert.equal(r.ok, false);
  assert.match(r.error, /ECONNREFUSED/);
});

test('checkEndpoints ranks by lag then latency and filters by network', async () => {
  let t = NOW;
  const now = () => (t += 10);
  const fetch = fakeFetch({
    'https://a.example': () => ({ status: 200, body: { block_header: { raw_data: { number: 1000, timestamp: NOW } } } }),
    'https://b.example': () => ({ status: 200, body: { block_header: { raw_data: { number: 999, timestamp: NOW } } } }),
    'https://c.example': () => ({ status: 200, body: { block_header: { raw_data: { number: 900, timestamp: NOW } } } }),
  });
  const report = await checkEndpoints(
    [
      { name: 'A', url: 'https://a.example', network: 'mainnet' },
      { name: 'B', url: 'https://b.example', network: 'mainnet' },
      { name: 'C', url: 'https://c.example', network: 'mainnet' },
      { name: 'D', url: 'https://d.example', network: 'mainnet' },
      { name: 'N', url: 'https://n.example', network: 'nile' },
    ],
    { fetch, now, network: 'mainnet', concurrency: 2 },
  );
  assert.equal(report.results.length, 4);
  assert.equal(report.consensusHeight, 1000);
  assert.equal(report.best.name, 'A');
  assert.equal(report.results.find((r) => r.name === 'C').healthy, false, '100 blocks behind');
  assert.equal(report.results.find((r) => r.name === 'D').ok, false);
  assert.equal(report.bestJsonRpc, null);
  assert.match(formatReport(report), /Consensus height: 1000/);
  assert.equal(await pickBestNode('mainnet', { fetch, now }), null, 'default list not reachable through fake fetch');
});

test('default endpoint list covers all networks', () => {
  for (const n of ['mainnet', 'nile', 'shasta']) {
    assert.ok(DEFAULT_ENDPOINTS.some((e) => e.network === n && e.kind === 'http'));
  }
});

test('live: mainnet endpoints', { skip: !process.env.TRON_LIVE }, async () => {
  const report = await checkEndpoints(null, { network: 'mainnet' });
  assert.ok(report.best, 'at least one healthy endpoint');
});
