/** Embed the separate production decision entry, never a mock of its UI.
 * No legacy illustration payload or personal state is added to this artifact.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist-decision');
let html = await readFile(path.join(dist, 'decision.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)];
const styles = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)];
if (scripts.length !== 1 || styles.length !== 1) throw new Error('Expected one bundled decision module and stylesheet.');
const local = url => {
  if (/^(https?:)?\/\//.test(url)) throw new Error(`External build entry: ${url}`);
  const filename = path.resolve(dist, url.replace(/^\.\//, ''));
  if (!filename.startsWith(`${dist}${path.sep}`)) throw new Error('Build asset escapes the decision output directory.');
  return filename;
};
const moduleSource = await readFile(local(scripts[0][1]), 'utf8');
if (/\bimport\s*\(/.test(moduleSource) || /^import[\s{*]/m.test(moduleSource)) throw new Error('The decision entry must be fully bundled.');
let css = await readFile(local(styles[0][1]), 'utf8');
const cssDirectory = path.dirname(local(styles[0][1]));
for (const match of [...css.matchAll(/url\(([^)]+)\)/g)]) {
  const url = match[1].replace(/["']/g, '').trim();
  if (url.startsWith('data:')) continue;
  if (/^(https?:)?\/\//.test(url)) throw new Error(`External CSS asset: ${url}`);
  const filename = path.resolve(cssDirectory, url);
  if (!filename.startsWith(`${dist}${path.sep}`)) throw new Error('CSS asset escapes the decision output directory.');
  const bytes = await readFile(filename);
  const mime = url.endsWith('.woff2') ? 'font/woff2' : url.endsWith('.woff') ? 'font/woff' : url.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream';
  css = css.replace(match[0], () => `url(data:${mime};base64,${bytes.toString('base64')})`);
}
const safeScript = text => text.replace(/<\/script/gi, '<\\/script');
// Only the one approved decision-world image belongs to this entry. Do not add
// the legacy story's unused illustration payload to this focused prototype.
const artworkName = 'decision-hk-pixel.webp';
const artwork = { [artworkName]: `data:image/webp;base64,${(await readFile(path.join(dist, 'art', artworkName))).toString('base64')}` };
html = html.replace(scripts[0][0], () => `<script>globalThis.__BETWEEN_ART__=${JSON.stringify(artwork)};</script><script type="module">${safeScript(moduleSource)}</script>`);
html = html.replace(styles[0][0], () => `<style>${css}</style>`);
if (/href="\.\/favicon\.svg"/.test(html)) {
  const favicon = await readFile(path.join(dist, 'favicon.svg'));
  html = html.replace(/href="\.\/favicon\.svg"/g, () => `href="data:image/svg+xml;base64,${favicon.toString('base64')}"`);
}
const notices = await readFile(path.join(dist, 'THIRD_PARTY_NOTICES.txt'), 'utf8');
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
html = html.replace('</head>', '<meta name="crossing-lives-export" content="Self-contained decision prototype; authored example; no personal storage"></head>');
html = html.replace('</body>', () => `<template id="third-party-notices"><pre>${escapeHtml(notices)}</pre></template></body>`);
const embedded = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if (embedded !== safeScript(moduleSource)) throw new Error('The embedded module differs from the production build.');
const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: embedded, encoding: 'utf8' });
if (syntax.status !== 0) throw new Error(`Decision module syntax failed: ${syntax.stderr}`);
await mkdir(path.join(root, 'artifacts'), { recursive: true });
const output = path.join(root, 'artifacts/crossing-lives-decision-prototype.html');
await writeFile(output, html);
console.log(`Decision portable: ${output} (${Buffer.byteLength(html)} bytes). Actual offline browser verification remains required.`);
