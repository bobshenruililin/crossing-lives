import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultInputs } from '../src/domain/data';
import {
  JOURNAL_STORAGE_KEY, decodeJournal, readJournal, validateJournal, writeJournal,
} from '../src/persistence/journal';
import type { JournalStorage, SavedJournal } from '../src/persistence/journal';

const journal = (patch: Partial<SavedJournal> = {}): SavedJournal => ({
  version: 1, inputs: structuredClone(defaultInputs), mode: 'explore', step: 0,
  selected: null, notes: '', completed: false, ...patch,
});

function memoryStorage(initial: string | null = null) {
  let raw = initial;
  const reads: string[] = [];
  const writes: Array<{ key: string; value: string }> = [];
  const storage: JournalStorage = {
    getItem(key) { reads.push(key); return raw; },
    setItem(key, value) { writes.push({ key, value }); raw = value; },
  };
  return { storage, reads, writes, raw: () => raw };
}

test('the v1 journal key and exact saved fields stay compatible', () => {
  assert.equal(JOURNAL_STORAGE_KEY, 'between-journal-v1');
  const saved = journal();
  assert.deepEqual(validateJournal(saved), { status: 'valid', saved });
  assert.deepEqual(decodeJournal(JSON.stringify(saved)), { status: 'valid', saved });
  const memory = memoryStorage();
  assert.deepEqual(writeJournal(saved, memory.storage), { status: 'saved' });
  assert.deepEqual(memory.writes, [{ key: 'between-journal-v1', value: JSON.stringify(saved) }]);
  assert.deepEqual(readJournal(memory.storage), { status: 'loaded', saved });
  assert.deepEqual(memory.reads, ['between-journal-v1']);
});

test('all views, chapters and choices round trip, including intro and an unfinished story', () => {
  for (const mode of ['intro', 'story', 'explore', 'receipt'] as const) {
    for (const step of [0, 1, 2, 3]) {
      for (const selected of [null, 'hk', 'sz'] as const) {
        if (mode === 'receipt' && selected === null) continue;
        for (const completed of [false, true]) {
          const saved = journal({ mode, step, selected, completed });
          assert.deepEqual(decodeJournal(JSON.stringify(saved)), { status: 'valid', saved });
        }
      }
    }
  }
});

test('notes preserve whitespace, Unicode and literal markup without interpreting or trimming', () => {
  for (const notes of ['', '  More time together.\n兩地之間 🥢\n  ', '<script>not code</script>', '筆'.repeat(1200)]) {
    const saved = journal({ mode: 'receipt', selected: 'sz', completed: true, notes });
    const memory = memoryStorage();
    assert.equal(writeJournal(saved, memory.storage).status, 'saved');
    assert.deepEqual(readJournal(memory.storage), { status: 'loaded', saved });
  }
});

test('constraints, explicit overrides and automatic omitted assumptions survive a round trip', () => {
  const saved = journal();
  saved.inputs = {
    origin: 'island', departureMinutes: 1439, homeByMinutes: 0, budgetPerPersonHKD: 0,
    partySize: 6, mealMinutes: 180, weights: { price: 0, ease: 5, discovery: 2.5 },
    szRoute: 'bus', fxHKDPerCNY: 100, entryEligibility: 'unsure',
    borderBufferMinutes: 240, crossingClosingBufferMinutes: 120,
    hkMealPerPersonHKD: 0, szMealPerPersonCNY: 1_000_000_000,
    hkLocalMinutes: 0, szLocalMinutes: 180, walkMinutes: 0,
  };
  // A well-formed scenario may have no feasible outings; it is still a valid save.
  assert.deepEqual(decodeJournal(JSON.stringify(saved)), { status: 'valid', saved });
  for (const key of ['borderBufferMinutes', 'hkLocalMinutes', 'szLocalMinutes'] as const) delete saved.inputs[key];
  const memory = memoryStorage();
  assert.equal(writeJournal(saved, memory.storage).status, 'saved');
  assert.deepEqual(readJournal(memory.storage), { status: 'loaded', saved });
  assert.ok(!Object.hasOwn(JSON.parse(memory.raw()!).inputs, 'borderBufferMinutes'));
});

test('per-city itinerary decisions and player familiarity round trip without losing false or zero', () => {
  const saved = journal();
  saved.inputs.itineraryOverrides = {
    hk: { mealMinutes: 60, walkMinutes: 0, includeSharedOrder: false, storyDelayMinutes: 0 },
    sz: { mealMinutes: 180, walkMinutes: 180, includeSharedOrder: true, storyDelayMinutes: 240 },
  };
  saved.inputs.familiarity = {
    hk: { dinner: 'new', walk: 'familiar' },
    sz: { dinner: 'unsure', walk: 'new' },
  };
  const memory = memoryStorage();
  assert.deepEqual(writeJournal(saved, memory.storage), { status: 'saved' });
  assert.deepEqual(readJournal(memory.storage), { status: 'loaded', saved });
  assert.deepEqual(decodeJournal(memory.raw()!), { status: 'valid', saved });
});

