/** Package the normal production build as a self-contained, import-free offline demo.
 * No source architecture is forked: this embeds the exact build and its original assets.
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
let html = await readFile(path.join(dist, 'index.html'), 'utf8');
const jsMatch = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/);
const cssMatch = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/);
if (!jsMatch || !cssMatch) throw new Error('Expected one Vite JavaScript and CSS entry. Run npm run build first.');
const local = (url) => path.join(dist, url.replace(/^\.\//, ''));
const js = await readFile(local(jsMatch[1]), 'utf8');
if (/\bimport\s*\(/.test(js) || /^import[\s{*]/m.test(js)) throw new Error('Portable export requires a fully bundled entry with no network module imports.');
let css = await readFile(local(cssMatch[1]), 'utf8');
const cssDirectory = path.dirname(local(cssMatch[1]));
for (const match of [...css.matchAll(/url\(([^)]+)\)/g)]) {
  const url = match[1].replace(/["']/g, '').trim();
  if (/^data:/.test(url)) continue;
  if (/^(https?:)?\/\//.test(url)) throw new Error(`External asset in CSS: ${url}`);
  const bytes = await readFile(path.resolve(cssDirectory, url));
  const mime = url.endsWith('.woff2') ? 'font/woff2' : url.endsWith('.woff') ? 'font/woff' : 'application/octet-stream';
  css = css.replace(match[0], `url(data:${mime};base64,${bytes.toString('base64')})`);
}
const artwork = {};
for (const name of await readdir(path.join(dist, 'art'))) {
  if (!name.endsWith('.webp')) continue;
  artwork[name] = `data:image/webp;base64,${(await readFile(path.join(dist, 'art', name))).toString('base64')}`;
}
const safeScript = (text) => text.replace(/<\/script/gi, '<\\/script');
html = html.replace(jsMatch[0], `<script>globalThis.__BETWEEN_ART__=${JSON.stringify(artwork)};</script><script type="module">${safeScript(js)}</script>`);
html = html.replace(cssMatch[0], `<style>${css}</style>`);
const favicon = await readFile(path.join(dist, 'favicon.svg'));
html = html.replace(/href="\.\/favicon\.svg"/, `href="data:image/svg+xml;base64,${favicon.toString('base64')}"`);
html = html.replace('</head>', '<meta name="crossing-lives-export" content="Self-contained demo; no network requests required"></head>');
const notices = await readFile(path.join(dist, 'THIRD_PARTY_NOTICES.txt'), 'utf8');
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
html = html.replace('</body>', `<template id="third-party-notices"><pre>${escapeHtml(notices)}</pre></template></body>`);
await mkdir(path.join(root, 'artifacts'), {recursive:true});
const filename = process.argv[2] ?? 'crossing-lives-portable.html';
if (!/^[a-zA-Z0-9._-]+\.html$/.test(filename)) throw new Error('Export name must be a plain .html filename.');
const target = path.join(root, 'artifacts', filename);
await writeFile(target, html);
console.log(`Portable demo: ${target} (${(Buffer.byteLength(html)/1024/1024).toFixed(2)} MiB). Still requires file:// browser verification.`);
