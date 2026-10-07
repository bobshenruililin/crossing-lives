import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// A separate entry preserves the verified original experience. It imports only
// the decision controller/UI and does not initialize legacy personal storage.
export default defineConfig({
  base: './',
  publicDir: 'public-decision',
  build: {
    target: 'es2022',
    outDir: 'dist-decision',
    rolldownOptions: { input: fileURLToPath(new URL('./decision.html', import.meta.url)) },
  },
  server: { port: 4173, strictPort: true },
});
