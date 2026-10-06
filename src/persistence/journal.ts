import { validateInputs } from '../domain/engine';
import type { OptionId, OutingInputs } from '../domain/model';

export const JOURNAL_STORAGE_KEY = 'between-journal-v1';
export type JournalMode = 'intro' | 'story' | 'explore' | 'receipt';

/** The existing local-only v1 format. No history, account or inferred state is added. */
export interface SavedJournal {
  version: 1;
  inputs: OutingInputs;
  mode: JournalMode;
  /** A zero-based chapter index, validated as a whole number from 0 to 3. */
  step: number;
  selected: OptionId | null;
  notes: string;
  completed: boolean;
}

/** A small injectable contract: Node tests do not need a DOM or a Storage mock. */
export interface JournalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Use a function when obtaining the storage object itself can throw. */
export type JournalStorageSource = JournalStorage | null | undefined | (() => JournalStorage | null | undefined);

type CorruptJournal = { status: 'corrupt'; reason: 'json' | 'schema' | 'inputs'; errors: string[] };
type UnsupportedJournal = { status: 'unsupported-version'; version: number };
type UnavailableStorage = { status: 'unavailable'; operation: 'access' | 'read' | 'write' };
export type JournalValidationResult = { status: 'valid'; saved: SavedJournal } | CorruptJournal | UnsupportedJournal;
export type JournalReadResult = { status: 'loaded'; saved: SavedJournal } | { status: 'empty' } | CorruptJournal | UnsupportedJournal | UnavailableStorage;
export type JournalWriteResult = { status: 'saved' } | CorruptJournal | UnsupportedJournal | UnavailableStorage;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const corrupt = (reason: CorruptJournal['reason'], ...errors: string[]): CorruptJournal => ({ status: 'corrupt', reason, errors });
const optionalInputKeys = [
  'borderBufferMinutes', 'crossingClosingBufferMinutes', 'hkMealPerPersonHKD',
  'szMealPerPersonCNY', 'hkLocalMinutes', 'szLocalMinutes', 'walkMinutes', 'entryEligibility',
] as const satisfies readonly (keyof OutingInputs)[];
const perCityInputFields = [
  ['itineraryOverrides', ['mealMinutes', 'walkMinutes', 'includeSharedOrder', 'storyDelayMinutes']],
  ['familiarity', ['dinner', 'walk']],
] as const;

/**
 * Validate unknown data and return an independent, known-fields-only snapshot.
 * Notes are preserved verbatim. Unknown fields are ignored, never persisted.
 * Input validity is distinct from whether an outing fits the person's constraints.
 */
