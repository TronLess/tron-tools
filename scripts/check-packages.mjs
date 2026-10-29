#!/usr/bin/env node
// Sanity checks every package before publishing: metadata, bin, types, README structure, SEO fields.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = path.join(root, 'packages');
const problems = [];
const ok = (cond, msg) => {
  if (!cond) problems.push(msg);
};

const names = [];
for (const dir of readdirSync(packagesDir)) {
  const pkgPath = path.join(packagesDir, dir, 'package.json');
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const tag = `[${dir}]`;
  names.push(pkg.name);
  ok(pkg.name === `@tronless/${dir}`, `${tag} name should be @tronless/${dir}, got ${pkg.name}`);
  ok(pkg.type === 'module', `${tag} "type" must be "module"`);
  ok(pkg.license === 'MIT', `${tag} license must be MIT`);
  ok(typeof pkg.description === 'string' && pkg.description.length >= 80 && pkg.description.length <= 320, `${tag} description should be 80–320 chars (${pkg.description?.length})`);
  ok(Array.isArray(pkg.keywords) && pkg.keywords.length >= 8, `${tag} needs at least 8 keywords`);
  ok(pkg.keywords?.includes('tron'), `${tag} keywords must include "tron"`);
  ok(pkg.repository?.directory === `packages/${dir}`, `${tag} repository.directory must be packages/${dir}`);
  ok(pkg.homepage?.includes(dir), `${tag} homepage should point at the package`);
  ok(pkg.publishConfig?.access === 'public', `${tag} publishConfig.access must be "public"`);
  ok(pkg.engines?.node, `${tag} engines.node missing`);
  ok(pkg.exports?.['.'] === './src/index.js', `${tag} exports["."] must be ./src/index.js`);
  ok(pkg.types === './index.d.ts' && existsSync(path.join(packagesDir, dir, 'index.d.ts')), `${tag} index.d.ts missing`);
  for (const [bin, file] of Object.entries(pkg.bin || {})) {
    const p = path.join(packagesDir, dir, file);
    ok(existsSync(p), `${tag} bin ${bin} → ${file} missing`);
    if (existsSync(p)) ok(readFileSync(p, 'utf8').startsWith('#!/usr/bin/env node'), `${tag} bin ${file} needs a node shebang`);
  }
  for (const f of ['src', 'bin', 'index.d.ts', 'README.md']) ok(pkg.files?.includes(f), `${tag} files[] must include ${f}`);
  const readme = path.join(packagesDir, dir, 'README.md');
  ok(existsSync(readme), `${tag} README.md missing`);
  if (existsSync(readme)) {
    const md = readFileSync(readme, 'utf8');
    ok(/^# /m.test(md), `${tag} README needs an H1`);
    ok(/## (Install|Installation)/.test(md), `${tag} README needs an Install section`);
    ok(/## FAQ/.test(md), `${tag} README needs a FAQ section`);
    ok(/tronless\.app/.test(md), `${tag} README should link to tronless.app`);
    ok(md.length >= 2500, `${tag} README is thin (${md.length} chars)`);
  }
  for (const dep of Object.keys(pkg.dependencies || {})) {
    if (dep.startsWith('@tronless/')) ok(existsSync(path.join(packagesDir, dep.replace('@tronless/', ''))), `${tag} internal dep ${dep} not found`);
  }
}
console.log(`Checked ${names.length} packages: ${names.join(', ')}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(` - ${p}`);
  process.exitCode = 1;
} else {
  console.log('All checks passed');
}
