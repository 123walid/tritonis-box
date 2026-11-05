import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' keeps dist/ portable (sub-path hosting and file:// inspection)
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      input: {
        installation: resolve(process.cwd(), 'index.html'),
        farm: resolve(process.cwd(), 'farm.html')
      }
    }
  },
});
