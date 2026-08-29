import { Directory, File as DocksFile } from '@eclipse-docks/core';

import { logTiming } from './ancpbids-timing';

export async function collectDatasetPaths(root: Directory): Promise<string[]> {
  const started = performance.now();
  const paths: string[] = [];
  let dirCount = 0;
  let fileCount = 0;
  let listCalls = 0;

  const walk = async (dir: Directory, prefix: string): Promise<void> => {
    listCalls += 1;
    const listStarted = performance.now();
    const children = await dir.listChildren(false);
    const listMs = Math.round(performance.now() - listStarted);
    if (listMs >= 250) {
      const label = prefix || dir.getName() || '/';
      console.log(`[ancpBIDS] slow listChildren: ${listMs}ms at ${label} (${children.length} entries)`);
    }
    for (const child of children) {
      if (child instanceof Directory) {
        dirCount += 1;
        const nextPrefix = prefix ? `${prefix}/${child.getName()}` : child.getName();
        await walk(child, nextPrefix);
        continue;
      }
      if (child instanceof DocksFile) {
        fileCount += 1;
        const relPath = prefix ? `${prefix}/${child.getName()}` : child.getName();
        paths.push(relPath);
      }
    }
  };

  await walk(root, '');
  logTiming(
    'collectDatasetPaths',
    Math.round(performance.now() - started),
    `${paths.length} paths, ${dirCount} dirs, ${fileCount} files, ${listCalls} listChildren calls`,
  );
  return paths;
}
