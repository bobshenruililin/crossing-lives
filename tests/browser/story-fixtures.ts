import type { Page } from '@playwright/test';
import { defaultInputs } from '../../src/domain/data';
import { validateJournal, type SavedJournal } from '../../src/persistence/journal';
import { createStoryState, storyReducer, validateStoryState } from '../../src/story/engine';
import type { StoryState } from '../../src/story/model';

export const STORY_KEY = 'between-playable-v2';

// Independent approved-copy expectations. Do not call the production dialogue
// selector as the browser oracle: the rendered line must match the approved text.
export const junWords = {
  invitation: 'Dinner and a proper catch-up? Shall we stay by the harbor, or go over to a few streets I know in Luohu?',
  table: {
    hk: 'I used to come here after work, when I’d just started my first job. Haven’t had an evening like this in a while.',
    sz: 'I used to spend whole Saturdays around here, walking after lunch. I’m curious what I’ll recognize now. Let’s see what’s on the menu.',
  },
  walk: {
    hk: { short: 'We’re barely around the corner, and it already feels like a break.', long: 'I’d forgotten how the restaurant lights look from down here.' },
    sz: { short: 'I used to stop around here on those Saturday walks.', long: 'I used to take the long way past these lights. It’s nice having company this time.' },
  },
  home: {
    hk: { short: 'Home. I’m glad we had time for a proper catch-up.', long: 'Home. I’m still seeing those lights on the water. Thanks for coming out.' },
    sz: { short: 'Home. A familiar corner, a good dinner. I’m glad we made the trip.', long: 'Home. That walk brought back more than I expected. I’m glad I showed you.' },
  },
  direct: 'Home. Thanks for heading back with me after dinner. Let’s do this again.',
} as const;

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
