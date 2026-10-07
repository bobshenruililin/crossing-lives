import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, open, readdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WORLD_ROOTS = ['artifacts/crossing-lives-world.html', 'artifacts/world', 'playwright-report/world', 'test-results/world'];
export const PART_BYTES = 384 * 1024 * 1024; // Leaves ample ZIP overhead below the 512 MiB download cap.
export const FILM_PAYLOAD_BYTES = 500 * 1024 * 1024; // Includes metadata; reserves 12 MiB for ZIP overhead.
const REVIEW_BYTES = 24 * 1024 * 1024;
const REVIEW_PNGS = 16;
const ERROR_COUNT = 20;
const REPORT = 'artifacts/world/playwright-results.json';
const RECORDING = 'artifacts/world/walkthrough/whole-world-recording.json';
const slash = value => value.split(sep).join('/');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
async function stat(path) { try { return await lstat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
async function digest(path) { const hash = createHash('sha256'); for await (const bytes of createReadStream(path)) hash.update(bytes); return hash.digest('hex'); }

export async function listFiles(root, paths) {
  const found = [];
  const visit = async path => {
    const entry = await stat(resolve(root, path));
    if (!entry) return;
    if (entry.isSymbolicLink()) throw new Error(`Evidence must not follow symlinks: ${path}`);
    if (entry.isDirectory()) {
      for (const name of (await readdir(resolve(root, path))).sort()) await visit(`${path}/${name}`);
    } else if (entry.isFile()) found.push(slash(path));
  };
  for (const path of paths) await visit(path);
  return [...new Set(found)].sort();
}

async function readJson(path) {
  try { return { state: 'available', value: JSON.parse(await readFile(path, 'utf8')) }; }
  catch (error) { return { state: error.code === 'ENOENT' ? 'missing' : 'unreadable', error: error.message }; }
}

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}: expected an object`);
  return value;
}
function array(value, label, optional = true) {
  if (value === undefined && optional) return [];
  if (!Array.isArray(value)) throw new Error(`Invalid ${label}: expected an array`);
  return value;
}
function summarizeError(error) {
  const message = String(error?.message ?? error?.value ?? error ?? '').replace(/\u001b\[[0-9;]*m/g, '');
  return { message: message.slice(0, 12_000), truncated: message.length > 12_000, originalCharacters: message.length };
}

export function summarizeTests(report) {
  record(report, 'report');
  array(report.suites, 'report.suites', false);
  array(report.errors, 'report.errors');
  const tests = [];
  const visit = (suite, titles = []) => {
    record(suite, 'suite');
    const titlePath = [...titles, suite.title].filter(Boolean);
    for (const spec of array(suite.specs, 'suite.specs')) {
      record(spec, 'spec');
      for (const test of array(spec.tests, 'spec.tests', false)) {
      record(test, 'test');
      tests.push({ title: [...titlePath, spec.title].join(' › '), file: spec.file, line: spec.line,
        project: test.projectName, outcome: test.status, expectedStatus: test.expectedStatus,
        attempts: array(test.results, 'test.results', false).map(result => {
          record(result, 'result');
          const errors = array(result.errors, 'result.errors');
          const attachments = array(result.attachments, 'result.attachments').map(item => {
            record(item, 'attachment');
            if (item.path !== undefined && typeof item.path !== 'string') throw new Error('Invalid attachment.path');
            return { name: item.name, path: item.path, contentType: item.contentType };
          }).filter(item => item.path);
          return { retry: result.retry, status: result.status, durationMs: result.duration,
            errors: errors.slice(0, ERROR_COUNT).map(summarizeError), errorsOmitted: Math.max(0, errors.length - ERROR_COUNT), attachments };
        }) });
      }
    }
    for (const child of array(suite.suites, 'suite.suites')) visit(child, titlePath);
  };
  for (const suite of report.suites ?? []) visit(suite);
  return tests;
}

export async function makeReview(root, out, stepOutcome = 'unknown') {
  await mkdir(out, { recursive: true });
  const report = await readJson(resolve(root, REPORT));
  const recording = await readJson(resolve(root, RECORDING));
  let tests = [];
  if (report.state === 'available') {
    try { tests = summarizeTests(report.value); }
    catch (error) { report.state = 'unreadable'; report.error = error.message; }
  }
  const candidates = [], missing = [], selected = [], seen = new Set();
  const safePath = path => {
    const local = slash(relative(root, isAbsolute(path) ? path : resolve(root, path)));
    return WORLD_ROOTS.some(item => local === item || local.startsWith(`${item}/`)) ? local : null;
  };
  const add = (path, reason) => { if (path && !seen.has(path)) { seen.add(path); candidates.push({ path, reason }); } };
  for (const test of tests) for (const attempt of test.attempts) {
    for (const attachment of attempt.attachments) {
      const local = safePath(attachment.path);
      attachment.source = local;
      attachment.present = Boolean(local && (await stat(resolve(root, local)))?.isFile());
      if (['failed', 'timedOut', 'interrupted'].includes(attempt.status) && attachment.contentType === 'image/png' &&
          (attachment.name === 'screenshot' || /test-failed.*\.png$/.test(local ?? ''))) add(local, 'actual failure screenshot');
    }
  }
  const files = await listFiles(root, ['artifacts/world/gates', 'test-results/world']);
  // Default Playwright failure screenshots remain useful even if the reporter was interrupted.
  for (const path of files.filter(path => /test-failed.*\.png$/.test(path))) add(path, 'Playwright failure screenshot');
  // Reserve space for the requested compositions/mechanisms even when many tests fail.
  for (const candidate of candidates.splice(8)) missing.push({ ...candidate, reason: 'eight failure-frame selection limit; original retained in full evidence' });
  const mobile = 'artifacts/world/gates/cold-one-click-play-visible-body-and-real-movement-at-390x844';
  for (const name of ['first-play', 'metro-carriage-body-and-controls', 'rental-home-body-and-controls']) add(`${mobile}/${name}.png`, '390px composition');
  for (const scene of ['parcel-counter', 'rental-home', 'office-floor', 'planning-museum']) {
    const match = files.find(path => path.startsWith('artifacts/world/gates/') && path.endsWith(`-${scene}-changed-mechanism.png`));
    if (match) add(match, 'changed mechanism'); else missing.push({ requested: `${scene} changed mechanism`, reason: 'not captured' });
  }
  // If a run fails before the representative scenes, retain an earlier actual mechanism frame.
  for (const path of files.filter(path => path.startsWith('artifacts/world/gates/') && path.endsWith('-changed-mechanism.png')).slice(0, 2)) add(path, 'earlier changed mechanism');
  let bytes = 0;
  for (const candidate of candidates) {
    const entry = await stat(resolve(root, candidate.path));
    if (!entry?.isFile()) { missing.push({ ...candidate, reason: 'not captured' }); continue; }
    if (selected.length >= REVIEW_PNGS || bytes + entry.size > REVIEW_BYTES) {
      missing.push({ ...candidate, reason: 'review size/count limit; original retained in full evidence' }); continue;
    }
    const target = `images/${candidate.path}`;
    await mkdir(dirname(resolve(out, target)), { recursive: true });
    await copyFile(resolve(root, candidate.path), resolve(out, target));
    selected.push({ ...candidate, file: target, bytes: entry.size, sha256: await digest(resolve(out, target)) });
    bytes += entry.size;
  }
  if (recording.state === 'available') await copyFile(resolve(root, RECORDING), resolve(out, 'whole-world-recording.json'));
  const videoPath = typeof recording.value?.artifact === 'string' ? safePath(recording.value.artifact) : null;
  const video = videoPath ? await stat(resolve(root, videoPath)) : null;
  const counts = { expected: 0, unexpected: 0, flaky: 0, skipped: 0, unknown: 0 };
  for (const test of tests) counts[Object.hasOwn(counts, test.outcome) ? test.outcome : 'unknown']++;
  const summary = { schemaVersion: 1, commit: process.env.GITHUB_SHA ?? null, worldStepOutcome: stepOutcome,
    scope: 'World job only. The retained decision/original/production job runs independently; this early artifact is not the final CI result.',
    workflow: { runId: process.env.GITHUB_RUN_ID ?? null, runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      worldJob: process.env.GITHUB_JOB ?? null, retainedJob: 'verify', retainedJobOutcome: 'not observed' },
    report: { source: REPORT, state: report.state, error: report.error,
      stats: report.state === 'available' ? report.value.stats : undefined, counts },
    globalErrors: Array.isArray(report.value?.errors) ? report.value.errors.slice(0, ERROR_COUNT).map(summarizeError) : [],
    globalErrorsOmitted: Array.isArray(report.value?.errors) ? Math.max(0, report.value.errors.length - ERROR_COUNT) : 0, tests,
    recording: { source: RECORDING, state: recording.state, error: recording.error,
      completed: recording.value?.completed ?? null, videoReportedPresent: recording.value?.videoPresent ?? null,
      videoFilePresent: Boolean(video?.isFile()), videoBytes: video?.isFile() ? video.size : null,
      metadataFile: recording.state === 'available' ? 'whole-world-recording.json' : null },
    selection: { maxPngs: REVIEW_PNGS, maxFailurePngs: 8, maxPngBytes: REVIEW_BYTES, pngBytes: bytes, selected, omitted: missing },
    fullEvidence: 'crossing-lives-world-evidence-part-*; download all parts and follow REASSEMBLE.txt' };
  await writeFile(resolve(out, 'summary.json'), json(summary));
  await writeFile(resolve(out, 'README.txt'), 'Read summary.json for actual outcomes, attempts/retries, errors and missing evidence.\nwhole-world-recording.json, when present, is copied unchanged; completed:false means an interrupted route, even if a video exists.\nSelected PNGs are byte-exact copies. Videos, traces, all screenshots and HTML reports remain in the separate full-evidence parts.\n');
  const reviewFiles = await listFiles(out, ['images', 'summary.json', 'whole-world-recording.json', 'README.txt']);
  const reviewBytes = (await Promise.all(reviewFiles.map(file => stat(resolve(out, file))))).reduce((total, entry) => total + entry.size, 0);
  if (reviewBytes > 32 * 1024 * 1024) throw new Error('Review metadata exceeds the 32 MiB total review limit');
  return summary;
}

function run(command, args, options) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('error', reject); child.on('exit', code => code === 0 ? accept() : reject(new Error(`${command} exited ${code}`)));
  });
}

export async function makeBundle(root, out, partBytes = PART_BYTES) {
  if (!Number.isSafeInteger(partBytes) || partBytes <= 0 || partBytes > PART_BYTES) throw new Error('Invalid part size');
  await mkdir(out, { recursive: true });
  const files = [];
  for (const path of await listFiles(root, WORLD_ROOTS)) files.push({ path, bytes: (await stat(resolve(root, path))).size, sha256: await digest(resolve(root, path)) });
  const manifest = { schemaVersion: 1, commit: process.env.GITHUB_SHA ?? null, fileCount: files.length,
    sourceBytes: files.reduce((total, file) => total + file.bytes, 0), files, archive: 'world-evidence.tar', partBytes, parts: [] };
  await writeFile(resolve(out, 'file-list.txt'), files.map(file => file.path).join('\0') + (files.length ? '\0' : ''));
  // No compression, transcoding, trimming or deletion: tar stores every original byte.
  await run('tar', ['--create', '--file', resolve(out, manifest.archive), '--null', '--files-from', resolve(out, 'file-list.txt')], { cwd: root });
  const archivePath = resolve(out, manifest.archive);
  manifest.archiveBytes = (await stat(archivePath)).size;
  manifest.archiveSha256 = await digest(archivePath);
  const archive = await open(archivePath, 'r');
  try {
    let offset = 0;
    while (offset < manifest.archiveBytes) {
      const name = `${manifest.archive}.part-${String(manifest.parts.length).padStart(4, '0')}`;
      const target = await open(resolve(out, name), 'wx');
      const hash = createHash('sha256'); let bytes = 0;
      try {
        const buffer = Buffer.alloc(Math.min(1024 * 1024, partBytes));
        while (bytes < partBytes && offset < manifest.archiveBytes) {
          const read = await archive.read(buffer, 0, Math.min(buffer.length, partBytes - bytes), offset);
          if (!read.bytesRead) throw new Error('Unexpected end of evidence archive');
          const chunk = buffer.subarray(0, read.bytesRead); hash.update(chunk);
          await target.writeFile(chunk); bytes += read.bytesRead; offset += read.bytesRead;
        }
      } finally { await target.close(); }
      manifest.parts.push({ name, bytes, sha256: hash.digest('hex') });
    }
  } finally { await archive.close(); }
  await writeFile(resolve(out, 'manifest.json'), json(manifest));
  await writeFile(resolve(out, 'parts.sha256'), manifest.parts.map(part => `${part.sha256}  ${part.name}\n`).join(''));
  await writeFile(resolve(out, 'archive.sha256'), `${manifest.archiveSha256}  ${manifest.archive}\n`);
  await writeFile(resolve(out, 'files.sha256'), files.map(file => `${file.sha256}  ${file.path}\n`).join(''));
  await writeFile(resolve(out, 'REASSEMBLE.txt'), 'Download and unzip every crossing-lives-world-evidence-part-* artifact into one directory. Identical manifest/checksum files may be overwritten. Run:\n\nsha256sum -c parts.sha256\ncat world-evidence.tar.part-* > world-evidence.tar\nsha256sum -c archive.sha256\ntar -xf world-evidence.tar\nsha256sum -c files.sha256\n\nmanifest.json records the complete file count, original byte sizes/hashes, archive hash, and exact ordered parts. All video bytes and HTML report paths are preserved. No viewing copy replaces the original film.\n');
  return manifest;
}

export async function uploadBundle(out, client) {
  const manifest = JSON.parse(await readFile(resolve(out, 'manifest.json'), 'utf8'));
  const receipts = [], failures = [];
  for (const [index, part] of manifest.parts.entries()) {
    const name = `crossing-lives-world-evidence-part-${String(index + 1).padStart(4, '0')}-of-${String(manifest.parts.length).padStart(4, '0')}`;
    try {
      if ((await stat(resolve(out, part.name)))?.size !== part.bytes || await digest(resolve(out, part.name)) !== part.sha256) throw new Error(`Part checksum mismatch: ${part.name}`);
      const payload = [part.name, 'manifest.json', 'parts.sha256', 'archive.sha256', 'files.sha256', 'REASSEMBLE.txt'].map(file => resolve(out, file));
      await assertPayloadBound(payload);
      const receipt = await client.uploadArtifact(name, payload, out, { retentionDays: 7, compressionLevel: 0 });
      receipts.push({ name, ...receipt });
      if (!receipt.id || !Number.isFinite(receipt.size) || receipt.size >= 512 * 1024 * 1024) throw new Error(`Artifact upload result missing or above download cap: ${name}`);
      console.log(`Preserved ${name}: artifact ${receipt.id}, ${receipt.size} bytes`);
    } catch (error) { failures.push({ name, error: error.message }); console.error(`${name}: ${error.message}`); }
  }
  await writeFile(resolve(out, 'upload-receipts.json'), json({ receipts, failures }));
  if (failures.length) throw new Error(`${failures.length} full-evidence artifact upload(s) failed; originals are untouched`);
  return receipts;
}

async function assertPayloadBound(files, limit = PART_BYTES + 16 * 1024 * 1024) {
  const total = (await Promise.all(files.map(file => stat(file)))).reduce((sum, entry) => sum + entry.size, 0);
  // Six short archive entries plus ZIP overhead fit well inside the remaining 112 MiB.
  if (total > limit) throw new Error('Evidence payload exceeds the pre-upload size bound');
}

export async function uploadFilm(root, out, client) {
  const path = 'artifacts/world/walkthrough/crossing-lives-whole-world-1440x900.webm';
  const entry = await stat(resolve(root, path));
  if (!entry?.isFile()) return { state: 'missing' };
  const files = [resolve(root, path)];
  if ((await stat(resolve(root, RECORDING)))?.isFile()) files.push(resolve(root, RECORDING));
  const sourceBytes = (await Promise.all(files.map(file => stat(file)))).reduce((total, item) => total + item.size, 0);
  // Reserve 128 bytes for the SHA-256 line before doing any large copy/hash work.
  if (sourceBytes + 128 > FILM_PAYLOAD_BYTES) return { state: 'in full evidence parts', bytes: entry.size, reason: 'film plus metadata exceeds standalone payload bound' };
  await mkdir(out, { recursive: true });
  const checksum = resolve(out, 'film.sha256');
  await writeFile(checksum, `${await digest(resolve(root, path))}  crossing-lives-whole-world-1440x900.webm\n`);
  // Stage byte-exact copies together so this standalone artifact is immediately watchable.
  for (const source of files) await copyFile(source, resolve(out, source.split(sep).at(-1)));
  const payload = [...files.map(source => resolve(out, source.split(sep).at(-1))), checksum];
  await assertPayloadBound(payload, FILM_PAYLOAD_BYTES);
  const receipt = await client.uploadArtifact('crossing-lives-world-film', payload, out, { retentionDays: 7, compressionLevel: 0 });
  if (!receipt.id || !Number.isFinite(receipt.size) || receipt.size >= 512 * 1024 * 1024) throw new Error('Film artifact upload result missing or above cap');
  return { state: 'uploaded', ...receipt };
}

export async function verifyClient(directory) {
  const lock = JSON.parse(await readFile(resolve(directory, 'package-lock.json'), 'utf8'));
  const pkg = JSON.parse(await readFile(resolve(directory, 'node_modules/@actions/artifact/package.json'), 'utf8'));
  const pinned = lock.packages?.['node_modules/@actions/artifact'];
  // Published in the official actions/upload-artifact v4.6.2 lockfile.
  if (pkg.version !== '2.3.2' || pinned?.version !== '2.3.2' || pinned?.integrity !== 'sha512-uX2Mr5KEPcwnzqa0Og9wOTEKIae6C/yx9P/m8bIglzCS5nZDkcQC/zRWjjoEsyVecL6oQpBx5BuqQj/yuVm0gw==') throw new Error('Unexpected official artifact client version or integrity');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, output] = process.argv.slice(2);
  if (!output) throw new Error('Usage: node scripts/world-evidence.mjs review|bundle|verify-client OUTPUT');
  const out = resolve(output);
  if (command === 'review') await makeReview(process.cwd(), out, process.env.WORLD_TEST_OUTCOME);
  else if (command === 'bundle') await makeBundle(process.cwd(), out);
  else if (command === 'verify-client') await verifyClient(out);
  else throw new Error(`Unknown evidence command: ${command}`);
}
