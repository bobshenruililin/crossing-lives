import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { diagnosticResponse } from './serve-webkit-diagnostic.mjs';

test('diagnostic HTTP transport preserves exact export bytes, including unicode and binary payload bytes', () => {
  const bytes = Buffer.concat([Buffer.from('<!doctype html>香港\n<script>const x="data:image/webp;base64,AABC";</script>'), Buffer.from([0, 255, 13, 10])]);
  const served = diagnosticResponse('/crossing-lives-world.html', bytes);
  assert.equal(served.status, 200); assert.equal(served.type, 'text/html; charset=utf-8');
  assert.strictEqual(served.body, bytes); assert.deepEqual(served.body, bytes);
  const ready = JSON.parse(diagnosticResponse('/__diagnostic-ready', bytes).body);
  assert.equal(ready.bytes, bytes.length); assert.equal(ready.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(diagnosticResponse('/different-file.html', bytes).status, 404);
});
test('file outcome remains independent and served proof is labelled honestly', async () => {
  const source = await readFile(new URL('../tests/world-webkit-diagnostics/served-world.spec.ts', import.meta.url), 'utf8');
  assert.match(source, /expect\(responseSha256\)\.toBe\(sourceSha256\)/);
  assert.match(source, /expect\(servedBytes\)\.toBe\(sourceBytes\.length\)/);
  assert.match(source, /offline: false/); assert.match(source, /does not establish offline file support/);
  assert.match(source, /served-world\.json/); assert.doesNotMatch(source, /webkit-smoke\.json|page\.goto\(pathToFileURL/);
  const baseline = await readFile(new URL('../tests/world-webkit-diagnostics/tiny-file.spec.ts', import.meta.url), 'utf8');
  assert.match(baseline, /test\.use\(\{ offline: true \}\)/); assert.match(baseline, /tiny-file\.json/);
  const workflow = await readFile(new URL('../.github/workflows/webkit-smoke.yml', import.meta.url), 'utf8');
  assert.ok(workflow.indexOf('playwright.webkit-smoke.config.ts') < workflow.indexOf('playwright.webkit-diagnostics.config.ts'));
  assert.match(workflow, /Diagnose tiny file[\s\S]*?always\(\)/);
  assert.doesNotMatch(workflow, /continue-on-error|no-sandbox|disable-web-security/);
});


test('dependency evidence detects additions, removals and version changes independently of lockfile assumptions', async () => {
  const { compareDependencies } = await import('./webkit-build-evidence.mjs');
  const before = { packages: [{ path: 'node_modules/a', name: 'a', version: '1' }, { path: 'node_modules/b', name: 'b', version: '1' }] };
  const after = { packages: [{ path: 'node_modules/a', name: 'a', version: '2' }, { path: 'node_modules/c', name: 'c', version: '1' }] };
  const changes = compareDependencies(before, after);
  assert.deepEqual(changes.map(item => item.path), ['node_modules/a', 'node_modules/b', 'node_modules/c']);
  assert.deepEqual(changes[0], { path: 'node_modules/a', before: { name: 'a', version: '1' }, after: { name: 'a', version: '2' } });
  assert.equal(changes[1].after, null); assert.equal(changes[2].before, null);
  assert.deepEqual(compareDependencies(before, before), []);
});


test('separate export artifact preserves exact HTML, rejects changed bytes and caps payload size', async () => {
  const { exportArtifactReceipt, portableSnapshot } = await import('./webkit-build-evidence.mjs');
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os'); const { resolve } = await import('node:path');
  const root = await mkdtemp(resolve(tmpdir(), 'webkit-build-evidence-'));
  try {
    await mkdir(resolve(root, 'artifacts/world-webkit/build'), { recursive: true });
    const html = resolve(root, 'artifacts/crossing-lives-world.html'); await writeFile(html, '<!doctype html>Exact portable 香港');
    for (const name of ['dependencies-before.json', 'dependencies-after.json', 'declarations.json', 'dependency-changes.json']) await writeFile(resolve(root, 'artifacts/world-webkit/build', name), '{}');
    const portable = await portableSnapshot(root); await writeFile(resolve(root, 'artifacts/world-webkit/build/portable.json'), JSON.stringify(portable));
    const receipt = await exportArtifactReceipt(root);
    assert.equal(receipt.files.length, 6); assert.equal(receipt.files[0].sha256, portable.sha256);
    assert.equal(receipt.files[0].bytes, portable.bytes); assert.ok(receipt.payloadBytes < receipt.maximumPayloadBytes);
    await assert.rejects(exportArtifactReceipt(root, 1), /exceeds/);
    await writeFile(html, 'changed'); await assert.rejects(exportArtifactReceipt(root), /changed after/);
  } finally { await rm(root, { recursive: true, force: true }); }
});


test('WebKit declarations install is isolated and strict tsc explicitly uses its type roots', async () => {
  const workflow = await readFile(new URL('../.github/workflows/webkit-smoke.yml', import.meta.url), 'utf8');
  assert.match(workflow, /npm install --prefix "\$RUNNER_TEMP\/crossing-node-types" --save-exact/);
  assert.match(workflow, /--typeRoots "\$RUNNER_TEMP\/crossing-node-types\/node_modules\/@types,\.\/node_modules\/@types"/);
  assert.match(workflow, /declarations\.json "\$RUNNER_TEMP\/crossing-node-types"/);
  assert.doesNotMatch(workflow, /npm install --no-save --package-lock=false/);
});
