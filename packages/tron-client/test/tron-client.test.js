import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TronClient, NETWORKS, TronClientError, clientFromFlags } from '../src/index.js';

function mockFetch(handler) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const r = await handler(url, init, calls.length);
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      headers: { get: (k) => (r.headers || {})[k.toLowerCase()] },
      text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
    };
  };
  return { fetch, calls };
}

test('network presets', () => {
  assert.equal(NETWORKS.mainnet.fullNode, 'https://api.trongrid.io');
  assert.equal(NETWORKS.nile.fullNode, 'https://nile.trongrid.io');
  assert.equal(NETWORKS.shasta.fullNode, 'https://api.shasta.trongrid.io');
  assert.equal(NETWORKS.mainnet.usdt, 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
});

test('GET builds URL with query and sends api key header', async () => {
  const { fetch, calls } = mockFetch(() => ({ status: 200, body: { ok: 1 } }));
  const c = new TronClient({ network: 'nile', apiKey: 'k1', fetch });
  const res = await c.v1('accounts/TXYZ/transactions/trc20', { limit: 5, only_confirmed: true, skip: undefined });
  assert.deepEqual(res, { ok: 1 });
  assert.equal(calls[0].url, 'https://nile.trongrid.io/v1/accounts/TXYZ/transactions/trc20?limit=5&only_confirmed=true');
  assert.equal(calls[0].init.headers['TRON-PRO-API-KEY'], 'k1');
  assert.equal(calls[0].init.method, 'GET');
});

test('POST sends JSON body and visible flag for base58 addresses', async () => {
  const { fetch, calls } = mockFetch(() => ({ status: 200, body: { balance: 1 } }));
  const c = new TronClient({ fetch, apiKey: '' });
  await c.getAccount('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body, { address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', visible: true });
  await c.getAccount('41a614f803b6fd780986a42c78ec9c7f77e6ded13c');
  assert.equal(JSON.parse(calls[1].init.body).visible, false);
  assert.equal(calls[0].init.headers['TRON-PRO-API-KEY'], undefined);
});

test('retries on 429 then succeeds', async () => {
  const { fetch, calls } = mockFetch((url, init, n) =>
    n === 1 ? { status: 429, body: { Error: 'rate' } } : { status: 200, body: { done: true } },
  );
  const c = new TronClient({ fetch, retries: 2, retryDelayMs: 1 });
  const res = await c.getNowBlock();
  assert.deepEqual(res, { done: true });
  assert.equal(calls.length, 2);
});

test('treats TronGrid rate-limit body with 200 status as retryable, then throws', async () => {
  const { fetch, calls } = mockFetch(() => ({ status: 200, body: { Error: 'request rate exceeded the allowed_rps(3)' } }));
  const c = new TronClient({ fetch, retries: 1, retryDelayMs: 1 });
  await assert.rejects(() => c.getNowBlock(), (err) => err instanceof TronClientError && /rate exceeded/.test(err.message));
  assert.equal(calls.length, 2);
});

test('chain parameters map', async () => {
  const { fetch } = mockFetch(() => ({
    status: 200,
    body: { chainParameter: [{ key: 'getEnergyFee', value: 100 }, { key: 'getAllowTvmSolidity059', value: 1 }, { key: 'getNoValue' }] },
  }));
  const c = new TronClient({ fetch });
  const map = await c.getChainParametersMap();
  assert.equal(map.getEnergyFee, 100);
  assert.equal(map.getNoValue, 0);
});

test('unknown network throws, custom node works', () => {
  assert.throws(() => new TronClient({ network: 'moon', fetch: async () => ({}) }));
  const c = new TronClient({ fullNode: 'http://localhost:8090/', network: 'custom', fetch: async () => ({}) });
  assert.equal(c.baseUrl, 'http://localhost:8090');
  assert.equal(c.explorerTx('abc'), null);
});

test('clientFromFlags and explorer links', () => {
  const c = clientFromFlags({ network: 'nile' });
  assert.equal(c.network, 'nile');
  assert.equal(c.explorerTx('deadbeef'), 'https://nile.tronscan.org/#/transaction/deadbeef');
  assert.equal(c.explorerAddress('TXYZ'), 'https://nile.tronscan.org/#/address/TXYZ');
});

test('live: getnowblock on mainnet', { skip: !process.env.TRON_LIVE }, async () => {
  const c = new TronClient();
  const b = await c.getNowBlock();
  assert.ok(b.block_header.raw_data.number > 80_000_000);
});
