import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
export function compareDependencies(before, after) {
  const first = new Map(before.packages.map(item => [item.path, item]));
  const last = new Map(after.packages.map(item => [item.path, item]));
  return [...new Set([...first.keys(), ...last.keys()])].sort().flatMap(path => {
    const a = first.get(path), b = last.get(path);
    if (a?.name === b?.name && a?.version === b?.version) return [];
    return [{ path, before: a ? { name: a.name, version: a.version } : null, after: b ? { name: b.name, version: b.version } : null }];
  });
}
export async function dependencySnapshot(root) {
  const packageBytes = await readFile(resolve(root, 'package.json')), lockBytes = await readFile(resolve(root, 'package-lock.json'));
  const lock = JSON.parse(lockBytes), packages = [], visited = new Set();
  const scan = async relativeDirectory => {
    let entries;
    try { entries = await readdir(resolve(root, relativeDirectory), { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue;
      const path = `${relativeDirectory}/${entry.name}`;
      if (entry.name.startsWith('@')) { await scan(path); continue; }
      let data;
      try { data = await readJson(resolve(root, path, 'package.json')); }
      catch (error) { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue; throw error; }
      const locked = lock.packages?.[path];
      packages.push({ path, name: data.name, version: data.version, lockVersion: locked?.version ?? null, versionMatchesLock: locked ? data.version === locked.version : null });
      const physical = await realpath(resolve(root, path));
      if (!visited.has(physical)) { visited.add(physical); await scan(`${path}/node_modules`); }
    }
  };
  await scan('node_modules');
  return { schemaVersion: 1, commit: process.env.GITHUB_SHA ?? process.env.CROSSING_WORLD_COMMIT ?? null,
    nodeVersion: process.version, npmVersion: execFileSync('npm', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(),
    platform: process.platform, arch: process.arch, packageJsonSha256: digest(packageBytes), lockSha256: digest(lockBytes), packages };
}
export async function portableSnapshot(root, path = 'artifacts/crossing-lives-world.html') {
  const bytes = await readFile(resolve(root, path));
  return { schemaVersion: 1, commit: process.env.GITHUB_SHA ?? process.env.CROSSING_WORLD_COMMIT ?? null,
    path, bytes: bytes.length, sha256: digest(bytes), scope: 'Exact portable bytes produced by this job; file and served diagnostics use this same artifact.' };
}
export async function exportArtifactReceipt(root, limit = 384 * 1024 * 1024) {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 384 * 1024 * 1024) throw new Error('Invalid export artifact bound');
  const paths = ['artifacts/crossing-lives-world.html', ...['dependencies-before.json', 'dependencies-after.json', 'declarations.json', 'dependency-changes.json', 'portable.json'].map(name => `artifacts/world-webkit/build/${name}`)];
  const files = [];
  for (const path of paths) { const bytes = await readFile(resolve(root, path)); files.push({ path, bytes: bytes.length, sha256: digest(bytes) }); }
  const portable = await readJson(resolve(root, 'artifacts/world-webkit/build/portable.json'));
  if (portable.bytes !== files[0].bytes || portable.sha256 !== files[0].sha256) throw new Error('Portable bytes changed after source snapshot');
  const payloadBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (payloadBytes > limit) throw new Error('Exact export artifact exceeds its bounded payload');
  return { schemaVersion: 1, commit: process.env.GITHUB_SHA ?? null, files, payloadBytes, maximumPayloadBytes: limit,
    scope: 'Original standalone HTML plus build evidence; separate from the small diagnostic review. Receipt and ZIP overhead fit below the 512 MiB connector limit.' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, output, beforePath, afterPath] = process.argv.slice(2);
  if (!output) throw new Error('Usage: webkit-build-evidence.mjs dependencies|portable|export-artifact OUTPUT; or compare OUTPUT BEFORE AFTER');
  let result;
  if (command === 'dependencies') result = await dependencySnapshot(beforePath ? resolve(beforePath) : process.cwd());
  else if (command === 'portable') result = await portableSnapshot(process.cwd());
  else if (command === 'export-artifact') result = await exportArtifactReceipt(process.cwd());
  else if (command === 'compare') {
    const before = await readJson(resolve(beforePath)), after = await readJson(resolve(afterPath));
    result = { commit: process.env.GITHUB_SHA ?? null, changes: compareDependencies(before, after), lockUnchanged: before.lockSha256 === after.lockSha256,
      scope: 'Observed installed package name/version changes. Does not establish which change affects export bytes or WebKit behavior.' };
  } else throw new Error(`Unknown command: ${command}`);
  await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(resolve(output), JSON.stringify(result, null, 2) + '\n');
}