export function validateJournal(value: unknown): JournalValidationResult {
  try {
    if (!isRecord(value)) return corrupt('schema', 'The saved journal must be an object.');
    const { version, mode, step, selected, notes, completed, inputs: rawInputs } = value;
    if (typeof version !== 'number' || !Number.isInteger(version)) return corrupt('schema', 'A numeric journal version is required.');
    if (version !== 1) return { status: 'unsupported-version', version };
    if (mode !== 'intro' && mode !== 'story' && mode !== 'explore' && mode !== 'receipt') return corrupt('schema', 'The saved view is not recognized.');
    if (typeof step !== 'number' || !Number.isInteger(step) || step < 0 || step > 3) return corrupt('schema', 'The saved chapter must be from 0 to 3.');
    if (selected !== null && selected !== 'hk' && selected !== 'sz') return corrupt('schema', 'The saved choice must be Hong Kong, Shenzhen or empty.');
    if (mode === 'receipt' && selected === null) return corrupt('schema', 'A field note view requires a selected outing.');
    if (typeof notes !== 'string') return corrupt('schema', 'The saved note must be text.');
    if (typeof completed !== 'boolean') return corrupt('schema', 'The completion flag must be true or false.');
    if (!isRecord(rawInputs)) return corrupt('schema', 'Saved inputs must be an object.');
    const weights = rawInputs.weights;
    if (!isRecord(weights)) return corrupt('schema', 'Saved preference weights must be an object.');

    // Read each supported value once, without retaining extra fields or toJSON hooks.
    const inputSnapshot: Record<string, unknown> = {
      origin: rawInputs.origin,
      departureMinutes: rawInputs.departureMinutes,
      homeByMinutes: rawInputs.homeByMinutes,
      budgetPerPersonHKD: rawInputs.budgetPerPersonHKD,
      partySize: rawInputs.partySize,
      mealMinutes: rawInputs.mealMinutes,
      weights: { price: weights.price, ease: weights.ease, discovery: weights.discovery },
      szRoute: rawInputs.szRoute,
      fxHKDPerCNY: rawInputs.fxHKDPerCNY,
    };
    for (const key of optionalInputKeys) {
      const input = rawInputs[key];
      if (input !== undefined) inputSnapshot[key] = input;
    }
    for (const [field, keys] of perCityInputFields) {
      const record = rawInputs[field];
      if (record === undefined) continue;
      if (!isRecord(record)) return corrupt('schema', `${field} must be a per-city object.`);
      // A misspelled city is invalid, rather than silently losing a player's answers.
      if (Object.keys(record).some(city => city !== 'hk' && city !== 'sz')) return corrupt('inputs', `${field} contains an unknown city.`);
      const cities: Record<string, unknown> = {};
      for (const city of ['hk', 'sz'] as const) {
        const rawCity = record[city];
        if (rawCity === undefined) continue;
        if (!isRecord(rawCity)) return corrupt('schema', `${field}.${city} must be an object.`);
        const citySnapshot: Record<string, unknown> = {};
        for (const key of keys) {
          const input = rawCity[key];
          if (input !== undefined) citySnapshot[key] = input;
        }
        cities[city] = citySnapshot;
      }
      inputSnapshot[field] = cities;
    }
    // The domain validator checks all required fields and supplied overrides.
    const inputs = inputSnapshot as unknown as OutingInputs;
    const errors = validateInputs(inputs);
    if (errors.length) return { status: 'corrupt', reason: 'inputs', errors };
    return { status: 'valid', saved: { version, inputs, mode, step, selected, notes, completed } };
  } catch {
    // A malformed caller-provided object is not a browser storage failure.
    return corrupt('schema', 'The saved journal could not be inspected.');
  }
}

/** Parsing errors are corrupt data, not evidence that browser storage is blocked. */
export function decodeJournal(raw: string): JournalValidationResult {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { return corrupt('json', 'The saved journal is not valid JSON.'); }
  return validateJournal(value);
}

const browserStorage = (): JournalStorage | undefined => globalThis.localStorage;
function resolveStorage(source: JournalStorageSource): JournalStorage | null | undefined {
  return typeof source === 'function' ? source() : source;
}

/** Read only; an unreadable or incompatible save is never deleted by recovery. */
export function readJournal(source: JournalStorageSource = browserStorage): JournalReadResult {
  let storage: JournalStorage | null | undefined;
  try { storage = resolveStorage(source); }
  catch { return { status: 'unavailable', operation: 'access' }; }
  if (!storage) return { status: 'unavailable', operation: 'access' };

  let raw: string | null;
  try { raw = storage.getItem(JOURNAL_STORAGE_KEY); }
  catch { return { status: 'unavailable', operation: 'read' }; }
  if (raw === null) return { status: 'empty' };
  const decoded = decodeJournal(raw);
  return decoded.status === 'valid' ? { status: 'loaded', saved: decoded.saved } : decoded;
}

/** Invalid intermediate edits never touch storage or replace the last valid save. */
export function writeJournal(candidate: unknown, source: JournalStorageSource = browserStorage): JournalWriteResult {
  const validated = validateJournal(candidate);
  if (validated.status !== 'valid') return validated;
  // The canonical snapshot contains only validated JSON-safe values.
  const raw = JSON.stringify(validated.saved);
  let storage: JournalStorage | null | undefined;
  try { storage = resolveStorage(source); }
  catch { return { status: 'unavailable', operation: 'access' }; }
  if (!storage) return { status: 'unavailable', operation: 'access' };
  try { storage.setItem(JOURNAL_STORAGE_KEY, raw); }
  catch { return { status: 'unavailable', operation: 'write' }; }
  return { status: 'saved' };
}
