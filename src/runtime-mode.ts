/** This flag is a page-local mode, never a saved preference or personal context. */
export const TEMPORARY_DEMO_PARAMETER = 'temporary-demo';
export const TEMPORARY_DEMO_LABEL = 'Temporary demo · changes won’t be saved';
export const TEMPORARY_DEMO_GUIDANCE = 'Close this tab when you’re done. Reloading starts over.';

export function isTemporaryDemo(search: string): boolean {
  const values = new URLSearchParams(search).getAll(TEMPORARY_DEMO_PARAMETER);
  return values.length === 1 && values[0] === '1';
}

/** Preserve only this app's origin/path, including portable file:// documents. */
export function buildTemporaryDemoUrl(currentHref: string): string {
  const url = new URL(currentHref);
  if (!['http:', 'https:', 'file:'].includes(url.protocol)) throw new TypeError('Unsupported app URL');
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  url.searchParams.set(TEMPORARY_DEMO_PARAMETER, '1');
  return url.href;
}

// Capture once, before either storage initializer runs. Changing modes requires
// a new page, so one tab's in-memory story and planner cannot become another's.
export const temporaryDemo = isTemporaryDemo(typeof window === 'undefined' ? '' : window.location.search);
