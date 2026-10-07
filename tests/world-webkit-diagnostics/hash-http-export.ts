import { createHash } from 'node:crypto';
import { get, type IncomingHttpHeaders } from 'node:http';

/** Separate Node transport: never touches a browser context, cookie jar or asset cache. */
export function hashHttpExport(url: string, maximumBytes: number): Promise<{ status: number; headers: IncomingHttpHeaders; bytes: number; sha256: string }> {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) throw new Error('A positive safe response bound is required');
  return new Promise((accept, reject) => {
    const request = get(url, { headers: { 'accept-encoding': 'identity' } }, response => {
      const hash = createHash('sha256'); let bytes = 0;
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maximumBytes) { response.destroy(new Error('HTTP export exceeded its expected byte bound')); return; }
        hash.update(chunk);
      });
      response.on('aborted', () => reject(new Error('HTTP export stream was aborted')));
      response.on('error', reject);
      response.on('end', () => accept({ status: response.statusCode ?? 0, headers: response.headers, bytes, sha256: hash.digest('hex') }));
    });
    request.setTimeout(10_000, () => request.destroy(new Error('HTTP export verification timed out')));
    request.on('error', reject);
  });
}
