import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TronClient } from '@tronless/tron-client';
import { AddressWatcher, fetchTrc20Transfers, fetchTrxTransfers, watchAddresses } from '../src/index.js';

const WATCHED = 'TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu';
const OTHER = 'TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5';
const USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

const trc20Item = (id, from, to, value, ts) => ({
  transaction_id: id,
  token_info: { symbol: 'USDT', address: USDT, decimals: 6, name: 'Tether USD' },
  block_timestamp: ts,
  from,
  to,
  type: 'Transfer',
  value: String(value),
});
const trxItem = (id, from, to, amount, ts, ret = 'SUCCESS') => ({
  txID: id,
  block_timestamp: ts,
  ret: [{ contractRet: ret }],
  raw_data: { contract: [{ type: 'TransferContract', parameter: { value: { owner_address: from, to_address: to, amount } } }] },
});

/** Fake TronGrid: routes by path, records query strings, supports pagination via fingerprint. */
function fakeGrid(handlers) {
  const calls = [];
  const fetch = async (url) => {
    const u = new URL(url);
    calls.push(u);
    const key = u.pathname.endsWith('/trc20') ? 'trc20' : 'tx';
    const body = handlers[key](u.searchParams, calls.filter((c) => (c.pathname.endsWith('/trc20') ? 'trc20' : 'tx') === key).length);
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(body) };
  };
  return { client: new TronClient({ fetch, retries: 0 }), calls };
}

test('fetchTrc20Transfers normalizes, paginates and filters by contract', async () => {
  const { client, calls } = fakeGrid({
    trc20: (q, n) =>
      n === 1
        ? { data: [trc20Item('t1', OTHER, WATCHED, 452_000_000, 1000), trc20Item('t2', WATCHED, OTHER, 1_500_000, 2000)], meta: { fingerprint: 'fp1' } }
        : { data: [trc20Item('t3', OTHER, WATCHED, 5, 3000)], meta: {} },
  });
  const list = await fetchTrc20Transfers(WATCHED, { client, since: 500, contracts: ['USDT'], limit: 2 });
  assert.equal(list.length, 3);
  assert.equal(list[0].direction, 'in');
  assert.equal(list[0].amount, '452');
  assert.equal(list[1].direction, 'out');
  assert.equal(list[1].amount, '1.5');
  assert.equal(list[2].amount, '0.000005');
  assert.equal(calls[0].searchParams.get('contract_address'), USDT);
  assert.equal(calls[0].searchParams.get('min_timestamp'), '500');
  assert.equal(calls[0].searchParams.get('only_confirmed'), 'true');
  assert.equal(calls[1].searchParams.get('fingerprint'), 'fp1');
  await assert.rejects(() => fetchTrc20Transfers(WATCHED, { client, contracts: ['NOPE'] }), /Unknown token/);
});

test('fetchTrxTransfers keeps only successful TransferContract', async () => {
  const { client } = fakeGrid({
    tx: () => ({
      data: [
        trxItem('a', OTHER, WATCHED, 1_000_000, 1000),
        trxItem('b', OTHER, WATCHED, 1_000_000, 1100, 'REVERT'),
        { txID: 'c', block_timestamp: 1200, raw_data: { contract: [{ type: 'TriggerSmartContract', parameter: { value: {} } }] } },
        trxItem('d', WATCHED, OTHER, 250_000, 1300),
      ],
    }),
  });
  const list = await fetchTrxTransfers(WATCHED, { client });
  assert.deepEqual(list.map((t) => [t.txid, t.direction, t.amount]), [['a', 'in', '1'], ['d', 'out', '0.25']]);
  assert.equal(list[0].token.symbol, 'TRX');
});

test('AddressWatcher de-duplicates, advances cursor, filters direction, delivers webhooks', async () => {
  let round = 0;
  const { client } = fakeGrid({
    trc20: () => (round === 0
      ? { data: [trc20Item('t1', OTHER, WATCHED, 10_000_000, 5000), trc20Item('t2', WATCHED, OTHER, 1, 5000)] }
      : { data: [trc20Item('t1', OTHER, WATCHED, 10_000_000, 5000), trc20Item('t3', OTHER, WATCHED, 20_000_000, 6000)] }),
    tx: () => ({ data: [] }),
  });
  const webhooks = [];
  const w = new AddressWatcher({
    addresses: [WATCHED],
    client,
    direction: 'in',
    since: 1000,
    webhookUrl: 'https://hook.example/tron',
    webhookHeaders: { authorization: 'Bearer x' },
    fetch: async (url, init) => {
      webhooks.push({ url, body: JSON.parse(init.body), headers: init.headers });
      return { ok: true, status: 200 };
    },
    delayBetweenAddressesMs: 0,
  });
  const seen = [];
  w.on('transfer', (t) => seen.push(t.txid));
  const first = await w.pollOnce();
  assert.deepEqual(first.map((t) => t.txid), ['t1'], 'outgoing t2 filtered by direction');
  assert.equal(w.cursor.get(WATCHED), 5000);
  round = 1;
  const second = await w.pollOnce();
  assert.deepEqual(second.map((t) => t.txid), ['t3'], 't1 de-duplicated');
  assert.deepEqual(seen, ['t1', 't3']);
  assert.equal(webhooks.length, 2);
  assert.equal(webhooks[0].headers['x-tronless-event'], 'transfer');
  assert.equal(webhooks[0].headers.authorization, 'Bearer x');
  assert.equal(webhooks[1].body.transfer.amount, '20');
});

test('watcher validates input, start/stop, error events keep it running', async () => {
  assert.throws(() => new AddressWatcher({ addresses: [] }));
  assert.throws(() => new AddressWatcher({ addresses: ['nope'] }));
  let fail = true;
  const client = new TronClient({
    retries: 0,
    fetch: async () => {
      if (fail) throw new Error('boom');
      return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ data: [] }) };
    },
  });
  const errors = [];
  const w = watchAddresses([WATCHED, OTHER], { client, pollIntervalMs: 5, delayBetweenAddressesMs: 0, onError: (e) => errors.push(e.message) });
  assert.equal(w.running, true);
  await new Promise((r) => setTimeout(r, 30));
  assert.ok(errors.length >= 1);
  fail = false;
  await new Promise((r) => setTimeout(r, 30));
  w.stop();
  assert.equal(w.running, false);
  const polls = [];
  w.on('poll', (p) => polls.push(p));
  await w.pollOnce();
  assert.equal(polls.length, 2, 'one poll event per address');
});

test('live: recent USDT transfers of the USDT contract address', { skip: !process.env.TRON_LIVE }, async () => {
  const list = await fetchTrc20Transfers(USDT, { since: Date.now() - 3600_000, contracts: ['USDT'], maxPages: 1 });
  assert.ok(Array.isArray(list));
});
