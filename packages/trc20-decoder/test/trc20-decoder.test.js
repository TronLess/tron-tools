import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selector, eventTopic, keccakHex, decodeInput, decodeEventLog, decodeTransaction, decodeTransactionInfoLogs,
  encodeTransfer, encodeCall, decodeParameters, encodeParameters, decodeTransactionById, FUNCTIONS,
} from '../src/index.js';

// Real mainnet USDT transfer (block 86060671): 452 USDT from TMoRLxz… to TSkQrv…
const TX = {
  txID: 'b86bfe8c777cd3419c22dd254763d157ee35146b410540c9f7c2864e283ef415',
  raw_data: {
    contract: [{
      parameter: {
        value: {
          owner_address: 'TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5',
          contract_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
          data: 'a9059cbb000000000000000000000000b80ea17fb9e827efd08c34b0e59a53b7a8506210000000000000000000000000000000000000000000000000000000001af0f900',
        },
        type_url: 'type.googleapis.com/protocol.TriggerSmartContract',
      },
      type: 'TriggerSmartContract',
    }],
    timestamp: 1788853808592,
    expiration: 1788854352000,
    fee_limit: 60000000,
  },
  ret: [{ contractRet: 'SUCCESS' }],
};
const INFO = {
  id: TX.txID,
  fee: 6428500,
  receipt: { energy_fee: 6428500, energy_usage_total: 64285, net_usage: 345, result: 'SUCCESS' },
  log: [{
    address: 'a614f803b6fd780986a42c78ec9c7f77e6ded13c',
    topics: [
      'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '00000000000000000000000081c7a744fa693a2880d9e12991dfba53affcc09b',
      '000000000000000000000000b80ea17fb9e827efd08c34b0e59a53b7a8506210',
    ],
    data: '000000000000000000000000000000000000000000000000000000001af0f900',
  }],
};

test('selectors and topics match keccak (verified with ethers)', () => {
  assert.equal(keccakHex(''), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(selector('transfer(address,uint256)'), 'a9059cbb');
  assert.equal(selector('approve(address,uint256)'), '095ea7b3');
  assert.equal(selector('transferFrom(address,address,uint256)'), '23b872dd');
  assert.equal(selector('balanceOf(address)'), '70a08231');
  assert.equal(eventTopic('Transfer(address,address,uint256)'), 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef');
  assert.equal(eventTopic('Approval(address,address,uint256)'), '8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925');
  for (const [sel, sig] of Object.entries(FUNCTIONS)) assert.equal(selector(sig), sel, sig);
});

test('decodeInput transfer', () => {
  const d = decodeInput(TX.raw_data.contract[0].parameter.value.data);
  assert.equal(d.known, true);
  assert.equal(d.name, 'transfer');
  assert.equal(d.to, 'TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu');
  assert.equal(d.value, '452000000');
  assert.equal(d.args[0].value.hex, '41b80ea17fb9e827efd08c34b0e59a53b7a8506210');
  assert.equal(decodeInput('0x' + TX.raw_data.contract[0].parameter.value.data).to, d.to);
});

test('decodeInput unknown selector and custom signature', () => {
  const data = 'deadbeef' + '0'.repeat(63) + '1';
  assert.equal(decodeInput(data).known, false);
  const d = decodeInput(data, { signature: 'foo(uint256)' });
  assert.equal(d.name, 'foo');
  assert.equal(d.args[0].value, '1');
  assert.throws(() => decodeInput('aa'));
});

test('encode/decode round trip', () => {
  const to = 'TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu';
  const data = encodeTransfer(to, 452_000_000n);
  assert.equal(data, TX.raw_data.contract[0].parameter.value.data);
  assert.equal(encodeCall('balanceOf(address)', [to]), '70a08231000000000000000000000000b80ea17fb9e827efd08c34b0e59a53b7a8506210');
  const params = encodeParameters(['address', 'uint256', 'bool', 'int256'], [to, '5', true, -1]);
  const [a, u, b, i] = decodeParameters(['address', 'uint256', 'bool', 'int256'], params);
  assert.equal(a.base58, to);
  assert.equal(u, '5');
  assert.equal(b, true);
  assert.equal(i, '-1');
  assert.throws(() => encodeTransfer('not-an-address', 1));
});

test('decodeParameters string', () => {
  // abi.encode("Tether USD")
  const hex = '0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000a5465746865722055534400000000000000000000000000000000000000000000';
  assert.deepEqual(decodeParameters(['string'], hex), ['Tether USD']);
  assert.deepEqual(decodeParameters(['uint8'], '0000000000000000000000000000000000000000000000000000000000000006'), ['6']);
});

test('decodeEventLog Transfer', () => {
  const e = decodeEventLog(INFO.log[0]);
  assert.equal(e.name, 'Transfer');
  assert.equal(e.contract, 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
  assert.equal(e.from, 'TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5');
  assert.equal(e.to, 'TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu');
  assert.equal(e.value, '452000000');
  const unknown = decodeEventLog({ topics: ['00'.repeat(32)], data: '' });
  assert.equal(unknown.known, false);
});

test('decodeTransaction TriggerSmartContract / TransferContract', () => {
  const t = decodeTransaction(TX);
  assert.equal(t.type, 'TriggerSmartContract');
  assert.equal(t.method, 'transfer');
  assert.equal(t.from, 'TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5');
  assert.equal(t.contract, 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
  assert.equal(t.to, 'TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu');
  assert.equal(t.amountRaw, '452000000');
  assert.equal(t.result, 'SUCCESS');
  assert.equal(t.feeLimit, 60000000);

  const trx = decodeTransaction({
    txID: 'x',
    raw_data: {
      contract: [{ type: 'TransferContract', parameter: { value: { owner_address: '4181c7a744fa693a2880d9e12991dfba53affcc09b', to_address: '41b80ea17fb9e827efd08c34b0e59a53b7a8506210', amount: 1500000 } } }],
      timestamp: 1,
      data: '68656c6c6f',
    },
    ret: [{ contractRet: 'SUCCESS' }],
  });
  assert.equal(trx.asset, 'TRX');
  assert.equal(trx.amountSun, 1500000);
  assert.equal(trx.from, 'TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5');
  assert.equal(trx.to, 'TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu');
  assert.equal(trx.memo, 'hello');
  assert.throws(() => decodeTransaction({}));
});

test('decodeTransactionInfoLogs + decodeTransactionById with mocked client', async () => {
  assert.equal(decodeTransactionInfoLogs(INFO)[0].name, 'Transfer');
  const client = { network: 'mainnet', getTransactionById: async () => TX, getTransactionInfoById: async () => INFO };
  const r = await decodeTransactionById(TX.txID, { client });
  assert.equal(r.transaction.to, r.events[0].to);
  const empty = { network: 'mainnet', getTransactionById: async () => ({}), getTransactionInfoById: async () => ({}) };
  await assert.rejects(() => decodeTransactionById('00', { client: empty }), /not found/);
});
