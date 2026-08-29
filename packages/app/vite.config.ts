import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { createDocksPwaPlugin } from '@eclipse-docks/extension-pwa/vite';
import crossOriginIsolation from 'vite-plugin-cross-origin-isolation';
import mkcert from 'vite-plugin-mkcert';
import { appSplashPlugin } from '@eclipse-docks/core/vite-plugin-app-splash';
import { resolveDepVersionsPlugin } from '@eclipse-docks/core/vite-plugin-resolve-deps';
import { localAliasesPlugin } from '@eclipse-docks/core/vite-plugin-local-aliases';

const __dirname = dirname(fileURLToPath(import.meta.url));
const basePath = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  root: __dirname,
  base: basePath,
  resolve: {
    alias: {
      '@jsr/libs__xml': path.resolve(
        __dirname,
        '../extension-bids-validator/src/xml-stub.ts',
      ),
      'supports-hyperlinks': path.resolve(
        __dirname,
        '../extension-bids-validator/src/supports-hyperlinks-stub.ts',
      ),
    },
  },
  server: {
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
  plugins: [
    appSplashPlugin({ logo: { src: '/logo.svg' } }),
    resolveDepVersionsPlugin(),
    localAliasesPlugin({
      packagesRoot: path.resolve(__dirname, '..'),
      alwaysUseSrc: true,
      patterns: [{ folderPrefix: 'extension-' }],
    }),
    mkcert(),
    crossOriginIsolation(),
    createDocksPwaPlugin({
      basePath,
      appName: 'neuro!space',
      appDescription: 'Scientific Platform for Hybrid Cognitive Architectures',
      maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
    }),
  ],
  worker: {
    format: 'es',
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    assetsInlineLimit: 0,
    rolldownOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
});
