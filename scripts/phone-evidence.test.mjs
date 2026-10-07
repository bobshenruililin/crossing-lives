import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { makeBundle, makeReview, summarizeTests, uploadBundle, uploadFilm, PART_BYTES, FILM_PAYLOAD_BYTES } from './phone-evidence.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
async function fixture() {
  const base = await mkdtemp(resolve(tmpdir(), 'phone-evidence-test-'));
  const root = resolve(base, 'repo'); await mkdir(root);
  const put = async (path, bytes) => { const target = resolve(root, path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes); return target; };
  return { base, root, put };
}
const reportFor = tests => ({ suites: [{ title: 'world.spec.ts', specs: tests.map(([title, status, results, expectedStatus = 'passed']) => ({ title, file: 'world.spec.ts', line: 12, tests: [{ projectName: 'world-production', status, expectedStatus, results }] })) }] });

test('summaries distinguish retries, flaky, skipped, expected failures, timeouts and no attempts', () => {
  const result = summarizeTests(reportFor([
    ['retry succeeds', 'flaky', [{ retry: 0, status: 'failed' }, { retry: 1, status: 'passed' }]],
    ['skipped', 'skipped', [{ retry: 0, status: 'skipped' }]],
    ['expected failure', 'expected', [{ retry: 0, status: 'failed' }], 'failed'],
    ['timeout', 'unexpected', [{ retry: 0, status: 'timedOut', errors: [{ message: '\u001b[31mroute is blocked\u001b[0m' }] }]],
    ['not run', 'skipped', []],
  ]));
  assert.deepEqual(result.map(item => item.outcome), ['flaky', 'skipped', 'expected', 'unexpected', 'skipped']);
  assert.deepEqual(result[0].attempts.map(item => [item.retry, item.status]), [[0, 'failed'], [1, 'passed']]);
  assert.equal(result[2].expectedStatus, 'failed');
  assert.equal(result[3].attempts[0].errors[0].message, 'route is blocked');
  assert.deepEqual(result[4].attempts, []);
});

test('small review copies existing frames/route metadata exactly and never declares a failed film complete', async () => {
  const { base, root, put } = await fixture();
  const failure = await put('test-results/world-phone/failure/test-failed-1.png', Buffer.from('existing failure PNG fixture'));
  await put('artifacts/world-phone/gates/cold-one-click-play-visible-body-and-real-movement-at-390x844/first-play.png', Buffer.from('home PNG fixture'));
  const recording = '{"completed":false,"videoPresent":true,"artifact":"artifacts/world-phone/walkthrough/film.webm","actions":[{"scene":"metro-carriage"}]}\n';
  await put('artifacts/world-phone/walkthrough/phone-world-recording.json', recording);
  await put('artifacts/world-phone/walkthrough/film.webm', Buffer.from('actual untrimmed bytes fixture'));
  await put('artifacts/world-phone/playwright-results.json', JSON.stringify(reportFor([
    ['broken route', 'unexpected', [{ retry: 0, status: 'failed', errors: [{ message: 'Expected border-arrival; received metro-carriage' }], attachments: [
      { name: 'screenshot', contentType: 'image/png', path: failure },
      { name: 'screenshot', contentType: 'image/png', path: resolve(root, 'test-results/world-phone/missing.png') },
    ] }]],
  ])));
  const out = resolve(base, 'review'), result = await makeReview(root, out, 'failure');
  assert.equal(result.phoneStepOutcome, 'failure');
  assert.equal(result.recording.completed, false);
  assert.equal(result.recording.videoFilePresent, true);
  assert.equal(result.report.counts.unexpected, 1);
  assert.equal(result.selection.selected.length, 2);
  assert.ok(result.selection.omitted.some(item => item.path?.endsWith('missing.png')));
  assert.equal(await readFile(resolve(out, 'phone-world-recording.json'), 'utf8'), recording);
  for (const frame of result.selection.selected) assert.equal(hash(await readFile(resolve(root, frame.path))), frame.sha256);
});

test('absent or malformed reports and recording metadata stay unknown, even when a video was reported', async () => {
  const { base, root, put } = await fixture();
  let result = await makeReview(root, resolve(base, 'missing'), 'skipped');
  assert.equal(result.report.state, 'missing'); assert.equal(result.recording.completed, null);
  assert.equal(result.recording.metadataFile, null); assert.deepEqual(result.tests, []);
  await put('artifacts/world-phone/playwright-results.json', '{broken');
  await put('artifacts/world-phone/walkthrough/phone-world-recording.json', '{"completed":false,"videoPresent":true,"artifact":"artifacts/world-phone/missing.webm"}');
  result = await makeReview(root, resolve(base, 'malformed'), 'failure');
  assert.equal(result.report.state, 'unreadable'); assert.equal(result.recording.videoReportedPresent, true);
  assert.equal(result.recording.videoFilePresent, false);
});

