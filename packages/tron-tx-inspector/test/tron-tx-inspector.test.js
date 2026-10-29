import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReceipt, inspectTransaction, formatReceipt } from '../src/index.js';

const TXID = 'b86bfe8c777cd3419c22dd254763d157ee35146b410540c9f7c2864e283ef415';
const TX = {
  txID: TXID,
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
  id: TXID,
  fee: 6428500,
  blockNumber: 86060671,
  blockTimeStamp: 1788853809000,
  contractResult: ['0000000000000000000000000000000000000000000000000000000000000000'],
  contract_address: '41a614f803b6fd780986a42c78ec9c7f77e6ded13c',
  receipt: { energy_fee: 6428500, energy_usage_total: 64285, net_usage: 345, result: 'SUCCESS', energy_penalty_total: 49635 },
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

test('buildReceipt for a real USDT transfer', () => {
  const r = buildReceipt(TX, INFO, { network: 'mainnet', explorer: (t) => `https://tronscan.org/#/transaction/${t}` });
  assert.equal(r.status, 'SUCCESS');
  assert.equal(r.confirmed, true);
  assert.equal(r.block, 86060671);
  assert.equal(r.timestamp, '2026-09-08T07:50:09.000Z');
  assert.equal(r.typeLabel, 'Smart contract call');
  assert.equal(r.method, 'transfer');
  assert.equal(r.from, 'TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5');
  assert.equal(r.to, 'TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu');
  assert.equal(r.contract, 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
  assert.deepEqual(r.amount, { asset: 'USDT', raw: '452000000', value: '452' });
  assert.equal(r.fee.totalTrx, '6.4285');
  assert.equal(r.fee.energy.total, 64285);
  assert.equal(r.fee.energy.burnedUnits, 64285);
  assert.equal(r.fee.energy.priceSunPerUnit, 100);
  assert.equal(r.fee.energy.penaltyUnits, 49635);
  assert.equal(r.fee.bandwidth.bytes, 345);
  assert.equal(r.fee.bandwidth.burnedSun, 0);
  assert.equal(r.fee.other.sun, 0);
  assert.equal(r.tokenTransfers.length, 1);
  assert.equal(r.tokenTransfers[0].amount, '452');
  assert.equal(r.tokenTransfers[0].symbol, 'USDT');
  assert.match(r.explorer, /tronscan\.org/);
  const text = formatReceipt(r);
  assert.match(text, /Status:\s+SUCCESS/);
  assert.match(text, /452 USDT/);
});

test('energy partly from stake + failure + pending', () => {
  const partly = buildReceipt(TX, { ...INFO, fee: 428500, receipt: { ...INFO.receipt, energy_usage: 60000, energy_fee: 428500 } });
  assert.equal(partly.fee.energy.fromStake, 60000);
  assert.equal(partly.fee.energy.burnedUnits, 4285);
  assert.equal(partly.fee.energy.burnedTrx, '0.4285');

  const failed = buildReceipt(
    { ...TX, ret: [{ contractRet: 'REVERT' }] },
    { ...INFO, receipt: { ...INFO.receipt, result: 'REVERT' }, resMessage: Buffer.from('insufficient balance').toString('hex') },
  );
  assert.equal(failed.status, 'REVERT');
  assert.equal(failed.failureMessage, 'insufficient balance');

  const pending = buildReceipt(TX, {});
  assert.equal(pending.status, 'PENDING');
  assert.equal(pending.confirmed, false);
  assert.equal(pending.block, null);
  assert.equal(pending.timestamp, '2026-09-08T07:50:08.592Z');
});

test('TRX transfer with activation fee shows "other"', () => {
  const tx = {
    txID: 'aa'.repeat(32),
    raw_data: { contract: [{ type: 'TransferContract', parameter: { value: { owner_address: 'TMoRLxzroxJTS3QUvNdQ18tpCZ7rtzKFo5', to_address: 'TSkQrvdRba8JaHWwC9bDFsX3euMzuiqjxu', amount: 1500000 } } }], timestamp: 1 },
    ret: [{ contractRet: 'SUCCESS' }],
  };
  const r = buildReceipt(tx, { blockNumber: 1, blockTimeStamp: 1, fee: 1100000, receipt: { net_usage: 268, net_fee: 100000 } });
  assert.equal(r.typeLabel, 'TRX transfer');
  assert.deepEqual(r.amount, { asset: 'TRX', raw: '1500000', value: '1.5' });
  assert.equal(r.fee.other.sun, 1000000);
  assert.equal(r.fee.bandwidth.burnedSun, 100000);
});

test('inspectTransaction validates id and handles not found', async () => {
  const client = {
    network: 'mainnet',
    getTransactionById: async () => ({}),
    getTransactionInfoById: async () => ({}),
    explorerTx: (t) => `x/${t}`,
  };
  await assert.rejects(() => inspectTransaction('nope', { client }), /64 hex/);
  const r = await inspectTransaction('0x' + TXID, { client });
  assert.equal(r.status, 'NOT_FOUND');
  assert.equal(r.txid, TXID);
  assert.match(formatReceipt(r), /NOT FOUND/);
  const ok = await inspectTransaction(TXID, { client: { ...client, getTransactionById: async () => TX, getTransactionInfoById: async () => INFO } });
  assert.equal(ok.status, 'SUCCESS');
});

test('live: real mainnet transaction', { skip: !process.env.TRON_LIVE }, async () => {
  const r = await inspectTransaction(TXID);
  assert.equal(r.status, 'SUCCESS');
  assert.equal(r.fee.totalTrx, '6.4285');
});
