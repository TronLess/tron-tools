/**
 * @tronless/trc20-decoder
 * Decode TRC-20 calldata, event logs and whole TRON transactions without a full ABI.
 */
import { keccak_256 } from '@noble/hashes/sha3.js';
import { toBase58, toHex, isValidAddress } from '@tronless/tron-address';
import { TronClient } from '@tronless/tron-client';

const enc = new TextEncoder();

function bytesToHex(bytes) {
  let s = '';
  for (const b of bytes) s += b.toString(16).padStart(2, '0');
  return s;
}

function stripHex(hex) {
  return String(hex || '').trim().replace(/^0x/i, '').toLowerCase();
}

/** keccak256 of a UTF-8 string, hex without 0x. */
export function keccakHex(text) {
  return bytesToHex(keccak_256(enc.encode(text)));
}

/** 4-byte function selector for a signature like "transfer(address,uint256)". */
export function selector(signature) {
  return keccakHex(signature).slice(0, 8);
}

/** 32-byte event topic for a signature like "Transfer(address,address,uint256)". */
export function eventTopic(signature) {
  return keccakHex(signature);
}

/** Known TRC-20 (and common extension) function signatures, keyed by selector. */
export const FUNCTIONS = Object.freeze({
  a9059cbb: 'transfer(address,uint256)',
  '095ea7b3': 'approve(address,uint256)',
  '23b872dd': 'transferFrom(address,address,uint256)',
  '70a08231': 'balanceOf(address)',
  dd62ed3e: 'allowance(address,address)',
  '18160ddd': 'totalSupply()',
  '313ce567': 'decimals()',
  '06fdde03': 'name()',
  '95d89b41': 'symbol()',
  '40c10f19': 'mint(address,uint256)',
  a0712d68: 'mint(uint256)',
  '42966c68': 'burn(uint256)',
  '79cc6790': 'burnFrom(address,uint256)',
  '39509351': 'increaseAllowance(address,uint256)',
  a457c2d7: 'decreaseAllowance(address,uint256)',
  '8da5cb5b': 'owner()',
  f2fde38b: 'transferOwnership(address)',
  '5c975abb': 'paused()',
  '8456cb59': 'pause()',
  '3f4ba83a': 'unpause()',
  e4997dc5: 'removeBlackList(address)',
  '0ecb93c0': 'addBlackList(address)',
  '59bf1abe': 'getBlackListStatus(address)',
  d0e30db0: 'deposit()',
  '2e1a7d4d': 'withdraw(uint256)',
});

/** Known event signatures keyed by topic0. */
export const EVENTS = Object.freeze({
  ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef: { name: 'Transfer', signature: 'Transfer(address,address,uint256)', inputs: ['address from', 'address to', 'uint256 value'], indexed: [true, true, false] },
  '8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925': { name: 'Approval', signature: 'Approval(address,address,uint256)', inputs: ['address owner', 'address spender', 'uint256 value'], indexed: [true, true, false] },
  '8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0': { name: 'OwnershipTransferred', signature: 'OwnershipTransferred(address,address)', inputs: ['address previousOwner', 'address newOwner'], indexed: [true, true] },
  '62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258': { name: 'Paused', signature: 'Paused(address)', inputs: ['address account'], indexed: [false] },
  '5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa': { name: 'Unpaused', signature: 'Unpaused(address)', inputs: ['address account'], indexed: [false] },
});

const PARAM_NAMES = {
  'transfer(address,uint256)': ['to', 'value'],
  'approve(address,uint256)': ['spender', 'value'],
  'transferFrom(address,address,uint256)': ['from', 'to', 'value'],
  'balanceOf(address)': ['owner'],
  'allowance(address,address)': ['owner', 'spender'],
  'mint(address,uint256)': ['to', 'value'],
  'mint(uint256)': ['value'],
  'burn(uint256)': ['value'],
  'burnFrom(address,uint256)': ['from', 'value'],
  'increaseAllowance(address,uint256)': ['spender', 'addedValue'],
  'decreaseAllowance(address,uint256)': ['spender', 'subtractedValue'],
  'transferOwnership(address)': ['newOwner'],
  'removeBlackList(address)': ['account'],
  'addBlackList(address)': ['account'],
  'getBlackListStatus(address)': ['account'],
  'withdraw(uint256)': ['value'],
};

function parseSignature(signature) {
  const m = /^([A-Za-z_$][\w$]*)\((.*)\)$/.exec(signature);
  if (!m) throw new Error(`Bad signature: ${signature}`);
  const types = m[2] ? m[2].split(',').map((t) => t.trim()) : [];
  return { name: m[1], types };
}