test('null and malformed report shapes still deliver actual failure screenshots and recording metadata', async () => {
  const { base, root, put } = await fixture();
  await put('test-results/world-phone/failure/test-failed-1.png', 'real frame fixture');
  const recording = '{"completed":false,"videoPresent":false}';
  await put('artifacts/world-phone/walkthrough/phone-world-recording.json', recording);
  const invalid = [null, {}, [], { suites: null }, { suites: [null] }, { suites: [{ specs: [{ tests: null }] }] },
    { suites: [], errors: 'not an array' }];
  for (const [index, value] of invalid.entries()) {
    await put('artifacts/world-phone/playwright-results.json', JSON.stringify(value));
    const out = resolve(base, `invalid-${index}`), result = await makeReview(root, out, 'failure');
    assert.equal(result.report.state, 'unreadable'); assert.match(result.report.error, /Invalid/);
    assert.equal(result.selection.selected.length, 1); assert.equal(result.recording.completed, false);
    assert.deepEqual(result.tests, []);
    assert.equal(await readFile(resolve(out, 'phone-world-recording.json'), 'utf8'), recording);
  }
});

test('huge global data URL errors are explicitly truncated without losing early evidence or originals', async () => {
  const { base, root, put } = await fixture();
  const message = 'Navigation failed for data:image/png;base64,' + 'A'.repeat(33 * 1024 * 1024);
  const source = JSON.stringify({ suites: [], errors: [{ message }, ...Array.from({ length: 24 }, (_, i) => ({ message: `Other error ${i}` }))] });
  const original = await put('artifacts/world-phone/playwright-results.json', source);
  await put('test-results/world-phone/failure/test-failed-1.png', 'real failure frame fixture');
  const out = resolve(base, 'review'), result = await makeReview(root, out, 'failure');
  assert.equal(result.report.state, 'available'); assert.equal(result.globalErrors.length, 20);
  assert.equal(result.globalErrorsOmitted, 5);
  assert.equal(result.globalErrors[0].truncated, true);
  assert.equal(result.globalErrors[0].originalCharacters, message.length);
  assert.equal(result.globalErrors[0].message.length, 12_000);
  assert.match(result.globalErrors[0].message, /^Navigation failed/);
  assert.equal(result.selection.selected.length, 1);
  assert.ok((await stat(resolve(out, 'summary.json'))).size < 32_000);
  assert.equal(await readFile(original, 'utf8'), source);
});

test('review enforces PNG count and byte bounds while retaining original files', async () => {
  const { base, root, put } = await fixture();
  const original = await put('test-results/world-phone/00-too-large/test-failed-1.png', Buffer.alloc(25 * 1024 * 1024));
  for (let i = 0; i < 20; i++) await put(`test-results/world-phone/${String(i).padStart(2, '0')}/test-failed-1.png`, Buffer.from(`frame ${i}`));
  const result = await makeReview(root, resolve(base, 'review'), 'failure');
  assert.equal(result.selection.selected.length, 7);
  assert.ok(result.selection.pngBytes <= result.selection.maxPngBytes);
  assert.equal((await readFile(original)).length, 25 * 1024 * 1024);
  assert.ok(result.selection.omitted.some(item => item.reason.includes('limit')));
});

test('split archive reassembles byte-exact original video, hidden files and relative HTML assets', async () => {
  const { base, root, put } = await fixture();
  await put('artifacts/world-phone/walkthrough/full.webm', Buffer.alloc(40_000, 123));
  await put('playwright-report/world-phone/index.html', '<img src="data/frame.png">');
  await put('playwright-report/world-phone/data/frame.png', Buffer.from('PNG fixture'));
  await put('test-results/world-phone/.last-run.json', '{"status":"failed"}');
  const out = resolve(base, 'parts'), manifest = await makeBundle(root, out, 16_384);
  assert.equal(manifest.fileCount, 4); assert.ok(manifest.parts.length > 1);
  for (const part of manifest.parts) { const data = await readFile(resolve(out, part.name)); assert.ok(data.length <= 16_384); assert.equal(hash(data), part.sha256); }
  const reassembled = Buffer.concat(await Promise.all(manifest.parts.map(part => readFile(resolve(out, part.name)))));
  assert.equal(hash(reassembled), manifest.archiveSha256);
  const restored = resolve(base, 'restored'); await mkdir(restored);
  await writeFile(resolve(restored, 'phone-evidence.tar'), reassembled);
  execFileSync('tar', ['-xf', 'phone-evidence.tar'], { cwd: restored });
  for (const file of manifest.files) {
    assert.deepEqual(await readFile(resolve(restored, file.path)), await readFile(resolve(root, file.path)));
    assert.equal(hash(await readFile(resolve(restored, file.path))), file.sha256);
  }
  await copyFile(resolve(out, 'files.sha256'), resolve(restored, 'files.sha256'));
  execFileSync('sha256sum', ['-c', 'files.sha256'], { cwd: restored });
});

