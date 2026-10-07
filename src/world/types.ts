/** The new world owns this entire model. It never imports legacy sessions or saves. */
export const SCENE_IDS = ['hk-home', 'metro-carriage', 'border-arrival', 'parcel-counter', 'mall-foodcourt', 'neighborhood-lane', 'urban-village', 'rental-home', 'luxury-home', 'office-floor', 'learning-center', 'planning-museum'] as const;
export type SceneId = typeof SCENE_IDS[number];
export const PARTY_IDS = ['two-friends', 'solo', 'couple', 'older-couple', 'family'] as const;
export type PartyId = typeof PARTY_IDS[number];
export type DayId = 'weekend' | 'weekday';
export type ScenarioId = 'fieldtrip' | 'daily-life' | 'housing';
export interface WorldContext { party: PartyId; day: DayId; scenario: ScenarioId }
export interface Point { x: number; y: number }
export interface WalkArea { left: number; right: number; top: number; bottom: number }
export type InteractionValues = Readonly<Record<string, string | number | boolean | null>>;
export interface SceneExit extends Point { id: string; targetSceneId: SceneId; label: string; entryDirection: 'left' | 'right'; doorAnchor?: Point }
export interface ScenePoint extends Point { id: string; label: string; icon: string; thought: string; interactionId: string; approach?: Point }
export interface SceneRecord {
  id: SceneId; title: string; placeLabel: string;
  art: { src: string; alt: string; approved: boolean; focus?: Point };
  playerStart: Point; entryPoints?: { left?: Point; right?: Point }; playerBodyHeight: number; walkArea: WalkArea; exits: readonly SceneExit[]; points: readonly ScenePoint[];
  palette: readonly [string, string, string]; map: Point;
}
export interface InteractionProps {
  sceneId: SceneId;
  interactionId: string;
  context: WorldContext;
  /** Values are scoped to this interaction, restored on revisits. */
  values: InteractionValues;
  /** Replaces this interaction's values only. Do not write browser storage. */
  onChange: (values: InteractionValues) => void;
  onClose: () => void;
}
