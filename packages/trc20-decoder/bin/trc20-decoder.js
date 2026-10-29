#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { decodeInput, decodeEventLog, decodeTransactionById, selector, eventTopic, encodeTransfer, FUNCTIONS } from '../src/index.js';
import { clientFromFlags } from '@tronless/tron-client';

const HELP = `trc20-decoder — decode TRC-20 calldata, event logs and transactions

Usage:
  trc20-decoder <calldata-hex>                      decode input data (a9059cbb...)
  trc20-decoder --tx <txid> [--network nile]        fetch + decode a transaction and its events
  trc20-decoder --log '{"topics":[...],"data":"..."}'  decode one event log
  trc20-decoder --selector "transfer(address,uint256)"  compute a 4-byte selector
  trc20-decoder --topic "Transfer(address,address,uint256)"  compute an event topic
  trc20-decoder --encode-transfer <to> <amountRaw>  build transfer() calldata
  trc20-decoder --list                              list known selectors

Options:
  --signature "foo(address,uint256)"   decode an unknown selector with this signature
  --json                               machine-readable output
  --network, --node, --api-key         see @tronless/tron-client
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    tx: { type: 'string' },
    log: { type: 'string' },
    selector: { type: 'string' },
    topic: { type: 'string' },
    'encode-transfer': { type: 'boolean' },
    list: { type: 'boolean' },
    signature: { type: 'string' },
    json: { type: 'boolean' },
    network: { type: 'string' },
    node: { type: 'string' },
    'api-key': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

const out = (obj) => console.log(JSON.stringify(obj, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));

try {
  if (values.help) {
    console.log(HELP);
  } else if (values.list) {
    for (const [sel, sig] of Object.entries(FUNCTIONS)) console.log(`${sel}  ${sig}`);
  } else if (values.selector) {
    console.log(selector(values.selector));
  } else if (values.topic) {
    console.log(eventTopic(values.topic));
  } else if (values['encode-transfer']) {
    if (positionals.length < 2) throw new Error('--encode-transfer needs <to> <amountRaw>');
    console.log(encodeTransfer(positionals[0], positionals[1]));
  } else if (values.tx) {
    const res = await decodeTransactionById(values.tx, { client: clientFromFlags(values) });
    if (values.json) out({ transaction: res.transaction, events: res.events });
    else {
      const t = res.transaction;
      console.log(`type:     ${t.type}${t.method ? ` → ${t.method}()` : ''}`);
      console.log(`from:     ${t.from}`);
      if (t.contract) console.log(`contract: ${t.contract}`);
      if (t.to) console.log(`to:       ${t.to}`);
      if (t.amountSun !== undefined) console.log(`amount:   ${t.amountSun} SUN`);
      if (t.amountRaw != null) console.log(`amount:   ${t.amountRaw} (raw token units)`);
      console.log(`result:   ${t.result}`);
      for (const e of res.events) {
        console.log(`event:    ${e.name || e.topic0} ${e.args.map((a) => `${a.name}=${typeof a.value === 'object' ? a.value.base58 : a.value}`).join(' ')}`);
      }
    }
  } else if (values.log) {
    out(decodeEventLog(JSON.parse(values.log)));
  } else if (positionals[0]) {
    const d = decodeInput(positionals[0], { signature: values.signature });
    if (values.json) out(d);
    else if (!d.known) console.log(`selector ${d.selector}: unknown (pass --signature to decode)`);
    else {
      console.log(`${d.signature}`);
      for (const a of d.args) console.log(`  ${a.name} (${a.type}): ${typeof a.value === 'object' ? `${a.value.base58} / ${a.value.hex}` : a.value}`);
    }
  } else {
    console.log(HELP);
    process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
}
