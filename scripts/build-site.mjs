#!/usr/bin/env node
// Builds static, crawler-friendly landing pages for every package from its README + package.json.
// Output: site/dist/tools/<name>/index.html, site/dist/tools/index.html, site/dist/tools/sitemap.xml
// Drop the `tools/` folder into tronless.app/frontend/public/ (or any static host) to publish it at
// https://tronless.app/tools/<name>/ — every page carries SoftwareApplication + FAQPage + Breadcrumb JSON-LD.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.SITE_ORIGIN || 'https://tronless.app';
const BASE = process.env.SITE_BASE || '/tools';
const OUT = path.join(root, 'site', 'dist', BASE.replace(/^\//, ''));
const REPO = 'https://github.com/TronLess/tron-tools/tree/main';
const today = new Date().toISOString().slice(0, 10);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Pull the FAQ section (## FAQ … next H2) out of a README as [{q, a}]. */
function extractFaq(md) {
  const m = /## FAQ\s*\n([\s\S]*?)(?=\n## |\s*$)/.exec(md);
  if (!m) return [];
  const out = [];
  const re = /### (.+?)\n([\s\S]*?)(?=\n### |\s*$)/g;
  let x;
  while ((x = re.exec(m[1]))) out.push({ q: x[1].trim(), a: x[2].trim().replace(/\s+/g, ' ') });
  return out;
}

function firstParagraph(md) {
  const body = md.replace(/^# .*\n/, '').replace(/^\s*\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)\s*$/gm, '');
  const p = body.split(/\n\s*\n/).map((s) => s.trim()).find((s) => s && !s.startsWith('#') && !s.startsWith('[![') && !s.startsWith('**Part of'));
  return (p || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '');
}

const CSS = `
:root{--bg:#0b0d12;--fg:#e8eaf0;--muted:#9aa3b2;--accent:#ff4d2e;--card:#141823;--line:#232838}
@media (prefers-color-scheme: light){:root{--bg:#fff;--fg:#141823;--muted:#5b6474;--card:#f6f7fa;--line:#e3e6ee}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 20px 80px}a{color:var(--accent)}nav.crumbs{font-size:14px;color:var(--muted);margin-bottom:24px}
h1{font-size:2rem;line-height:1.2;margin:.2em 0}h2{margin-top:2em;border-bottom:1px solid var(--line);padding-bottom:.3em}
pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px;overflow:auto;font-size:14px}code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
p code,li code,td code{background:var(--card);padding:.1em .35em;border-radius:4px;font-size:.92em}
table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
.cta{margin:32px 0;padding:18px 20px;background:var(--card);border:1px solid var(--line);border-radius:10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-top:20px}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px}
.card h3{margin:0 0 .4em;font-size:1.05rem}.card p{margin:0;color:var(--muted);font-size:.95rem}footer{margin-top:60px;color:var(--muted);font-size:14px}
img{max-width:100%}
`;

function layout({ title, description, canonical, jsonLd, body, ogType = 'website' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="TronLess">
<meta property="og:image" content="${SITE}/main-logo.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<link rel="icon" href="/favicon.ico">
<style>${CSS}</style>
${jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n')}
</head>
<body>
<main>
${body}
<footer>© ${today.slice(0, 4)} <a href="${SITE}/">TronLess</a> · MIT-licensed developer tools for the TRON network · <a href="${REPO}">Source on GitHub</a></footer>
</main>
</body>
</html>
`;
}

const packagesDir = path.join(root, 'packages');
const packages = readdirSync(packagesDir)
  .filter((d) => existsSync(path.join(packagesDir, d, 'package.json')))
  .map((d) => {
    const pkg = JSON.parse(readFileSync(path.join(packagesDir, d, 'package.json'), 'utf8'));
    const readmePath = path.join(packagesDir, d, 'README.md');
    const md = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : `# ${pkg.name}\n\n${pkg.description}`;
    return { dir: d, pkg, md };
  });

mkdirSync(OUT, { recursive: true });
const urls = [];

for (const { dir, pkg, md } of packages) {
  const url = `${SITE}${BASE}/${dir}/`;
  const h1 = (/^# (.+)$/m.exec(md) || [, pkg.name])[1].replace(/[`*]/g, '');
  const title = `${h1} | TronLess Tools`;
  const description = pkg.description;
  const faq = extractFaq(md);
  const bodyMd = md.replace(/^# .*\n/, '');
  const html = marked.parse(bodyMd, { gfm: true });
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: pkg.name,
      alternateName: h1,
      description,
      url,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Node.js >= 18',
      softwareVersion: pkg.version,
      license: 'https://opensource.org/licenses/MIT',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      downloadUrl: `https://www.npmjs.com/package/${pkg.name}`,
      codeRepository: `${REPO}/packages/${dir}`,
      keywords: (pkg.keywords || []).join(', '),
      author: { '@type': 'Organization', name: 'TronLess', url: `${SITE}/` },
      publisher: { '@type': 'Organization', name: 'TronLess', url: `${SITE}/` },
      datePublished: '2026-09-08',
      dateModified: today,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: pkg.name,
      codeRepository: `${REPO}/packages/${dir}`,
      programmingLanguage: 'JavaScript',
      runtimePlatform: 'Node.js',
      license: 'https://opensource.org/licenses/MIT',
      url,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'TronLess', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Developer tools', item: `${SITE}${BASE}/` },
        { '@type': 'ListItem', position: 3, name: h1, item: url },
      ],
    },
  ];
  if (faq.length) {
    jsonLd.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  const body = `
<nav class="crumbs"><a href="${SITE}/">TronLess</a> › <a href="${SITE}${BASE}/">Developer tools</a> › ${esc(h1)}</nav>
<h1>${esc(h1)}</h1>
<p><a href="https://www.npmjs.com/package/${pkg.name}">npm: ${pkg.name}</a> · <a href="${REPO}/packages/${dir}">GitHub</a> · MIT · Node.js ≥ 18</p>
${html}
<div class="cta"><strong>Need energy for USDT transfers?</strong> TronLess rents TRON energy to wallets, exchanges and bots — <a href="${SITE}/tron-energy">how it works</a> · <a href="${SITE}/api">API</a> · <a href="https://t.me/tronless_bot">Telegram bot</a>.</div>
`;
  const dirOut = path.join(OUT, dir);
  mkdirSync(dirOut, { recursive: true });
  writeFileSync(path.join(dirOut, 'index.html'), layout({ title, description, canonical: url, jsonLd, body, ogType: 'article' }));
  urls.push({ loc: url, priority: '0.8' });
  console.log(`built ${BASE}/${dir}/  (${faq.length} FAQ items)`);
}

// Hub page
const hubMd = existsSync(path.join(root, 'README.md')) ? readFileSync(path.join(root, 'README.md'), 'utf8') : '# TronLess Tools';
const hubTitle = 'TRON Developer Tools: address, energy, TRC-20, transaction and RPC utilities | TronLess';
const hubDesc = 'Free, MIT-licensed Node.js tools for TRON developers by TronLess: address validator, SUN/TRX units, wallet generator, energy fee calculator, account resources, TRC-20 decoder, token reader, transaction inspector, RPC health checker and address watcher.';
const hubUrl = `${SITE}${BASE}/`;
const cards = packages
  .map(({ dir, pkg, md }) => {
    const h1 = (/^# (.+)$/m.exec(md) || [, pkg.name])[1].replace(/[`*]/g, '');
    return `<a class="card" href="${SITE}${BASE}/${dir}/"><h3>${esc(h1)}</h3><p>${esc(firstParagraph(md).slice(0, 180))}…</p></a>`;
  })
  .join('\n');
const hubBody = `
<nav class="crumbs"><a href="${SITE}/">TronLess</a> › Developer tools</nav>
${marked.parse(hubMd.replace(/^# .*\n/, '<h1>TRON developer tools by TronLess</h1>\n'), { gfm: true })}
<h2>All tools</h2>
<div class="grid">${cards}</div>
`;
const hubJsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: hubTitle,
    description: hubDesc,
    url: hubUrl,
    isPartOf: { '@type': 'WebSite', name: 'TronLess', url: `${SITE}/` },
    about: { '@type': 'Thing', name: 'TRON blockchain developer tools' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: packages.map(({ dir, pkg }, i) => ({ '@type': 'ListItem', position: i + 1, name: pkg.name, url: `${SITE}${BASE}/${dir}/` })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TronLess', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Developer tools', item: hubUrl },
    ],
  },
];
writeFileSync(path.join(OUT, 'index.html'), layout({ title: hubTitle, description: hubDesc, canonical: hubUrl, jsonLd: hubJsonLd, body: hubBody }));
urls.unshift({ loc: hubUrl, priority: '0.9' });

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);
console.log(`built ${BASE}/ hub + sitemap.xml with ${urls.length} URLs → ${OUT}`);