// ---- ABI decoding (static types + string/bytes) ----

function word(data, index) {
  const w = data.slice(index * 64, index * 64 + 64);
  if (w.length !== 64) throw new Error(`ABI data too short at word ${index}`);
  return w;
}

function decodeWord(type, w) {
  if (type === 'address') {
    const hex = `41${w.slice(24)}`;
    return { base58: toBase58(hex), hex };
  }
  if (/^uint\d*$/.test(type)) return BigInt(`0x${w}`).toString();
  if (/^int\d*$/.test(type)) {
    let n = BigInt(`0x${w}`);
    if (n >= 2n ** 255n) n -= 2n ** 256n;
    return n.toString();
  }
  if (type === 'bool') return BigInt(`0x${w}`) !== 0n;
  if (/^bytes\d+$/.test(type)) return `0x${w.slice(0, Number(type.slice(5)) * 2)}`;
  return `0x${w}`;
}

/**
 * Decode ABI-encoded parameters (no selector) by type list.
 * Supports address, uintN, intN, bool, bytesN, string, bytes. Arrays are not supported.
 * @param {string[]} types
 * @param {string} dataHex
 */
export function decodeParameters(types, dataHex) {
  const data = stripHex(dataHex);
  return types.map((type, i) => {
    if (type === 'string' || type === 'bytes') {
      const offset = Number(BigInt(`0x${word(data, i)}`)) * 2;
      const length = Number(BigInt(`0x${data.slice(offset, offset + 64)}`));
      const body = data.slice(offset + 64, offset + 64 + length * 2);
      if (type === 'bytes') return `0x${body}`;
      return new TextDecoder().decode(Uint8Array.from(body.match(/../g) || [], (h) => parseInt(h, 16)));
    }
    return decodeWord(type, word(data, i));
  });
}

/** Encode a single static parameter into a 32-byte word. */
export function encodeParameter(type, value) {
  if (type === 'address') {
    if (!isValidAddress(value)) throw new Error(`Invalid address: ${value}`);
    return toHex(value).slice(2).padStart(64, '0');
  }
  if (/^u?int\d*$/.test(type)) {
    let n = BigInt(value);
    if (n < 0n) n += 2n ** 256n;
    return n.toString(16).padStart(64, '0');
  }
  if (type === 'bool') return (value ? 1n : 0n).toString(16).padStart(64, '0');
  if (/^bytes\d+$/.test(type)) return stripHex(value).padEnd(64, '0');
  throw new Error(`Unsupported type for encoding: ${type}`);
}

/** Encode parameters (no selector) — the `parameter` field for triggerconstantcontract. */
export function encodeParameters(types, values) {
  if (types.length !== values.length) throw new Error('types/values length mismatch');
  return types.map((t, i) => encodeParameter(t, values[i])).join('');
}

/** Full calldata: selector + encoded params. */
export function encodeCall(signature, values = []) {
  const { types } = parseSignature(signature);
  return selector(signature) + encodeParameters(types, values);
}

/** Calldata for transfer(to, amount). Amount in raw token units (e.g. 1 USDT = 1000000). */
export function encodeTransfer(to, amountRaw) {
  return encodeCall('transfer(address,uint256)', [to, amountRaw]);
}

/**
 * Decode TRC-20 / contract calldata.
 * @param {string} dataHex calldata with or without 0x
 * @param {{signature?: string}} [options] provide a signature for unknown selectors, e.g. "foo(address,uint256)"
 */
export function decodeInput(dataHex, options = {}) {
  const data = stripHex(dataHex);
  if (data.length < 8) throw new Error('Calldata shorter than 4 bytes');
  const sel = data.slice(0, 8);
  const signature = options.signature || FUNCTIONS[sel];
  if (!signature) {
    return { selector: sel, known: false, name: null, signature: null, args: [], raw: `0x${data}` };
  }
  const { name, types } = parseSignature(signature);
  const values = decodeParameters(types, data.slice(8));
  const names = PARAM_NAMES[signature] || types.map((_, i) => `arg${i}`);
  const args = types.map((type, i) => ({ name: names[i], type, value: values[i] }));
  const out = { selector: sel, known: true, name, signature, args, raw: `0x${data}` };
  for (const a of args) {
    if (['to', 'from', 'spender', 'owner', 'value'].includes(a.name)) {
      out[a.name] = a.type === 'address' ? a.value.base58 : a.value;
    }
  }
  return out;
}

