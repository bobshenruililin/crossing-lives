/** Export the production world unchanged, with a separate embedded asset namespace. */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..'), dist = path.join(root, 'dist-world');
let html = await readFile(path.join(dist, 'world.html'), 'utf8');
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)];
const styles = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)];
if (scripts.length !== 1 || styles.length !== 1) throw new Error('Expected one bundled world entry and stylesheet.');
const local = (url, directory = dist) => {
  if (/^(https?:)?\/\//.test(url)) throw new Error(`External export resource: ${url}`);
  const filename = path.resolve(directory, url.replace(/^\.\//, ''));
  if (!filename.startsWith(`${dist}${path.sep}`)) throw new Error('Asset escapes world output.');
  return filename;
};
const mime = filename => ({ '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' }[path.extname(filename)] ?? 'application/octet-stream');
const data = async filename => `data:${mime(filename)};base64,${(await readFile(filename)).toString('base64')}`;
const moduleSource = await readFile(local(scripts[0][1]), 'utf8');
if (/\bimport\s*\(/.test(moduleSource) || /^import[\s{*]/m.test(moduleSource)) throw new Error('World module must be fully bundled.');
let css = await readFile(local(styles[0][1]), 'utf8');
for (const match of [...css.matchAll(/url\(([^)]+)\)/g)]) {
  const source = match[1].replace(/["']/g, '').trim(); if (source.startsWith('data:')) continue;
  const embeddedUrl = await data(local(source, path.dirname(local(styles[0][1]))));
  css = css.replace(match[0], () => `url(${embeddedUrl})`);
}
const artwork = {};
// public-world is the lead-approved asset boundary. No legacy art, manifests or documents are embedded.
for (const name of await readdir(path.join(dist, 'art'))) {
  if (!/\.(webp|png|jpg|svg)$/.test(name)) continue;
  artwork[`art/${name}`] = await data(path.join(dist, 'art', name));
}
if (!artwork['art/player.webp'] || !artwork['art/friend.webp']) throw new Error('Approved party sprites missing.');
const safe = source => source.replace(/<\/script/gi, '<\\/script');
html = html.replace(scripts[0][0], () => `<script>globalThis.__CROSSING_WORLD_ASSETS__=${JSON.stringify(artwork)};</script><script type="module">${safe(moduleSource)}</script>`);
html = html.replace(styles[0][0], () => `<style>${css}</style>`);
const notices = await readFile(path.join(dist, 'THIRD_PARTY_NOTICES.txt'), 'utf8');
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
html = html.replace('</head>', '<meta name="crossing-lives-export" content="Self-contained connected world; fictional examples; in-tab state only"></head>');
html = html.replace('</body>', () => `<template id="third-party-notices"><pre>${escapeHtml(notices)}</pre></template></body>`);
const embedded = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if (embedded !== safe(moduleSource)) throw new Error('Export differs from production world module.');
const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: embedded, encoding: 'utf8' });
if (syntax.status !== 0) throw new Error(`World module syntax failed: ${syntax.stderr}`);
if (/\blocalStorage\b|\bsessionStorage\b/.test(moduleSource)) throw new Error('World must not access browser storage.');
await mkdir(path.join(root, 'artifacts'), { recursive: true });
const output = path.join(root, 'artifacts/crossing-lives-world.html');
await writeFile(output, html);
console.log(`World portable: ${output} (${Buffer.byteLength(html)} bytes; ${Object.keys(artwork).length} embedded assets). Real offline browser verification still required.`);
