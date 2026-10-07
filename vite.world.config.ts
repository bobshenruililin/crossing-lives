import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
/** Independent world entry and public asset boundary. */
export default defineConfig({
  base: './', publicDir: 'public-world',
  build: { target: 'es2022', outDir: 'dist-world', rolldownOptions: { input: fileURLToPath(new URL('./world.html', import.meta.url)) } },
  server: { port: 4175, strictPort: true },
});
