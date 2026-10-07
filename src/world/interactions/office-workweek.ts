import type { InteractionValues } from '../types';

/** Invented return-commute allowances for one adult with the same HK job/pay.
 * Four weeks is a fixed comparison window, never a calendar month or live clock. */
export const OFFICE_WORKWEEK = Object.freeze({
  weeks: 4,
  hongKong: Object.freeze({ minutesPerReturn: 90, hkdPerReturn: 40 }),
  shenzhen: Object.freeze({ minutesPerReturn: 210, hkdPerReturn: 100 }),
});
export type OfficeDays = 2 | 4;
export type OfficeMeasure = 'time' | 'money';
export function readOfficeWorkweek(values: InteractionValues) {
  return {
    days: values.officeWorkweekDays === 4 ? 4 as const : 2 as const,
    measure: values.officeWorkweekMeasure === 'money' ? 'money' as const : 'time' as const,
  };
}
export function setOfficeDays(values: InteractionValues, days: OfficeDays): InteractionValues {
  if (days !== 2 && days !== 4) throw new RangeError('Office days must be 2 or 4.');
  return { ...values, officeWorkweekDays: days };
}
export function setOfficeMeasure(values: InteractionValues, measure: OfficeMeasure): InteractionValues {
  if (measure !== 'time' && measure !== 'money') throw new RangeError('Choose time or money.');
  return { ...values, officeWorkweekMeasure: measure };
}
export function officeWorkweek(days: OfficeDays) {
  if (days !== 2 && days !== 4) throw new RangeError('Office days must be 2 or 4.');
  const returns = days * OFFICE_WORKWEEK.weeks;
  const total = (daily: typeof OFFICE_WORKWEEK.hongKong | typeof OFFICE_WORKWEEK.shenzhen) => ({
    hours: returns * daily.minutesPerReturn / 60,
    hkd: returns * daily.hkdPerReturn,
  });
  return { returns, hongKong: total(OFFICE_WORKWEEK.hongKong), shenzhen: total(OFFICE_WORKWEEK.shenzhen) };
}
