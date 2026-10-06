import assert from 'node:assert/strict';
import test from 'node:test';
import { selectJunDialogue } from '../src/story/dialogue';
import { createStoryState, selectStoryOption, selectStoryProgress, storyReducer } from '../src/story/engine';
import type { StoryAction, StoryState } from '../src/story/model';

const act = (state: StoryState, ...actions: StoryAction[]) => actions.reduce(storyReducer, state);
const evening = (city: 'hk' | 'sz', dinner: 'simple' | 'linger', walk: 'short' | 'long' | 'none') => {
  let state = act(createStoryState(), { type: 'PREVIEW_CITY', city }, { type: 'COMMIT_DEPARTURE', city }, { type: 'COMMIT_DINNER', choice: dinner });
  state = walk === 'none' ? act(state, { type: 'RETURN_AFTER_DINNER' }) : act(state, { type: 'COMMIT_WALK', choice: walk }, { type: 'RETURN_HOME' });
  return state;
};
const freeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

test('Jun invitation asks one ordinary question without assigning the player a past', () => {
  assert.equal(selectJunDialogue(createStoryState()).invitation, 'Dinner and a proper catch-up? Shall we stay by the harbor, or go over to a few streets I know in Luohu?');
});

test('each chosen table has its own approved Jun-owned connection', () => {
  assert.equal(selectJunDialogue(evening('hk', 'simple', 'short')).tableArrival, 'I used to come here after work, when I’d just started my first job. Haven’t had an evening like this in a while.');
  assert.equal(selectJunDialogue(evening('sz', 'simple', 'short')).tableArrival, 'I used to spend whole Saturdays around here, walking after lunch. I’m curious what I’ll recognize now. Let’s see what’s on the menu.');
});

test('meal acknowledgments distinguish simple dinner from the actual shared order', () => {
  for (const city of ['hk', 'sz'] as const) assert.equal(selectJunDialogue(evening(city, 'simple', 'long')).afterDinner, 'That hit the spot.');
  assert.equal(selectJunDialogue(evening('hk', 'linger', 'long')).afterDinner, 'I’m glad we shared that dessert.');
  assert.equal(selectJunDialogue(evening('sz', 'linger', 'long')).afterDinner, 'I’m glad we tried one more dish.');
});

test('walk dialogue follows the actual short or long place attended in each city', () => {
  const lines = {
    hk: { short: 'We’re barely around the corner, and it already feels like a break.', long: 'I’d forgotten how the restaurant lights look from down here.' },
    sz: { short: 'I used to stop around here on those Saturday walks.', long: 'I remember those café lights under the trees. It’s nice having company this time.' },
  };
  for (const city of ['hk', 'sz'] as const) for (const walk of ['short', 'long'] as const) {
    const copy = selectJunDialogue(evening(city, 'simple', walk));
    assert.equal(copy.afterWalk, lines[city][walk]);
    assert.equal(copy.returnInvitation, 'Shall we head back?');
  }
});

test('optional home callback is choice-specific and direct return never recalls a walk', () => {
  const lines = {
    hk: { short: 'Home. I’m glad we had time for a proper catch-up.', long: 'Home. I’m still seeing those lights on the water. Thanks for coming out.' },
    sz: { short: 'Home. A familiar corner, a good dinner. I’m glad we made the trip.', long: 'Home. I’m still seeing those café lights under the trees. I’m glad we took the longer way.' },
  };
  for (const city of ['hk', 'sz'] as const) for (const dinner of ['simple', 'linger'] as const) {
    for (const walk of ['short', 'long'] as const) assert.equal(selectJunDialogue(evening(city, dinner, walk)).homeMessage, lines[city][walk]);
    const direct = selectJunDialogue(evening(city, dinner, 'none')).homeMessage;
    assert.equal(direct, 'Home. Thanks for heading back with me after dinner. Let’s do this again.');
    assert.ok(typeof direct === 'string');
    assert.doesNotMatch(direct, /walk|harbor|avenue|water/);
  }
});

test('authored copy cannot alter time, bill, eligibility, familiarity or saved legacy details', () => {
  for (const city of ['hk', 'sz'] as const) for (const dinner of ['simple', 'linger'] as const) for (const walk of ['short', 'long', 'none'] as const) {
    const state = evening(city, dinner, walk);
    state.currentAttempt.journalNote = 'Legacy detail: retained privately, never voiced by Jun.';
    state.currentAttempt.memento = 'conversation';
    const before = JSON.stringify(state);
    const option = selectStoryOption(state), progress = selectStoryProgress(state);
    freeze(state);
    const copy = selectJunDialogue(state);
    assert.deepEqual(selectJunDialogue(state), copy);
    assert.equal(JSON.stringify(state), before);
    assert.deepEqual(selectStoryOption(state), option);
    assert.deepEqual(selectStoryProgress(state), progress);
    assert.doesNotMatch(JSON.stringify(copy), /Legacy detail/);
  }
});

test('replay and reconsideration derive the next callback without a hidden message history', () => {
  const first = evening('hk', 'linger', 'long');
  const replay = act(first, { type: 'TRY_OTHER_CITY' }, { type: 'COMMIT_DEPARTURE', city: 'sz' }, { type: 'COMMIT_DINNER', choice: 'simple' }, { type: 'COMMIT_WALK', choice: 'short' }, { type: 'RETURN_HOME' });
  assert.notEqual(selectJunDialogue(replay).homeMessage, selectJunDialogue(first).homeMessage);
  assert.equal(replay.previousAttempt?.journalNote, first.currentAttempt.journalNote);
  const direct = act(replay, { type: 'REWIND', checkpoint: 'afterDinner' }, { type: 'RETURN_AFTER_DINNER' });
  assert.equal(selectJunDialogue(direct).homeMessage, 'Home. Thanks for heading back with me after dinner. Let’s do this again.');
  assert.deepEqual(direct.previousAttempt, replay.previousAttempt);
});


test('uncommitted and rewound choices do not fabricate a completed home message or walk', () => {
  const first = createStoryState();
  const copy = selectJunDialogue(first);
  assert.equal(copy.tableArrival, null);
  assert.equal(copy.afterDinner, null);
  assert.equal(copy.afterWalk, null);
  assert.equal(copy.homeMessage, null);
  const preview = act(first, { type: 'PREVIEW_CITY', city: 'sz' });
  assert.ok(selectJunDialogue(preview).tableArrival);
  assert.equal(selectJunDialogue(preview).homeMessage, null);
  const completed = evening('sz', 'linger', 'none');
  assert.equal(selectJunDialogue(completed).afterWalk, null);
  const rewind = act(completed, { type: 'REWIND', checkpoint: 'afterDinner' });
  assert.equal(selectJunDialogue(rewind).homeMessage, null);
  assert.equal(selectJunDialogue(rewind).afterWalk, null);
});