test('legacy saves and partial city answers stay optional without inventing defaults', () => {
  const legacy = journal();
  assert.deepEqual(decodeJournal(JSON.stringify(legacy)), { status: 'valid', saved: legacy });
  const partial = journal();
  partial.inputs.itineraryOverrides = { hk: { includeSharedOrder: false }, sz: {} };
  partial.inputs.familiarity = { sz: { dinner: 'familiar' } };
  const memory = memoryStorage();
  assert.equal(writeJournal(partial, memory.storage).status, 'saved');
  assert.deepEqual(readJournal(memory.storage), { status: 'loaded', saved: partial });
  const explicitUndefined = {
    ...partial,
    inputs: {
      ...partial.inputs,
      itineraryOverrides: { hk: { includeSharedOrder: false, mealMinutes: undefined }, sz: {} },
      familiarity: { hk: undefined, sz: { dinner: 'familiar', walk: undefined } },
    },
  };
  assert.deepEqual(validateJournal(explicitUndefined), { status: 'valid', saved: partial });
});

test('nested player data is copied independently and unknown activity fields or hooks are not saved', () => {
  const hooks = { toJSON() { throw new Error('Never serialize caller hooks'); } };
  const saved = journal();
  const candidate = {
    ...saved,
    inputs: {
      ...saved.inputs,
      itineraryOverrides: { hk: { mealMinutes: 80, includeSharedOrder: false, extra: 'not collected', ...hooks } },
      familiarity: { sz: { dinner: 'new', walk: 'unsure', extra: 'not collected', ...hooks } },
    },
  };
  const result = validateJournal(candidate);
  assert.equal(result.status, 'valid');
  if (result.status !== 'valid') return;
  const expected = {
    ...saved,
    inputs: {
      ...saved.inputs,
      itineraryOverrides: { hk: { mealMinutes: 80, includeSharedOrder: false } },
      familiarity: { sz: { dinner: 'new', walk: 'unsure' } },
    },
  };
  assert.deepEqual(result.saved, expected);
  assert.notEqual(result.saved.inputs.itineraryOverrides, candidate.inputs.itineraryOverrides);
  assert.notEqual(result.saved.inputs.itineraryOverrides!.hk, candidate.inputs.itineraryOverrides.hk);
  assert.notEqual(result.saved.inputs.familiarity, candidate.inputs.familiarity);
  assert.notEqual(result.saved.inputs.familiarity!.sz, candidate.inputs.familiarity.sz);
  const memory = memoryStorage();
  assert.equal(writeJournal(candidate, memory.storage).status, 'saved');
  assert.deepEqual(JSON.parse(memory.raw()!), expected);
  candidate.inputs.itineraryOverrides.hk.mealMinutes = 150;
  candidate.inputs.familiarity.sz.dinner = 'familiar';
  assert.deepEqual(result.saved, expected);
});

test('malformed nested city choices never overwrite the last valid saved journal', () => {
  const valid = journal();
  valid.inputs.familiarity = { hk: { dinner: 'familiar' } };
  const before = JSON.stringify(valid);
  const invalidPatches = [
    { itineraryOverrides: null }, { itineraryOverrides: [] },
    { itineraryOverrides: { hk: null } }, { itineraryOverrides: { hk: [] } },
    { itineraryOverrides: { london: {} } }, { itineraryOverrides: { hk: { mealMinutes: 59 } } },
    { itineraryOverrides: { sz: { mealMinutes: 181 } } }, { itineraryOverrides: { hk: { walkMinutes: -1 } } },
    { itineraryOverrides: { sz: { walkMinutes: 1.5 } } }, { itineraryOverrides: { hk: { includeSharedOrder: 'false' } } },
    { itineraryOverrides: { hk: { storyDelayMinutes: 241 } } }, { itineraryOverrides: { sz: { storyDelayMinutes: NaN } } },
    { familiarity: null }, { familiarity: [] }, { familiarity: { hk: null } },
    { familiarity: { sz: [] } }, { familiarity: { hk: { dinner: 'unknown' } } },
    { familiarity: { sz: { walk: false } } }, { familiarity: { HK: { dinner: 'new' } } },
  ];
  for (const patch of invalidPatches) {
    const memory = memoryStorage(before);
    const result = writeJournal({ ...valid, inputs: { ...valid.inputs, ...patch } }, memory.storage);
    assert.equal(result.status, 'corrupt', JSON.stringify(patch));
    assert.equal(memory.writes.length, 0);
    assert.equal(memory.raw(), before);
    assert.deepEqual(readJournal(memory.storage), { status: 'loaded', saved: valid });
  }
});

