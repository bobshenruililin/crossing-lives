import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { buildTemporaryDemoUrl, isTemporaryDemo, TEMPORARY_DEMO_LABEL, TEMPORARY_DEMO_GUIDANCE } from '../src/runtime-mode';
import { createStoryState, decodeStoryState, storyReducer } from '../src/story/engine';
import { defaultInputs } from '../src/domain/data';
import { compareOutings } from '../src/domain/engine';

const root = new URL('../', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');
const appSource = source('src/App.tsx');
const storySource = source('src/components/PlayableEvening.tsx');
const compile = (text: string) => stripTypeScriptTypes(text, { mode: 'strip' });
const between = (text: string, start: string, end: string) => {
  const first = text.indexOf(start), last = text.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, 'The production source path must still exist; update this harness for any intentional change.');
  assert.equal(text.indexOf(start, first + start.length), -1, 'The source selector must be unique.');
  return text.slice(first + start.length, last);
};
const initializer = (name: string) => name === 'initial'
  ? between(appSource, 'const initial = ', '\n};') + '\n}'
  : between(appSource, `const ${name} = `, ';');
const effect = (text: string, storageCall: string) => {
  const matches = [...text.matchAll(/useEffect\((\(\)\s*=>\s*\{[\s\S]*?\}),\s*\[[^\]]*\]\);/g)].filter(match => match[1].includes(storageCall));
  assert.equal(matches.length, 1, 'The actual production storage effect must be uniquely selected.');
  return matches[0][1];
};
const resetPlanner = 'function resetStory() {' + between(appSource, 'function resetStory() {', '\n  function choose');

// Execute the actual production storage gates in isolation. These are not
// copies of their logic, nor global Storage patches in the shipped application.
function storyHarness(temporaryDemo: boolean, stored: string | null = null, blocked = false) {
  const calls: string[] = [];
  const data = new Map(stored === null ? [] : [['between-playable-v2', stored]]);
  const context: Record<string, any> = {
    temporaryDemo, createStoryState,
    decodeStoryState: (raw: string) => { calls.push('decode'); return decodeStoryState(raw); },
    setWarning: () => {},
  };
  Object.defineProperty(context, 'localStorage', { get: () => {
    calls.push('access');
    if (blocked) throw new Error('Storage blocked');
    return {
      getItem: (key: string) => { calls.push('read'); return data.get(key) ?? null; },
      setItem: (key: string, value: string) => { calls.push('write'); data.set(key, value); },
      removeItem: (key: string) => { calls.push('remove'); data.delete(key); },
    };
  } });
  Object.defineProperty(context, 'sessionStorage', { get: () => { throw new Error('No sessionStorage path is allowed'); } });
  const cacheSource = storySource.slice(storySource.indexOf('let inTabStory:'), storySource.indexOf('type Panel =')).replace('export function', 'function');
  runInNewContext(compile(`const PLAYABLE_STORAGE_KEY = 'between-playable-v2';\n${cacheSource}\nconst saveStory = (next) => { state = next; (${effect(storySource, 'localStorage.setItem')})(); };\nlet state;\nthis.api = { readPlayable, resetPlayableSave, saveStory };`), context);
  return { api: context.api, calls, data };
}
function plannerHarness(temporaryDemo: boolean) {
  const calls: string[] = [];
  const changed: Record<string, any> = {};
  const context: Record<string, any> = {
    temporaryDemo, defaultInputs, compareOutings, structuredClone,
    protectPlannerBytes: { current: false }, savedMode: { current: 'explore' },
    inputs: structuredClone(defaultInputs), mode: 'explore', hasSave: false,
    step: 0, selected: null, notes: '', completed: false,
    readJournal: () => { calls.push('read'); return { status: 'empty' }; },
    writeJournal: (candidate: unknown) => { calls.push('write'); changed.saved = candidate; return { status: 'saved' }; },
    resetPlayableSave: () => { calls.push('reset-story-cache'); },
  };
  for (const key of ['HasSave', 'SaveWarning', 'StoryKey', 'Inputs', 'Selected', 'Notes', 'Completed', 'Step', 'Mode', 'ShowReset']) context[`set${key}`] = (value: unknown) => { changed[key] = value; };
  runInNewContext(compile(`const restoredJournal = ${initializer('restoredJournal')};\nconst initial = ${initializer('initial')};\n${resetPlanner}\nthis.api = { initial, autosave: ${effect(appSource, 'writeJournal(')}, resetStory };`), context);
  return { api: context.api, calls, changed, context };
}

