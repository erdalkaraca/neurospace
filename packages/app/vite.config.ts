import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type UserConfig } from 'vite';
import { resolveDepVersionsPlugin } from '@eclipse-lyra/core/vite-plugin-resolve-deps';
import { localAliasesPlugin } from '@eclipse-lyra/core/vite-plugin-local-aliases';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig((): UserConfig => {
  return {
    root: __dirname,
    base: process.env.VITE_BASE_PATH || '/',
    plugins: [
      resolveDepVersionsPlugin(),
      localAliasesPlugin({
        packagesRoot: path.resolve(__dirname, '..'),
        useSrcInDev: true,
        patterns: [{ folderPrefix: 'extension-' }],
      }),
    ],
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
    optimizeDeps: {
      include: ['@eclipse-lyra/core'],
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
  };
});
