#!/usr/bin/env node
// Runs `npm test` in every workspace package. `--live` also enables the network tests.
import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const live = process.argv.includes('--live');
const packagesDir = path.join(root, 'packages');
let failed = 0;
for (const name of readdirSync(packagesDir)) {
  const dir = path.join(packagesDir, name);
  if (!existsSync(path.join(dir, 'package.json'))) continue;
  console.log(`\n=== ${name}${live ? ' (live)' : ''} ===`);
  const res = spawnSync(process.execPath, ['--test'], {
    cwd: dir,
    stdio: 'inherit',
    env: { ...process.env, ...(live ? { TRON_LIVE: '1' } : {}) },
  });
  if (res.status !== 0) failed += 1;
}
console.log(failed ? `\n${failed} package(s) failed` : '\nAll packages passed');
process.exitCode = failed ? 1 : 0;
