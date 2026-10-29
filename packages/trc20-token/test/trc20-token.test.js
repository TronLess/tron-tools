import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TronClient } from '@tronless/tron-client';
import { resolveContract, callConstant, getTokenInfo, getBalance, getUsdtBalance, getAllowance, getBalances } from '../src/index.js';

const USDT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const HOLDER = 'TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5';
const word = (n) => BigInt(n).toString(16).padStart(64, '0');
const abiString = (s) => {
  const hex = Buffer.from(s, 'utf8').toString('hex');
  return word(32) + word(s.length) + hex.padEnd(64, '0');
};

/** Fake node that answers triggerconstantcontract by selector. */
function fakeClient(answers) {
  const calls = [];
  const fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const sel = body.function_selector;
    const answer = typeof answers[sel] === 'function' ? answers[sel](body) : answers[sel];
    const payload = answer === undefined
      ? { result: { result: false, message: Buffer.from('no such method').toString('hex') } }
      : { result: { result: true }, constant_result: [answer], energy_used: 1000 };
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(payload) };
  };
  return { client: new TronClient({ fetch }), calls };
}

test('resolveContract', () => {
  assert.equal(resolveContract('USDT'), USDT);
  assert.equal(resolveContract('usdt', new TronClient({ network: 'nile', fetch: async () => ({}) })), 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf');
  assert.equal(resolveContract('41a614f803b6fd780986a42c78ec9c7f77e6ded13c'), USDT);
  assert.equal(resolveContract('USDC'), 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8');
  assert.throws(() => resolveContract('NOPE'));
});

test('getTokenInfo decodes name/symbol/decimals/totalSupply', async () => {
  const { client, calls } = fakeClient({
    'name()': abiString('Tether USD'),
    'symbol()': abiString('USDT'),
    'decimals()': word(6),
    'totalSupply()': word(75_000_000_000_000_000n),
  });
  const info = await getTokenInfo('USDT', { client });
  assert.equal(info.name, 'Tether USD');
  assert.equal(info.symbol, 'USDT');
  assert.equal(info.decimals, 6);
  assert.equal(info.totalSupply, '75000000000');
  assert.equal(info.address, USDT);
  assert.ok(calls.every((c) => c.contract_address === USDT && c.visible === true));
});

test('getBalance encodes holder and formats with decimals', async () => {
  const { client, calls } = fakeClient({
    'balanceOf(address)': (body) => {
      assert.equal(body.parameter, '00000000000000000000000081c7a744fa693a2880d9e12991dfba53affcc09b');
      return word(452_000_000);
    },
    'decimals()': word(6),
  });
  const b = await getBalance('USDT', HOLDER, { client });
  assert.equal(b.balance, '452');
  assert.equal(b.raw, '452000000');
  assert.equal(b.holder, HOLDER);
  assert.equal(calls.length, 2);
  const b2 = await getUsdtBalance('4181c7a744fa693a2880d9e12991dfba53affcc09b', { client });
  assert.equal(b2.balance, '452');
  assert.equal(calls.length, 3, 'decimals known → single call');
  await assert.rejects(() => getBalance('USDT', 'bad', { client }), /Invalid holder/);
});

test('getAllowance + getBalances with errors', async () => {
  const { client } = fakeClient({
    'allowance(address,address)': word(10_000_000),
    'balanceOf(address)': word(1_500_000),
    'decimals()': word(6),
  });
  const a = await getAllowance('USDT', HOLDER, USDT, { client });
  assert.equal(a.allowance, '10');
  const list = await getBalances(['USDT', 'NOPE'], HOLDER, { client });
  assert.equal(list[0].balance, '1.5');
  assert.match(list[1].error, /Unknown token/);
});

test('callConstant surfaces revert messages', async () => {
  const { client } = fakeClient({});
  await assert.rejects(() => callConstant({ client, contract: USDT, method: 'nothing()' }), /no such method/);
});

test('live: USDT info and a balance on mainnet', { skip: !process.env.TRON_LIVE }, async () => {
  const info = await getTokenInfo('USDT');
  assert.equal(info.symbol, 'USDT');
  assert.equal(info.decimals, 6);
  const b = await getUsdtBalance(USDT);
  assert.ok(BigInt(b.raw) >= 0n);
});
