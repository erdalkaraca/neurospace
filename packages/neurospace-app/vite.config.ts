import { defineConfig } from 'vite';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  base: process.env.VITE_BASE_PATH || '/',
  resolve: {
    alias: {
      '@kispace-io/extension-neuro-viewer': path.resolve(__dirname, '../extension-neuro-viewer/dist/index.js'),
      '@kispace-io/extension-snirf-viewer': path.resolve(__dirname, '../extension-snirf-viewer/dist/index.js'),
      '@kispace-io/extension-openneuro': path.resolve(__dirname, '../extension-openneuro/dist/index.js'),
    },
  },
  optimizeDeps: {
    include: ['@kispace-io/core'],
    exclude: ['@kispace-io/extension-neuro-viewer', '@kispace-io/extension-snirf-viewer', '@kispace-io/extension-openneuro'],
  },
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
});