test('validation returns an independent known-fields-only snapshot without mutating the caller', () => {
  const saved = journal({ notes: 'Keep exactly this.' });
  const candidate = {
    ...saved, extra: { unwanted: true },
    inputs: { ...saved.inputs, extra: 'not collected', weights: { ...saved.inputs.weights, extra: 42 } },
    toJSON() { throw new Error('Must not serialize caller hooks'); },
  };
  const result = validateJournal(candidate);
  assert.equal(result.status, 'valid');
  if (result.status !== 'valid') return;
  assert.deepEqual(result.saved, saved);
  assert.notEqual(result.saved, candidate);
  assert.notEqual(result.saved.inputs, candidate.inputs);
  assert.notEqual(result.saved.inputs.weights, candidate.inputs.weights);
  candidate.inputs.weights.price = 0;
  assert.equal(result.saved.inputs.weights.price, 3);
  assert.equal(candidate.extra.unwanted, true);
  const memory = memoryStorage();
  assert.equal(writeJournal(candidate, memory.storage).status, 'saved');
  assert.equal(JSON.parse(memory.raw()!).extra, undefined);
  assert.equal(JSON.parse(memory.raw()!).inputs.extra, undefined);
  assert.equal(JSON.parse(memory.raw()!).inputs.weights.extra, undefined);
});

test('missing storage entries are empty, whereas empty or malformed JSON is corrupt', () => {
  assert.deepEqual(readJournal(memoryStorage().storage), { status: 'empty' });
  for (const raw of ['', ' ', 'not valid JSON', '{', '{"version":1,}', 'undefined']) {
    const result = readJournal(memoryStorage(raw).storage);
    assert.equal(result.status, 'corrupt', raw);
    if (result.status === 'corrupt') assert.equal(result.reason, 'json', raw);
  }
});

test('wrong JSON shapes are corrupt schema, never unavailable storage', () => {
  for (const value of [null, false, true, 1, 'text', [], {}, { version: 1 }, { ...journal(), inputs: [] }, { ...journal(), inputs: null }, { ...journal(), inputs: { ...defaultInputs, weights: [] } }]) {
    const result = readJournal(memoryStorage(JSON.stringify(value)).storage);
    assert.equal(result.status, 'corrupt', JSON.stringify(value));
    if (result.status === 'corrupt') assert.equal(result.reason, 'schema');
  }
});

test('unsupported numeric versions are reported separately and left untouched', () => {
  for (const version of [0, 2, 99]) {
    const saved = { ...journal(), version };
    const raw = JSON.stringify(saved);
    const memory = memoryStorage(raw);
    assert.deepEqual(validateJournal(saved), { status: 'unsupported-version', version });
    assert.deepEqual(decodeJournal(raw), { status: 'unsupported-version', version });
    assert.deepEqual(readJournal(memory.storage), { status: 'unsupported-version', version });
    assert.deepEqual(writeJournal(saved, memory.storage), { status: 'unsupported-version', version });
    assert.equal(memory.raw(), raw);
    assert.equal(memory.writes.length, 0);
  }
});

test('missing or malformed schema fields cannot masquerade as a supported save', () => {
  const invalidFields: Array<[string, unknown[]]> = [
    ['version', [undefined, null, '1', 1.5, NaN, Infinity]],
    ['mode', [undefined, null, '', 'Story', 'desk', 1]],
    ['step', [undefined, null, '0', -1, 4, 0.5, NaN, Infinity]],
    ['selected', [undefined, '', 'HK', 'shenzhen', false, 0]],
    ['notes', [undefined, null, [], {}, 0, false]],
    ['completed', [undefined, null, 'true', 'false', 0, 1]],
  ];
  for (const [field, values] of invalidFields) {
    for (const value of values) {
      const result = validateJournal({ ...journal(), [field]: value });
      assert.equal(result.status, 'corrupt', `${field}: ${String(value)}`);
      if (result.status === 'corrupt') assert.equal(result.reason, 'schema');
    }
  }
  assert.equal(validateJournal(journal({ mode: 'receipt', selected: null })).status, 'corrupt');
});

