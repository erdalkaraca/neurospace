import { createHash } from 'node:crypto';
import { cpSync, createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

import {
  ACTR_CHEERPX_IMAGE_BASENAME,
  ACTR_CHEERPX_IMAGE_DIR,
  actrCheerpXImageBase,
  actrCheerpXUrlPrefix,
} from './actr-cheerpx-image-paths';

export {
  ACTR_CHEERPX_IMAGE_BASENAME,
  ACTR_CHEERPX_IMAGE_DIR,
  actrCheerpXImageBase,
  actrCheerpXUrlPrefix,
} from './actr-cheerpx-image-paths';

type ResolvedImage =
  | { kind: 'flat'; filePath: string }
  | { kind: 'chunk'; filePath: string };

/**
 * Serve cheerpx/dist/ — GitHubDevice chunks in actr-cheerpx/ or flat ext2 fallback.
 */
export function actrCheerpXImagePlugin(distDir: string): Plugin {
  let outDir = '';
  let urlPrefix = actrCheerpXUrlPrefix('/');
  let flatUrlPath = actrCheerpXImageBase('/');
  const chunkDir = path.join(distDir, ACTR_CHEERPX_IMAGE_DIR);
  const flatImagePath = path.join(distDir, ACTR_CHEERPX_IMAGE_BASENAME);

  const securityHeaders = {
    'Cross-Origin-Resource-Policy': 'same-origin',
  };

  function resolveImage(pathname: string): ResolvedImage | 'missing' | undefined {
    if (!pathname.startsWith(urlPrefix)) return undefined;
    const rel = pathname.slice(urlPrefix.length);
    if (!rel.startsWith(ACTR_CHEERPX_IMAGE_BASENAME)) return undefined;

    if (pathname === flatUrlPath && existsSync(flatImagePath)) {
      return { kind: 'flat', filePath: flatImagePath };
    }

    const chunkPath = path.resolve(chunkDir, rel);
    if (chunkPath.startsWith(path.resolve(chunkDir)) && existsSync(chunkPath)) {
      return { kind: 'chunk', filePath: chunkPath };
    }

    return 'missing';
  }

  function cacheHeaders(st: { size: number; mtimeMs: number }) {
    const mtimeMs = Math.floor(st.mtimeMs);
    const etag = `"${createHash('sha1').update(`${st.size}-${mtimeMs}`).digest('hex')}"`;
    return {
      ETag: etag,
      'Last-Modified': new Date(mtimeMs).toUTCString(),
    };
  }

  function chunkHeaders(filePath: string, size: number) {
    const mtimeMs = Math.floor(statSync(filePath).mtimeMs);
    return {
      ...securityHeaders,
      'Last-Modified': new Date(mtimeMs).toUTCString(),
      'Content-Type': filePath.endsWith('.meta') ? 'text/plain' : 'application/octet-stream',
      'Content-Length': size,
    };
  }

  function serveFlat(filePath: string, req: { method?: string; headers: { range?: string } }, res: {
    writeHead: (code: number, headers: Record<string, string | number>) => void;
    end: (body?: string) => void;
    statusCode: number;
  }) {
    const st = statSync(filePath);
    const headers = {
      ...securityHeaders,
      ...cacheHeaders(st),
      'Accept-Ranges': 'bytes',
      'Content-Type': 'application/octet-stream',
    };

    if (req.method === 'HEAD') {
      res.writeHead(200, { ...headers, 'Content-Length': st.size });
      res.end();
      return;
    }

    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) {
        res.writeHead(416, headers);
        res.end();
        return;
      }
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : st.size - 1;
      if (start >= st.size || end >= st.size || start > end) {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${st.size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${st.size}`,
        'Content-Length': end - start + 1,
      });
      createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, { ...headers, 'Content-Length': st.size });
    createReadStream(filePath).pipe(res);
  }

  return {
    name: 'actr-cheerpx-image',
    configResolved(config: ResolvedConfig) {
      outDir = config.build.outDir;
      urlPrefix = actrCheerpXUrlPrefix(config.base);
      flatUrlPath = actrCheerpXImageBase(config.base);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0] ?? '';
        const resolved = resolveImage(pathname);
        if (resolved === undefined) {
          next();
          return;
        }
        if (resolved === 'missing') {
          res.statusCode = 404;
          res.end(`ACT-R CheerpX image missing under ${pathname}`);
          return;
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405;
          res.end();
          return;
        }

        if (resolved.kind === 'flat') {
          serveFlat(resolved.filePath, req, res);
          return;
        }

        const st = statSync(resolved.filePath);
        const headers = chunkHeaders(resolved.filePath, st.size);
        if (req.method === 'HEAD') {
          res.writeHead(200, headers);
          res.end();
          return;
        }
        res.writeHead(200, headers);
        createReadStream(resolved.filePath).pipe(res);
      });
    },
    closeBundle() {
      const destDir = path.join(outDir, ACTR_CHEERPX_IMAGE_DIR);
      if (existsSync(chunkDir)) {
        cpSync(chunkDir, destDir, { recursive: true });
        return;
      }
      if (existsSync(flatImagePath)) {
        mkdirSync(destDir, { recursive: true });
        cpSync(flatImagePath, path.join(destDir, ACTR_CHEERPX_IMAGE_BASENAME));
      }
    },
  };
}

export function defaultActrCheerpXDistDir(fromDir: string): string {
  return path.resolve(fromDir, '../extension-actr/cheerpx/dist');
}

/** @deprecated Use defaultActrCheerpXDistDir */
export function defaultActrCheerpXImageDir(fromDir: string): string {
  return path.join(defaultActrCheerpXDistDir(fromDir), ACTR_CHEERPX_IMAGE_DIR);
}

/** @deprecated Use defaultActrCheerpXDistDir */
export function defaultActrCheerpXImagePath(fromDir: string): string {
  return path.join(defaultActrCheerpXDistDir(fromDir), ACTR_CHEERPX_IMAGE_BASENAME);
}
