export const PHONE_SCENES = ['hk-home', 'metro-carriage', 'border-arrival', 'parcel-counter', 'mall-foodcourt', 'neighborhood-lane', 'urban-village', 'rental-home', 'luxury-home', 'office-floor', 'learning-center', 'planning-museum'];
export function geometryProblems(sample, minimum = 0) {
  const problems = [], r = sample.rect;
  if (![r.left, r.top, r.right, r.bottom].every(Number.isFinite) || r.right <= r.left || r.bottom <= r.top) problems.push('empty or invalid box');
  if (r.right - r.left < minimum || r.bottom - r.top < minimum) problems.push('undersized target');
  for (const c of sample.clips) {
    if (c.x && (r.left < c.left - 1 || r.right > c.right + 1)) problems.push('horizontal clipping');
    if (c.y && (r.top < c.top - 1 || r.bottom > c.bottom + 1)) problems.push('vertical clipping');
  }
  if (sample.hit !== undefined && !sample.hit) problems.push('covered hit point');
  return [...new Set(problems)];
}
/** Plan a real short touch swipe toward the target's vertical center. The
 * 16px allowance matches the observed Chromium touch-start slop; the next DOM
 * sample, never this estimate, decides whether the target is actually visible.
 * @returns {{ direction: 'up' | 'down', distance: number }} */
export function revealSwipe(sample) {
  const vertical = sample.clips.filter(clip => clip.y);
  const top = Math.max(...vertical.map(clip => clip.top)), bottom = Math.min(...vertical.map(clip => clip.bottom));
  const height = sample.rect.bottom - sample.rect.top, available = bottom - top;
  if (![top, bottom, height].every(Number.isFinite) || height <= 0 || available <= 0 || height > available + 1) throw new RangeError('The whole reading target must fit the real scroll viewport.');
  const offset = (sample.rect.top + sample.rect.bottom - top - bottom) / 2;
  return { direction: offset > 0 ? 'up' : 'down', distance: Math.min(available * .55, Math.max(20, Math.abs(offset) + 16)) };
}
export function inputProblems(events, nativeSelectExceptions) {
  const problems = [];
  if (events.filter(e => e.type === 'pointerdown' && e.pointerType === 'touch' && e.trusted).length < 40) problems.push('insufficient trusted touch presses');
  if (events.some(e => e.type.startsWith('pointer') && e.pointerType !== 'touch')) problems.push('non-touch pointer');
  if (events.some(e => e.type === 'keydown')) problems.push('keyboard input');
  if (nativeSelectExceptions !== 1) problems.push('native select exception count');
  const synthetic = events.filter(e => !e.trusted);
  if (synthetic.length !== 2 || synthetic.some(e => !['input', 'change'].includes(e.type) || e.label !== 'Activity to adjust' || e.tag !== 'SELECT')) problems.push('unexpected untrusted events');
  return problems;
}
export function completionProblems(report) {
  const problems = [];
  if (!/^[a-f0-9]{40}$/.test(report.commit ?? '')) problems.push('missing exact commit');
  if (JSON.stringify(report.scenes) !== JSON.stringify(PHONE_SCENES)) problems.push('incomplete ordered world');
  if (!Number.isFinite(report.durationMs) || report.durationMs < 300000 || report.durationMs > 480000) problems.push('outside five to eight minute duration');
  if (report.doors?.length !== 11 || report.doors[0]?.kind !== 'nearby-enter' || report.doors.slice(1).some(d => d.kind !== 'visible-door')) problems.push('physical route incomplete');
  for (const checkpoint of ['home-taken', 'parcel-delivery-taken', 'lease-b-taken', 'office-complete', 'museum-evidence', 'carried-home-plan']) if (!report.checkpoints?.includes(checkpoint)) problems.push(`missing ${checkpoint}`);
  if (report.mapNavigationCount !== 0) problems.push('map used for navigation');
  return problems;
}

export function finalRecordingComplete(state) {
  return state.routeCompleted === true && state.videoSaved === true && Number.isSafeInteger(state.videoBytes) && state.videoBytes > 0
    && Array.isArray(state.cleanupErrors) && state.cleanupErrors.length === 0 && state.activeStorage != null && state.durableStorage != null;
}