test('the full domain input validation also protects persisted saves', () => {
  const invalidInputs: Record<string, unknown>[] = [
    { origin: 'unknown' }, { departureMinutes: 1440 }, { homeByMinutes: 2880 },
    { budgetPerPersonHKD: -1 }, { budgetPerPersonHKD: Infinity }, { partySize: 0 },
    { partySize: 7 }, { partySize: 1.5 }, { mealMinutes: 59 }, { mealMinutes: 181 },
    { szRoute: 'ferry' }, { fxHKDPerCNY: 0 }, { fxHKDPerCNY: NaN },
    { weights: { price: 6, ease: 3, discovery: 3 } }, { weights: {} },
    { borderBufferMinutes: 241 }, { crossingClosingBufferMinutes: 0 },
    { hkLocalMinutes: -1 }, { szLocalMinutes: 180.5 }, { walkMinutes: null },
    { hkMealPerPersonHKD: '100' }, { szMealPerPersonCNY: -1 }, { entryEligibility: 'yes' },
  ];
  for (const patch of invalidInputs) {
    const result = validateJournal({ ...journal(), inputs: { ...defaultInputs, ...patch } });
    assert.equal(result.status, 'corrupt', JSON.stringify(patch));
    if (result.status === 'corrupt') {
      assert.equal(result.reason, 'inputs');
      assert.ok(result.errors.length > 0);
    }
  }
});

test('invalid intermediate inputs do not replace the last valid journal or access storage', () => {
  const saved = journal({ notes: 'The last valid note.', inputs: { ...structuredClone(defaultInputs), budgetPerPersonHKD: 500 } });
  const memory = memoryStorage(JSON.stringify(saved));
  const invalid = { ...saved, inputs: { ...saved.inputs, fxHKDPerCNY: 0 }, notes: 'Not persisted yet.' };
  assert.equal(writeJournal(invalid, memory.storage).status, 'corrupt');
  assert.equal(memory.raw(), JSON.stringify(saved));
  assert.equal(memory.writes.length, 0);
  assert.equal(memory.reads.length, 0);
  assert.deepEqual(readJournal(memory.storage), { status: 'loaded', saved });
  assert.equal(writeJournal(invalid, () => { throw new Error('Must not access storage'); }).status, 'corrupt');
  const corrected = { ...invalid, inputs: { ...invalid.inputs, fxHKDPerCNY: 1.2 } };
  assert.deepEqual(writeJournal(corrected, memory.storage), { status: 'saved' });
  assert.deepEqual(readJournal(memory.storage), { status: 'loaded', saved: corrected });
});

test('storage source access failures are unavailable, with no thrown browser exception', () => {
  const owner = { get localStorage(): JournalStorage { throw new Error('SecurityError'); } };
  for (const source of [null, () => undefined, () => owner.localStorage]) {
    assert.deepEqual(readJournal(source), { status: 'unavailable', operation: 'access' });
    assert.deepEqual(writeJournal(journal(), source), { status: 'unavailable', operation: 'access' });
  }
});

test('the default browser adapter catches a throwing global localStorage getter', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true, get() { throw new Error('SecurityError: storage blocked'); },
    });
    assert.deepEqual(readJournal(), { status: 'unavailable', operation: 'access' });
    assert.deepEqual(writeJournal(journal()), { status: 'unavailable', operation: 'access' });
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('read and write failures are distinct and neither is reported as corrupt data', () => {
  const readBlocked: JournalStorage = {
    getItem() { throw new Error('Read denied'); }, setItem() { throw new Error('Unexpected write'); },
  };
  assert.deepEqual(readJournal(readBlocked), { status: 'unavailable', operation: 'read' });
  const previous = JSON.stringify(journal({ notes: 'Still saved' }));
  const writeBlocked: JournalStorage = {
    getItem() { return previous; }, setItem() { throw new Error('QuotaExceededError'); },
  };
  assert.deepEqual(writeJournal(journal({ notes: 'New note' }), writeBlocked), { status: 'unavailable', operation: 'write' });
  assert.deepEqual(readJournal(writeBlocked), { status: 'loaded', saved: JSON.parse(previous) });
});

test('lazy storage sources preserve method receivers and read recovery never writes', () => {
  const memory = memoryStorage('{');
  let accesses = 0;
  const source = () => { accesses += 1; return memory.storage; };
  assert.equal(readJournal(source).status, 'corrupt');
  assert.equal(accesses, 1);
  assert.equal(memory.writes.length, 0);
  const storage: JournalStorage & { raw: string | null } = {
    raw: null,
    getItem() { return this.raw; },
    setItem(_key, value) { this.raw = value; },
  };
  assert.equal(writeJournal(journal(), () => storage).status, 'saved');
  assert.deepEqual(readJournal(() => storage), { status: 'loaded', saved: journal() });
});

test('hostile caller object getters are schema errors and cannot corrupt a valid save', () => {
  const memory = memoryStorage(JSON.stringify(journal()));
  const candidate = { ...journal(), get notes() { throw new Error('Unreadable property'); } };
  const result = writeJournal(candidate, memory.storage);
  assert.equal(result.status, 'corrupt');
  if (result.status === 'corrupt') assert.equal(result.reason, 'schema');
  assert.equal(memory.writes.length, 0);
  assert.deepEqual(readJournal(memory.storage), { status: 'loaded', saved: journal() });
});
