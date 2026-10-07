/** Offline export installs only this new namespace; legacy namespaces are untouched. */
export function worldAsset(source: string): string {
  const embedded = (globalThis as typeof globalThis & { __CROSSING_WORLD_ASSETS__?: Record<string, string> }).__CROSSING_WORLD_ASSETS__;
  return embedded?.[source] ?? `${import.meta.env.BASE_URL}${source}`;
}
export function decodeImage(source: string, signal: AbortSignal): Promise<'ready' | 'fallback'> {
  return new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const finish = (status: 'ready' | 'fallback') => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.onload = null; image.onerror = null;
      signal.removeEventListener('abort', abort);
      resolve(status);
    };
    const abort = () => finish('fallback');
    const timeout = window.setTimeout(() => finish('fallback'), 8000);
    signal.addEventListener('abort', abort, { once: true });
    image.onerror = () => finish('fallback');
    image.onload = () => { image.decode().then(() => finish('ready'), () => finish('fallback')); };
    if (signal.aborted) { abort(); return; }
    image.src = worldAsset(source);
  });
}
