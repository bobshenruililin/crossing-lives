import type { Page } from '@playwright/test';
import { defaultInputs } from '../../src/domain/data';
import { validateJournal, type SavedJournal } from '../../src/persistence/journal';
import { createStoryState, storyReducer, validateStoryState } from '../../src/story/engine';
import type { StoryState } from '../../src/story/model';

export const STORY_KEY = 'between-playable-v2';

/** Older valid saves remain compatible without making players write or collect anything. */
export function legacyCompletedStory(options: {
  city?: 'hk' | 'sz';
  route?: 'rail' | 'bus';
  dinner?: 'simple' | 'linger';
  walk?: 'short' | 'long';
  note?: string;
} = {}): StoryState {
  let state = createStoryState();
  state = storyReducer(state, { type: 'COMMIT_DEPARTURE', city: options.city ?? 'hk', route: options.route ?? 'rail' });
  state = storyReducer(state, { type: 'COMMIT_DINNER', choice: options.dinner ?? 'linger' });
  state = storyReducer(state, { type: 'COMMIT_WALK', choice: options.walk ?? 'long' });
  state = storyReducer(state, { type: 'KEEP_MEMENTO', memento: 'conversation' });
  state = storyReducer(state, { type: 'SET_JOURNAL_NOTE', text: options.note ?? 'An older private note stays intact.' });
  state = storyReducer(state, { type: 'RETURN_HOME' });
  const errors = validateStoryState(state);
  if (errors.length) throw new Error(`Invalid browser fixture: ${errors.join(' ')}`);
  return state;
}

export async function seedStoryRaw(page: Page, raw: string) {
  await page.addInitScript(({ key, bytes }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, bytes);
  }, { key: STORY_KEY, bytes: raw });
}

export async function seedStory(page: Page, state: StoryState) {
  const errors = validateStoryState(state);
  if (errors.length) throw new Error(`Invalid browser fixture: ${errors.join(' ')}`);
  await seedStoryRaw(page, JSON.stringify(state));
}


export async function seedLegacyPlanner(page: Page, notes = 'A preserved practical note from an older version.') {
  const saved: SavedJournal = {
    version: 1, inputs: structuredClone(defaultInputs), mode: 'receipt', step: 0,
    selected: 'hk', notes, completed: true,
  };
  if (validateJournal(saved).status !== 'valid') throw new Error('Invalid practical-planner fixture.');
  await page.addInitScript(value => {
    if (localStorage.getItem('between-journal-v1') === null) localStorage.setItem('between-journal-v1', JSON.stringify(value));
  }, saved);
  return saved;
}