test('uploader uses separate capped artifacts, rejects uncertain/oversized results, and keeps attempting remaining parts', async () => {
  const { base, root, put } = await fixture();
  await put('artifacts/world-phone/trace.zip', Buffer.alloc(20_000, 7));
  const out = resolve(base, 'parts'), manifest = await makeBundle(root, out, 16_384);
  const calls = [];
  const client = { uploadArtifact: async (...args) => { calls.push(args); return { id: calls.length, size: 17_000 }; } };
  await uploadBundle(out, client);
  assert.equal(calls.length, manifest.parts.length); assert.equal(new Set(calls.map(call => call[0])).size, calls.length);
  assert.equal(calls[0][2], out); assert.deepEqual(calls[0][3], { retentionDays: 7, compressionLevel: 0 });
  let attempts = 0;
  await assert.rejects(uploadBundle(out, { uploadArtifact: async () => { attempts++; return { id: attempts, size: 512 * 1024 * 1024 }; } }), /failed/);
  assert.equal(attempts, manifest.parts.length);
  await assert.rejects(uploadBundle(out, { uploadArtifact: async () => ({}) }), /failed/);
  assert.ok(PART_BYTES < 512 * 1024 * 1024);
});

test('standalone film retains full original bytes and honest incomplete metadata', async () => {
  const { base, root, put } = await fixture();
  await put('artifacts/world-phone/walkthrough/crossing-lives-whole-world-390x844-touch.webm', Buffer.from('full video fixture'));
  await put('artifacts/world-phone/walkthrough/phone-world-recording.json', '{"completed":false}');
  const client = { uploadArtifact: async (name, files) => {
    assert.equal(name, 'crossing-lives-world-phone-film');
    assert.equal(await readFile(files[0], 'utf8'), 'full video fixture');
    assert.equal(await readFile(files[1], 'utf8'), '{"completed":false}');
    return { id: 1, size: 1024 };
  } };
  assert.equal((await uploadFilm(root, resolve(base, 'film'), client)).state, 'uploaded');
});

test('400 MiB film uploads separately; film plus metadata above 500 MiB stays in hashed full evidence', async () => {
  const { base, root, put } = await fixture();
  try {
    const film = await put('artifacts/world-phone/walkthrough/crossing-lives-whole-world-390x844-touch.webm', '');
    await truncate(film, 400 * 1024 * 1024); // Sparse fixture: no large test input committed.
    const metadata = await put('artifacts/world-phone/walkthrough/phone-world-recording.json', '{"completed":false}');
    let uploads = 0;
    const client = { uploadArtifact: async (name, files) => {
      uploads++; assert.equal(name, 'crossing-lives-world-phone-film');
      assert.equal((await stat(files[0])).size, 400 * 1024 * 1024);
      assert.equal(await readFile(files[1], 'utf8'), '{"completed":false}');
      return { id: 1, size: 400 * 1024 * 1024 + 1024 };
    } };
    assert.equal((await uploadFilm(root, resolve(base, 'film'), client)).state, 'uploaded');
    assert.equal(uploads, 1);
    await truncate(metadata, 101 * 1024 * 1024);
    const oversized = await uploadFilm(root, resolve(base, 'oversized'), client);
    assert.equal(oversized.state, 'in full evidence parts'); assert.match(oversized.reason, /plus metadata/);
    assert.equal(uploads, 1); assert.equal(PART_BYTES, 384 * 1024 * 1024);
    assert.equal(FILM_PAYLOAD_BYTES, 500 * 1024 * 1024);
  } finally { await rm(base, { recursive: true, force: true }); }
});

test('phone workflow is separate, preserves failure evidence and uploads review before full film', async () => {
  const proposal = await readFile(new URL('../docs/phone-tour/phone-ci.yml', import.meta.url), 'utf8');
  const retained = await readFile(new URL('../.github/workflows/verify.yml', import.meta.url), 'utf8');
  assert.match(proposal, /playwright.phone.config.ts/);
  assert.match(proposal, /phone-integrity.test.mjs scripts\/phone-evidence.test.mjs/);
  assert.ok(proposal.indexOf('Upload small phone review first') < proposal.indexOf('Preserve untrimmed phone film'));
  assert.match(proposal, /if: always\(\)/);
  assert.match(proposal, /await makeBundle/); assert.match(proposal, /await uploadBundle/); assert.match(proposal, /await uploadFilm/);
  assert.doesNotMatch(retained, /phone.config|phone-evidence/);
});