test('temporary mode requires one exact flag, with no stored preference or inferred value', () => {
  for (const search of ['', '?', '?temporary-demo', '?temporary-demo=', '?temporary-demo=true', '?temporary-demo=0', '?temporary-demo=01', '?temporary-demo=1&temporary-demo=1', '?temporary-demo=0&temporary-demo=1', '?Temporary-demo=1', '?mode=temporary-demo', '?x=temporary-demo%3D1']) assert.equal(isTemporaryDemo(search), false, search);
  for (const search of ['?temporary-demo=1', 'temporary-demo=1', '?temporary-demo=1&unused=value', '?unused=value&temporary-demo=1']) assert.equal(isTemporaryDemo(search), true, search);
});

test('new-tab URL retains only app origin/path and the constant mode flag', () => {
  for (const href of [
    'https://example.test/app/?note=private&temporary-demo=0#private-context',
    'http://127.0.0.1:4173/some/app.html?budget=1234#evening',
    'https://user:secret@example.test/app%20folder/index.html?email=private',
    'file:///tmp/crossing-lives-portable.html?private=yes#plan',
    'file:///Users/someone/My%20files/evening.html?temporary-demo=1&temporary-demo=1',
  ]) {
    const original = new URL(href), result = new URL(buildTemporaryDemoUrl(href));
    assert.equal(result.origin, original.origin);
    assert.equal(result.pathname, original.pathname);
    assert.equal(result.search, '?temporary-demo=1');
    assert.equal(result.hash, '');
    assert.equal(result.username, ''); assert.equal(result.password, '');
    assert.equal(isTemporaryDemo(result.search), true);
  }
});

test('URL construction is idempotent and rejects non-app schemes', () => {
  const result = buildTemporaryDemoUrl('https://example.test/app/');
  assert.equal(buildTemporaryDemoUrl(result), result);
  for (const href of ['javascript:alert(1)', 'data:text/html,hello', 'mailto:person@example.test', 'not a URL']) assert.throws(() => buildTemporaryDemoUrl(href));
});

test('temporary story initialization, every state save and reset never acquire storage or decode saved data', () => {
  for (const stored of [null, '{broken', '{"version":999}', JSON.stringify({ ...createStoryState(), legacyNote: 'private' })]) {
    for (const blocked of [false, true]) {
      const { api, calls, data } = storyHarness(true, stored, blocked);
      const before = [...data];
      const initial = api.readPlayable();
      assert.deepEqual(initial.state, createStoryState('wander'));
      assert.equal(initial.warning, '');
      const next = storyReducer(initial.state, { type: 'PREVIEW_CITY', city: 'sz' });
      api.saveStory(next);
      assert.equal(api.readPlayable().state, next, 'The new page retains its own reducer snapshot across views.');
      api.resetPlayableSave();
      assert.deepEqual(api.readPlayable().state, createStoryState('wander'));
      api.saveStory(storyReducer(next, { type: 'RESET', presetId: 'wander' }));
      assert.deepEqual(calls, [], 'Even obtaining the localStorage property must be skipped.');
      assert.deepEqual([...data], before);
    }
  }
});

test('a fresh temporary page starts over and never inherits another page’s in-memory cache', () => {
  const original = storyHarness(false, null, true);
  const originalState = storyReducer(original.api.readPlayable().state, { type: 'PREVIEW_CITY', city: 'sz' });
  original.api.saveStory(originalState);
  const demo = storyHarness(true);
  demo.api.saveStory(storyReducer(demo.api.readPlayable().state, { type: 'PREVIEW_CITY', city: 'hk' }));
  assert.equal(original.api.readPlayable().state, originalState);
  assert.deepEqual(storyHarness(true).api.readPlayable().state, createStoryState('wander'));
});

