import type {
  ActivityFamiliarity, ComparisonResult, Familiarity, OptionId, OutingInputs, OutingOption, ShenzhenRoute,
} from '../domain/model';

export type StoryPresetId = 'short' | 'wander' | 'budget';
export type StoryPhase = 'fork' | 'arrival' | 'afterDinner' | 'walk' | 'home';
export type DinnerChoice = 'simple' | 'linger';
export type WalkChoice = 'short' | 'long';
export type StoryMemento = 'view' | 'conversation' | 'practical';
export type StoryHotspot = 'table' | 'wander' | 'home';
export type DelayScenario = 'none' | 'dinner30';
export type StoryFamiliarity = Record<OptionId, ActivityFamiliarity>;

export interface StoryPreset {
  id: StoryPresetId;
  label: string;
  description: string;
  departureMinutes: number;
  homeByMinutes: number;
  budgetPerPersonHKD: number;
  partySize: 2;
}

export interface StoryAttempt {
  /** Deterministic local sequence number, not a timestamp or real-world booking ID. */
  id: number;
  city: OptionId | null;
  route: ShenzhenRoute;
  phase: StoryPhase;
  dinnerChoice: DinnerChoice | null;
  walkChoice: WalkChoice | null;
  memento: StoryMemento | null;
  /** Stable city:hotspot keys allow free inspection of both branches. */
  inspectedHotspots: string[];
  familiarity: StoryFamiliarity;
  journalNote: string;
}

/** An immutable-by-convention snapshot, including its own scenario assumptions. */
export interface StoryAttemptSnapshot extends StoryAttempt {
  presetId: StoryPresetId;
  baseInputs: OutingInputs;
  delayScenario: DelayScenario;
}

export interface StoryState {
  version: 2;
  scenarioId: 'fictional-saturday-v1';
  presetId: StoryPresetId;
  baseInputs: OutingInputs;
  delayScenario: DelayScenario;
  currentAttempt: StoryAttempt;
  previousAttempt: StoryAttemptSnapshot | null;
  /** Free inspection/navigation state. Neither changes commitments or modeled time. */
  previewCity: OptionId | null;
  openHotspot: StoryHotspot | null;
}

export interface StorySetup {
  delayScenario?: DelayScenario;
  baseInputs?: Partial<OutingInputs>;
}

export type StoryAction =
  | { type: 'INSPECT'; hotspot: StoryHotspot }
  | { type: 'CLOSE_INSPECTION' }
  | { type: 'PREVIEW_CITY'; city: OptionId }
  | { type: 'SET_ROUTE'; route: ShenzhenRoute }
  | { type: 'COMMIT_DEPARTURE'; city: OptionId; route?: ShenzhenRoute }
  | { type: 'COMMIT_DINNER'; choice: DinnerChoice }
  | { type: 'COMMIT_WALK'; choice: WalkChoice }
  | { type: 'KEEP_MEMENTO'; memento: StoryMemento }
  | { type: 'SET_FAMILIARITY'; city: OptionId; activity: keyof ActivityFamiliarity; value: Familiarity }
  | { type: 'SET_JOURNAL_NOTE'; text: string }
  | { type: 'RETURN_HOME' }
  | { type: 'REWIND'; checkpoint: 'fork' | 'arrival' | 'afterDinner' }
  | { type: 'TRY_OTHER_CITY' }
  | { type: 'RESET'; presetId?: StoryPresetId }
  | { type: 'RECONFIGURE'; presetId?: StoryPresetId; inputs?: Partial<OutingInputs>; delayScenario?: DelayScenario };

export interface StoryProgress {
  phase: StoryPhase;
  elapsedMinutes: number;
  clockMinutes: number;
  projectedReturnMinutes: number | null;
  dinnerEndMinutes: number | null;
  delayApplied: boolean;
  delayMinutes: number;
  /** Completed legs only; the option's total remains a projected whole outing until home. */
  outwardComplete: boolean;
  dinnerComplete: boolean;
  walkComplete: boolean;
  homeComplete: boolean;
}

export interface StoryActionPreview {
  allowed: boolean;
  state: StoryState;
  comparison: ComparisonResult;
  option: OutingOption | null;
  progress: StoryProgress;
  /** Null means at least one whole-outing total is unknown. Never a partial savings claim. */
  billDeltaHKD: number | null;
  perPersonDeltaHKD: number | null;
  returnDeltaMinutes: number | null;
  warnings: string[];
}
