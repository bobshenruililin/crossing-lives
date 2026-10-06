import type { OptionId, OutingOption } from '../domain/model';

/** A transient display-only snapshot, never business revenue or an allocation input. */
export interface SpendingContext {
  readonly cityId: OptionId;
  readonly partySize: number;
  readonly perPersonHKD: number | null;
  readonly groupHKD: number | null;
  readonly dataStatus: 'illustrative';
  readonly scope: 'whole-outing';
}

/** Copy the existing engine totals without recalculating money or carrying private state. */
export function createSpendingContext(option: OutingOption | null, partySize: number): SpendingContext | null {
  if (!option || !Number.isInteger(partySize) || partySize < 1 || partySize > 6) return null;
  const complete = typeof option.perPersonHKD === 'number' && Number.isFinite(option.perPersonHKD) && option.perPersonHKD >= 0
    && typeof option.groupHKD === 'number' && Number.isFinite(option.groupHKD) && option.groupHKD >= 0;
  return Object.freeze({
    cityId: option.id,
    partySize,
    perPersonHKD: complete ? option.perPersonHKD : null,
    groupHKD: complete ? option.groupHKD : null,
    dataStatus: 'illustrative',
    scope: 'whole-outing',
  });
}
