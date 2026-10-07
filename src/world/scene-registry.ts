import { SCENE_IDS } from './types';
import { SCENE_ART_OVERRIDES } from './scene-art.generated';
import { WORLD_SCENES } from './public-content';
import type { SceneId, SceneRecord } from './types';

/** Only the lead may enable approved after reviewing and merging each image. */
const APPROVED_ART: Partial<Record<SceneId, boolean>> = {};
const definitions: Record<SceneId, { title: string; placeLabel: string; object: string; icon: string; thought: string; palette: readonly [string,string,string] }> = {
  'hk-home': { title: 'A day across the city', placeLabel: 'Departure home · Hong Kong', object: 'The day bag', icon: '▣', thought: 'A notebook, a parcel, or room for something unexpected. What would you bring into this day?', palette: ['#374c63','#839b94','#d6bd91'] },
  'metro-carriage': { title: 'Between stops', placeLabel: 'Inside the train', object: 'The window seat', icon: '◷', thought: 'One journey can feel like spare time. Repeat it all week and the same minutes become something else.', palette: ['#315267','#a9bbad','#d1b486'] },
  'border-arrival': { title: 'Another side of the city', placeLabel: 'Futian · fictional field route', object: 'The arrival board', icon: '↗', thought: 'A route on a map is one thing. Opening hours, the service, and permission to cross are three different checks.', palette: ['#4b6d75','#c1ba9b','#c79168'] },
  'parcel-counter': { title: 'A small errand', placeLabel: 'Parcel counter', object: 'The parcel shelf', icon: '▤', thought: 'If we are already here, this is a small detour. Would the same collection make sense as a trip of its own?', palette: ['#426354','#bcb48c','#d3996a'] },
  'mall-foodcourt': { title: 'A familiar table', placeLabel: 'Mall food court', object: 'The menu board', icon: '≡', thought: 'A familiar menu can draw different people for different reasons. What would help us tell those reasons apart?', palette: ['#58586e','#c1ad87','#e0bc73'] },
  'neighborhood-lane': { title: 'The everyday lane', placeLabel: 'Neighborhood lane', object: 'The street bench', icon: '⌖', thought: 'A bench, a shop, a place to wait. What can we see here, and what are we only guessing?', palette: ['#41675f','#bdc28f','#b78e69'] },
  'urban-village': { title: 'Close together', placeLabel: 'Fictional urban village', object: 'The lane entrance', icon: '▥', thought: 'More room is only one housing question. What happens to the routes, services, and people already close by?', palette: ['#596663','#b6afa1','#b38966'] },
  'rental-home': { title: 'A place to rent', placeLabel: 'Fictional rental home', object: 'The rental notice', icon: '▱', thought: 'The monthly rent is visible. Which other costs belong beside it before we compare two homes?', palette: ['#4e6570','#c0bda0','#bd946f'] },
  'luxury-home': { title: 'Space and a view', placeLabel: 'Fictional larger home', object: 'The window desk', icon: '◇', thought: 'A home can be a place to live and an asset. Monthly rent and purchase value answer different questions.', palette: ['#526b79','#c7c2a9','#d0ad80'] },
  'office-floor': { title: 'A working day', placeLabel: 'Office floor', object: 'The work desk', icon: '▦', thought: 'Hold the job fixed, then move the home. Which parts of the working day actually change?', palette: ['#4f686d','#b2c4bd','#b9ab88'] },
  'learning-center': { title: 'Room to learn', placeLabel: 'Learning center', object: 'The workshop table', icon: '✎', thought: 'A useful next step might be a skill, practical help, or a place to try something. What would make it accessible?', palette: ['#52695a','#c5bf93','#d0a078'] },
  'planning-museum': { title: 'The city in layers', placeLabel: 'Planning museum', object: 'The city model', icon: '▧', thought: 'The city looks different through homes, work, and transport. Which layer would change your explanation?', palette: ['#3a596a','#acb6a7','#c9b47d'] },
};

export const SCENES: Record<SceneId, SceneRecord> = Object.fromEntries(SCENE_IDS.map((id, index) => {
  const item = definitions[id];
  const content = WORLD_SCENES[id];
  const previous = SCENE_IDS[(index + SCENE_IDS.length - 1) % SCENE_IDS.length];
  const next = SCENE_IDS[(index + 1) % SCENE_IDS.length];
  return [id, {
    id, title: content.title, placeLabel: content.placeLabel,
    art: { src: `art/${id}.webp`, alt: `Original pixel illustration of ${item.placeLabel.toLowerCase()}.`, approved: APPROVED_ART[id] === true },
    playerStart: { x: 810, y: 785 }, playerBodyHeight: id === 'metro-carriage' ? 255 : 105, walkArea: { left: 170, right: 1500, top: 710, bottom: 850 },
    exits: [
      { id: `${id}-back`, targetSceneId: previous, label: definitions[previous].placeLabel.split(' · ')[0], x: 260, y: 780, entryDirection: 'right' as const },
      { id: `${id}-next`, targetSceneId: next, label: definitions[next].placeLabel.split(' · ')[0], x: 1400, y: 780, entryDirection: 'left' as const },
    ],
    points: [{ id: `${id}-object`, label: content.pointLabel, x: 950, y: 735, icon: item.icon, thought: content.thought, interactionId: content.interactionId }],
    palette: item.palette, map: { x: index % 4, y: Math.floor(index / 4) },
    ...SCENE_ART_OVERRIDES[id],
  } satisfies SceneRecord];
})) as Record<SceneId, SceneRecord>;
export const getScene = (id: SceneId): SceneRecord => SCENES[id];
export const isSceneId = (value: string): value is SceneId => SCENE_IDS.includes(value as SceneId);
