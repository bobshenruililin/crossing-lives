import type { StoryState } from './model';

/** Authored fiction about Jun only. This selector never infers player history,
 * familiarity, feelings or relationship state, and never changes the story. */
export interface JunDialogue {
  invitation: string;
  tableArrival: string | null;
  afterDinner: string | null;
  afterWalk: string | null;
  returnInvitation: string;
  homeMessage: string | null;
}

const invitation = 'Dinner and a proper catch-up? Shall we stay by the harbor, or go over to a few streets I know in Luohu?';
const tableArrival = {
  hk: 'I used to come here after work, when I’d just started my first job. Haven’t had an evening like this in a while.',
  sz: 'I used to spend whole Saturdays around here, walking after lunch. I’m curious what I’ll recognize now. Let’s see what’s on the menu.',
} as const;
const walks = {
  hk: {
    short: 'We’re barely around the corner, and it already feels like a break.',
    long: 'I’d forgotten how the restaurant lights look from down here.',
  },
  sz: {
    short: 'I used to stop around here on those Saturday walks.',
    long: 'I used to take the long way past these lights. It’s nice having company this time.',
  },
} as const;
const homeMessages = {
  hk: {
    short: 'Home. I’m glad we had time for a proper catch-up.',
    long: 'Home. I’m still seeing those lights on the water. Thanks for coming out.',
  },
  sz: {
    short: 'Home. A familiar corner, a good dinner. I’m glad we made the trip.',
    long: 'Home. That walk brought back more than I expected. I’m glad I showed you.',
  },
} as const;
const directReturnMessage = 'Home. Thanks for heading back with me after dinner. Let’s do this again.';

export function selectJunDialogue(state: StoryState): JunDialogue {
  const attempt=state.currentAttempt;
  const city=attempt.city ?? state.previewCity;
  const walked=attempt.walkChoice==='short'||attempt.walkChoice==='long' ? attempt.walkChoice : null;
  return {
    invitation,
    tableArrival: city ? tableArrival[city] : null,
    afterDinner: attempt.dinnerChoice==='simple' ? 'That hit the spot.' : attempt.dinnerChoice==='linger'&&city
      ? city==='hk'?'I’m glad we shared that dessert.':'I’m glad we tried one more dish.' : null,
    afterWalk: city&&walked ? walks[city][walked] : null,
    returnInvitation: 'Shall we head back?',
    homeMessage: attempt.phase==='home'&&city
      ? attempt.walkChoice==='none'?directReturnMessage:walked?homeMessages[city][walked]:null
      : null,
  };
}
