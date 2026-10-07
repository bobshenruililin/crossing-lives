import type { InteractionValues } from '../types';
import { clockText, committedHomeSummary } from './model';

/** Optional map content. It never navigates, locks a scene or marks activities complete. */
export function PlanSummary({ values }: { values: InteractionValues }) {
  const plan = committedHomeSummary(values);
  if (!plan) return null;
  return <details className="wd-plan-summary" data-testid="committed-home-plan"><summary>Your plan · home by {clockText(plan.deadlineMinute)}</summary><p className="wd-plan-status">{plan.lateMinutes ? `${plan.lateMinutes} minutes late` : plan.spareMinutes ? `${plan.spareMinutes} minutes spare` : 'Exactly on time'} in the invented exercise. Example finish {clockText(plan.finishMinute)}.</p><ul>{plan.activities.map(activity => <li key={activity.id} data-plan-activity={activity.id} data-plan-choice={activity.choice}><span>{activity.label}</span><span>{activity.choice === 'omit' ? 'Left out' : `${activity.minutes} min${activity.choice === 'short' ? ' · shortened' : ''}`}</span></li>)}</ul><p>The Hong Kong–Shenzhen round trip keeps its assumed 6h allowance. Travel times remain unverified. All places are still open; change this plan at home.</p></details>;
}
