import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Diagnostic transport only. Return one already-exported artifact without transforming its bytes. */
export function diagnosticResponse(path, body) {
  const sha256 = createHash('sha256').update(body).digest('hex');
  if (path === '/__diagnostic-ready') return { status: 200, type: 'application/json', body: Buffer.from(JSON.stringify({ bytes: body.length, sha256 })) };
  if (path === '/crossing-lives-world.html') return { status: 200, type: 'text/html; charset=utf-8', body, sha256 };
  return { status: 404, type: 'text/plain; charset=utf-8', body: Buffer.from('Not found') };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const body = await readFile(resolve('artifacts/crossing-lives-world.html'));
  const server = createServer((request, response) => {
    const result = diagnosticResponse(request.url, body);
    response.writeHead(result.status, { 'content-type': result.type, 'content-length': result.body.length, 'cache-control': 'no-store', ...(result.sha256 ? { 'x-diagnostic-source-sha256': result.sha256 } : {}) });
    response.end(result.body);
  });
  server.listen(4183, '127.0.0.1');
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
