#!/usr/bin/env node
/**
 * Truncates large command params in CommandRegistry debug logs (e.g. touch contents).
 * Re-run after npm install when node_modules is recreated.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcPath = path.join(
  root,
  'node_modules/@eclipse-docks/core/src/core/commandregistry.ts',
);
const distPath = path.join(
  root,
  'node_modules/@eclipse-docks/core/dist/widget-DUR6wxME.js',
);

const SRC_MARKER = 'formatCommandParamsForLog';
const DIST_MARKER = 'formatCommandParamsForLog';

function patchSrc() {
  if (!fs.existsSync(srcPath)) return false;
  let source = fs.readFileSync(srcPath, 'utf8');
  if (source.includes(SRC_MARKER)) return false;

  source = source.replace(
    `function formatCommandResultForLog(value: unknown): string {
    if (value === undefined) {
        return "undefined";
    }
    if (value === null) {
        return "null";
    }
    if (typeof value === "string") {
        return value.length > 300 ? \`\${value.slice(0, 300)}…\` : value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    try {
        const s = JSON.stringify(value);
        return s.length > 300 ? \`\${s.slice(0, 300)}…\` : s;
    } catch {
        return String(value);
    }
}`,
    `function formatCommandResultForLog(value: unknown): string {
    if (value === undefined) {
        return "undefined";
    }
    if (value === null) {
        return "null";
    }
    if (typeof value === "string") {
        return value.length > 300 ? \`\${value.slice(0, 300)}…\` : value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    try {
        const s = JSON.stringify(value);
        return s.length > 300 ? \`\${s.slice(0, 300)}…\` : s;
    } catch {
        return String(value);
    }
}

function sanitizeCommandValueForLog(value: unknown, depth = 0): unknown {
    if (depth > 4) {
        return "…";
    }
    if (value === null || value === undefined) {
        return value;
    }
    if (typeof value === "string") {
        return value.length > 120
            ? \`\${value.slice(0, 120)}… (\${value.length} chars)\`
            : value;
    }
    if (typeof value !== "object") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.slice(0, 10).map((entry) => sanitizeCommandValueForLog(entry, depth + 1));
    }
    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        sanitized[key] = sanitizeCommandValueForLog(entry, depth + 1);
    }
    return sanitized;
}

function formatCommandParamsForLog(params: ExecuteParams | undefined): string {
    if (!params) {
        return "";
    }
    try {
        const s = JSON.stringify(sanitizeCommandValueForLog(params));
        return s.length > 500 ? \`\${s.slice(0, 500)}…\` : s;
    } catch {
        return "[unserializable params]";
    }
}`,
  );
  source = source.replace(
    'const paramsStr = context.params ? ` params: ${JSON.stringify(context.params)}` : \'\';',
    'const paramsStr = context.params ? ` params: ${formatCommandParamsForLog(context.params)}` : \'\';',
  );
  fs.writeFileSync(srcPath, source);
  return true;
}

function patchDist() {
  if (!fs.existsSync(distPath)) return false;
  let dist = fs.readFileSync(distPath, 'utf8');
  if (dist.includes(DIST_MARKER)) return false;

  dist = dist.replace(
    `function formatCommandResultForLog(value) {
	if (value === void 0) return "undefined";
	if (value === null) return "null";
	if (typeof value === "string") return value.length > 300 ? \`\${value.slice(0, 300)}…\` : value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	try {
		const s = JSON.stringify(value);
		return s.length > 300 ? \`\${s.slice(0, 300)}…\` : s;
	} catch {
		return String(value);
	}
}
var CommandStack = class {`,
    `function formatCommandResultForLog(value) {
	if (value === void 0) return "undefined";
	if (value === null) return "null";
	if (typeof value === "string") return value.length > 300 ? \`\${value.slice(0, 300)}…\` : value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	try {
		const s = JSON.stringify(value);
		return s.length > 300 ? \`\${s.slice(0, 300)}…\` : s;
	} catch {
		return String(value);
	}
}
function sanitizeCommandValueForLog(value, depth = 0) {
	if (depth > 4) return "…";
	if (value === null || value === void 0) return value;
	if (typeof value === "string") return value.length > 120 ? \`\${value.slice(0, 120)}… (\${value.length} chars)\` : value;
	if (typeof value !== "object") return value;
	if (Array.isArray(value)) return value.slice(0, 10).map((entry) => sanitizeCommandValueForLog(entry, depth + 1));
	const sanitized = {};
	for (const [key, entry] of Object.entries(value)) sanitized[key] = sanitizeCommandValueForLog(entry, depth + 1);
	return sanitized;
}
function formatCommandParamsForLog(params) {
	if (!params) return "";
	try {
		const s = JSON.stringify(sanitizeCommandValueForLog(params));
		return s.length > 500 ? \`\${s.slice(0, 500)}…\` : s;
	} catch {
		return "[unserializable params]";
	}
}
var CommandStack = class {`,
  );
  dist = dist.replace(
    'const paramsStr = context.params ? ` params: ${JSON.stringify(context.params)}` : "";',
    'const paramsStr = context.params ? ` params: ${formatCommandParamsForLog(context.params)}` : "";',
  );
  fs.writeFileSync(distPath, dist);
  return true;
}

const patchedSrc = patchSrc();
const patchedDist = patchDist();
if (patchedSrc || patchedDist) {
  console.log('patch-docks-command-log: applied');
} else {
  console.log('patch-docks-command-log: already applied or @eclipse-docks/core missing');
}