test('normal story read, autosave, corrupt protection and explicit reset retain their storage semantics', () => {
  const valid = JSON.stringify(storyReducer(createStoryState(), { type: 'PREVIEW_CITY', city: 'sz' }));
  const normal = storyHarness(false, valid);
  assert.equal(normal.api.readPlayable().state.previewCity, 'sz');
  assert.deepEqual(normal.calls, ['access', 'read', 'decode']);
  normal.api.saveStory(createStoryState());
  assert.equal(normal.calls.at(-1), 'write');
  normal.api.resetPlayableSave();
  assert.equal(normal.calls.at(-1), 'remove');
  const corrupt = storyHarness(false, '{broken');
  corrupt.api.saveStory(corrupt.api.readPlayable().state);
  assert.equal(corrupt.data.get('between-playable-v2'), '{broken');
  assert.equal(corrupt.calls.includes('write'), false);
});

test('temporary planner module initialization, autosave and explicit reset skip the journal adapter', () => {
  const { api, calls, changed } = plannerHarness(true);
  assert.equal(api.initial.saved, null); assert.equal(api.initial.warning, '');
  assert.deepEqual(calls, []);
  api.autosave();
  assert.deepEqual(calls, []);
  api.resetStory();
  assert.deepEqual(calls, ['reset-story-cache']);
  assert.deepEqual(changed.Inputs, defaultInputs);
  assert.equal(changed.HasSave, false);
  assert.equal(changed.Mode, 'story');
});

test('normal planner still initializes, autosaves and explicitly resets through the original adapter', () => {
  const { api, calls, context, changed } = plannerHarness(false);
  assert.deepEqual(calls, ['read']);
  api.autosave();
  assert.deepEqual(calls, ['read', 'write']);
  context.protectPlannerBytes.current = true;
  api.autosave();
  assert.deepEqual(calls, ['read', 'write']);
  api.resetStory();
  assert.deepEqual(calls, ['read', 'write', 'reset-story-cache', 'write']);
  assert.equal(changed.HasSave, true);
});

test('storage inventory remains confined to the guarded story and unchanged journal adapter', () => {
  const inventory: string[] = [];
  const visit = (directory: string) => {
    for (const item of readdirSync(new URL(directory, root), { withFileTypes: true })) {
      const path = `${directory}/${item.name}`;
      if (item.isDirectory()) visit(path);
      else if (/\.tsx?$/.test(item.name)) {
        const text = source(path);
        if (/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(text)) inventory.push(path);
        assert.doesNotMatch(text, /Storage\.prototype|window\.open\(|window\.close\(|\.opener\b/);
      }
    }
  };
  visit('src');
  assert.deepEqual(inventory.sort(), ['src/components/PlayableEvening.tsx', 'src/persistence/journal.ts']);
  assert.equal((appSource.match(/readJournal\(/g) ?? []).length, 1);
  assert.equal((appSource.match(/writeJournal\(/g) ?? []).length, 2);
  assert.equal((storySource.match(/localStorage\.(getItem|setItem|removeItem)\(/g) ?? []).length, 3);
  assert.doesNotMatch(source('src/persistence/journal.ts'), /temporaryDemo|runtime-mode/);
});

test('the explicit new-tab link has no launching-tab handler and mode identity covers all views', () => {
  const link = storySource.match(/<a id="start-temporary-demo"[^>]*>/)?.[0];
  assert.ok(link);
  assert.match(link, /href=\{buildTemporaryDemoUrl\(window.location.href\)\}/);
  assert.match(link, /target="_blank"/); assert.match(link, /rel="noopener noreferrer"/);
  assert.match(link, /referrerPolicy="no-referrer"/);
  assert.doesNotMatch(link, /onClick|onMouse|onKey/);
  assert.match(storySource, /temporaryDemo && !panel && <aside className="temporary-demo-notice temporary-demo-world"/);
  assert.match(appSource, /temporaryDemo && \(workspace === 'desk' \|\| mode !== 'story'\)/);
  assert.match(storySource, /temporaryDemo && <p className="temporary-demo-dialogue-note"/);
  assert.match(appSource, /temporaryDemo && <p className="temporary-demo-dialogue-note"/);
  assert.equal(TEMPORARY_DEMO_LABEL, 'Temporary demo · changes won’t be saved');
  assert.match(TEMPORARY_DEMO_GUIDANCE, /Close this tab.*Reloading starts over/);
});