/**
 * Decode one event log as returned by gettransactioninfobyid (`log[]`) or TronGrid events.
 * @param {{address?: string, topics: string[], data?: string}} log
 */
export function decodeEventLog(log) {
  const topics = (log.topics || []).map(stripHex);
  const topic0 = topics[0];
  const def = EVENTS[topic0];
  const contract = log.address ? contractAddress(log.address) : null;
  if (!def) return { known: false, name: null, signature: null, topic0, contract, topics, data: log.data || '', args: [] };
  const args = [];
  let topicIndex = 1;
  const dataTypes = [];
  const dataNames = [];
  def.inputs.forEach((input, i) => {
    const [type, name] = input.split(' ');
    if (def.indexed[i]) {
      args.push({ name, type, value: decodeWord(type, topics[topicIndex++]) });
    } else {
      dataTypes.push(type);
      dataNames.push(name);
      args.push(null);
    }
  });
  const dataValues = dataTypes.length ? decodeParameters(dataTypes, log.data || '') : [];
  let d = 0;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === null) args[i] = { name: dataNames[d], type: dataTypes[d], value: dataValues[d++] };
  }
  const out = { known: true, name: def.name, signature: def.signature, topic0, contract, args };
  for (const a of args) out[a.name] = a.type === 'address' ? a.value.base58 : a.value;
  return out;
}

function contractAddress(addr) {
  const s = stripHex(addr);
  if (isValidAddress(addr)) return toBase58(addr);
  if (/^[0-9a-f]{40}$/.test(s)) return toBase58(`41${s}`);
  return addr;
}

/**
 * Decode a full transaction object from gettransactionbyid (visible or hex form).
 * Returns a normalized summary for TransferContract, TransferAssetContract and TriggerSmartContract.
 */
export function decodeTransaction(tx) {
  const c = tx?.raw_data?.contract?.[0];
  if (!c) throw new Error('Not a TRON transaction object (raw_data.contract missing)');
  const v = c.parameter?.value || {};
  const addr = (a) => (a ? contractAddress(a) : null);
  const base = {
    txid: tx.txID || tx.txid || null,
    type: c.type,
    from: addr(v.owner_address),
    timestamp: tx.raw_data.timestamp || null,
    expiration: tx.raw_data.expiration || null,
    feeLimit: tx.raw_data.fee_limit ?? null,
    result: tx.ret?.[0]?.contractRet || null,
    memo: tx.raw_data.data ? safeUtf8(tx.raw_data.data) : null,
    raw: v,
  };
  if (c.type === 'TransferContract') {
    return { ...base, to: addr(v.to_address), amountSun: v.amount, asset: 'TRX' };
  }
  if (c.type === 'TransferAssetContract') {
    return { ...base, to: addr(v.to_address), amountRaw: v.amount, asset: safeUtf8(v.asset_name) || v.asset_name, assetType: 'TRC10' };
  }
  if (c.type === 'TriggerSmartContract') {
    const input = v.data ? decodeInput(v.data) : null;
    return {
      ...base,
      contract: addr(v.contract_address),
      callValueSun: v.call_value || 0,
      method: input?.name || null,
      input,
      to: input?.to || null,
      amountRaw: input?.value ?? null,
    };
  }
  return base;
}

/** Decode all logs in a gettransactioninfobyid response. */
export function decodeTransactionInfoLogs(info) {
  return (info?.log || []).map(decodeEventLog);
}

function safeUtf8(hex) {
  try {
    const s = stripHex(hex);
    if (!/^[0-9a-f]*$/.test(s) || s.length % 2) return null;
    return new TextDecoder().decode(Uint8Array.from(s.match(/../g) || [], (h) => parseInt(h, 16)));
  } catch {
    return null;
  }
}

/** Fetch a transaction by id and decode calldata + logs in one go. */
export async function decodeTransactionById(txid, options = {}) {
  const client = options.client || new TronClient({ network: options.network || 'mainnet' });
  const [tx, info] = await Promise.all([client.getTransactionById(txid), client.getTransactionInfoById(txid)]);
  if (!tx || !tx.raw_data) throw new Error(`Transaction ${txid} not found on ${client.network}`);
  return { transaction: decodeTransaction(tx), events: decodeTransactionInfoLogs(info), info };
}

export default {
  FUNCTIONS,
  EVENTS,
  keccakHex,
  selector,
  eventTopic,
  decodeParameters,
  encodeParameter,
  encodeParameters,
  encodeCall,
  encodeTransfer,
  decodeInput,
  decodeEventLog,
  decodeTransaction,
  decodeTransactionInfoLogs,
  decodeTransactionById,
};
