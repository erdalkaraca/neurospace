#!/usr/bin/env node
import { createWriteStream, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..');
const contentRoot = join(packageRoot, 'content');
const tutorialRoot = join(contentRoot, 'tutorial');
const zipPath = join(contentRoot, 'units.zip');
const sourceUrl = 'https://act-r.psy.cmu.edu/actr7.x/units.zip';

const UNIT_LABELS = {
  unit1: 'Unit 1: Introduction',
  unit2: 'Unit 2: Cognition',
  unit3: 'Unit 3: Perception and Motor',
  unit4: 'Unit 4: Memory',
  unit5: 'Unit 5: Procedural',
  unit6: 'Unit 6: Vision',
  unit7: 'Unit 7: Motor',
  unit8: 'Unit 8: Communication',
  lisp: 'Lisp experiment tasks',
  python: 'Python experiment tasks',
};

const MODEL_EXTENSIONS = new Set(['.lisp', '.py', '.txt', '.md']);

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error(`No response body for ${url}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
}

function listFiles(dir, baseDir = dir) {
  const entries = [];
  for (const entry of execFileSync('find', [dir, '-type', 'f'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)) {
    const rel = relative(baseDir, entry);
    entries.push(rel);
  }
  return entries.sort();
}

function labelForFile(filename) {
  const base = filename.split('/').pop() ?? filename;
  return base.replace(/\.(lisp|py|txt|md)$/i, '').replace(/[-_]/g, ' ');
}

function iconForFile(filename) {
  if (filename.endsWith('.lisp')) return 'code';
  if (filename.endsWith('.py')) return 'python';
  if (filename.endsWith('.txt') || filename.endsWith('.md')) return 'book';
  return 'file';
}

function buildManifest(files) {
  const units = new Map();

  for (const file of files) {
    const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
    if (!MODEL_EXTENSIONS.has(ext)) continue;

    const parts = file.split('/');
    const unitKey = parts.find((part) => /^unit\d+$/i.test(part)) ?? parts[0] ?? 'misc';
    const catalogFilename = file;

    if (!units.has(unitKey)) {
      units.set(unitKey, []);
    }

    units.get(unitKey).push({
      label: labelForFile(file),
      filename: catalogFilename,
      importPath: `../content/tutorial/${file}`,
      icon: iconForFile(file),
    });
  }

  return {
    actrVersion: 'actr7.x',
    sourceUrl,
    fetchedAt: new Date().toISOString(),
    units: [...units.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([id, items]) => ({
        id,
        label: UNIT_LABELS[id] ?? id,
        items: items.sort((a, b) => a.filename.localeCompare(b.filename)),
      })),
  };
}

mkdirSync(contentRoot, { recursive: true });
rmSync(tutorialRoot, { recursive: true, force: true });

console.log(`Downloading ${sourceUrl} ...`);
await download(sourceUrl, zipPath);

console.log('Extracting ACT-R Tutorial/ ...');
execFileSync('unzip', ['-q', zipPath, 'ACT-R Tutorial/*', '-d', contentRoot], { stdio: 'inherit' });
execFileSync('mv', [join(contentRoot, 'ACT-R Tutorial'), tutorialRoot], { stdio: 'inherit' });

const files = listFiles(tutorialRoot);
const manifest = buildManifest(files);
writeFileSync(join(contentRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

rmSync(zipPath, { force: true });

console.log(`Fetched ${files.length} tutorial files across ${manifest.units.length} units.`);
