#!/usr/bin/env node
import { parseArgs } from 'node:util';
import {
  createAccount, createMnemonicAccount, fromMnemonic, deriveAccounts, accountFromPrivateKey,
  findVanityAddress, estimateVanityAttempts,
} from '../src/index.js';

const HELP = `tron-keygen — generate TRON keys, addresses and mnemonics offline

Usage:
  tron-keygen                                new random private key + address
  tron-keygen --mnemonic [--words 24]        new BIP-39 mnemonic + first account
  tron-keygen --from-mnemonic "<12 words>" [--index 0] [--count 5] [--passphrase X]
  tron-keygen --from-private-key <hex>       address for an existing private key
  tron-keygen --vanity TLess [--suffix 99] [--ignore-case] [--max 5000000]

Options:
  --json          machine-readable output
  --no-warning    hide the safety notice

All operations are offline. Never paste real private keys into shared terminals or CI logs.
`;

const { values } = parseArgs({
  options: {
    mnemonic: { type: 'boolean' },
    words: { type: 'string' },
    'from-mnemonic': { type: 'string' },
    index: { type: 'string' },
    count: { type: 'string' },
    passphrase: { type: 'string' },
    'from-private-key': { type: 'string' },
    vanity: { type: 'string' },
    suffix: { type: 'string' },
    'ignore-case': { type: 'boolean' },
    max: { type: 'string' },
    json: { type: 'boolean' },
    'no-warning': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help) {
  console.log(HELP);
  process.exit(0);
}

const print = (obj) => {
  if (values.json) {
    console.log(JSON.stringify(obj, null, 2));
    return;
  }
  const rows = Array.isArray(obj) ? obj : [obj];
  for (const r of rows) {
    if (r.mnemonic) console.log(`mnemonic:    ${r.mnemonic}`);
    if (r.path) console.log(`path:        ${r.path}`);
    console.log(`address:     ${r.address}`);
    console.log(`hex:         ${r.hexAddress}`);
    console.log(`private key: ${r.privateKey}`);
    if (r.attempts) console.log(`attempts:    ${r.attempts}`);
    console.log('');
  }
  if (!values['no-warning']) {
    console.error('⚠  Store the private key / mnemonic offline. Anyone who has it controls the funds.');
  }
};

try {
  if (values['from-private-key']) {
    print(accountFromPrivateKey(values['from-private-key']));
  } else if (values['from-mnemonic']) {
    const count = values.count ? Number(values.count) : 1;
    const index = values.index ? Number(values.index) : 0;
    const opts = { passphrase: values.passphrase };
    print(count > 1 ? deriveAccounts(values['from-mnemonic'], count, { ...opts, startIndex: index }) : fromMnemonic(values['from-mnemonic'], { ...opts, index }));
  } else if (values.mnemonic) {
    print(createMnemonicAccount({ words: values.words ? Number(values.words) : 12, passphrase: values.passphrase }));
  } else if (values.vanity) {
    const opts = {
      prefix: values.vanity,
      suffix: values.suffix || '',
      caseSensitive: !values['ignore-case'],
      maxAttempts: values.max ? Number(values.max) : Infinity,
    };
    const est = estimateVanityAttempts(opts);
    console.error(`Searching for ${opts.prefix}…${opts.suffix} (≈${est.toLocaleString()} keys on average)`);
    const started = Date.now();
    const res = findVanityAddress({
      ...opts,
      onProgress: (n) => process.stderr.write(`\r${n.toLocaleString()} keys, ${(n / ((Date.now() - started) / 1000)).toFixed(0)} keys/s   `),
    });
    process.stderr.write('\n');
    print(res);
  } else {
    print(createAccount());
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
}
