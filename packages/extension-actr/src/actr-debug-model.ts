/** Pure step-session state: production ranges, bindings, and hover text. */

export type BufferSlots = Record<string, string | number>;

export type StepBuffers = Record<string, BufferSlots | null>;

export type StepSnapshot = {
  time: number | null;
  module: string | null;
  details: string | null;
  done: boolean;
  buffers: StepBuffers;
};

export type DebugView = {
  production: string | null;
  /** True after PRODUCTION-FIRED, until the next conflict resolution. */
  fired: boolean;
  /**
   * True once a later event has written the right-hand side into the buffers.
   * PRODUCTION-FIRED itself only schedules those writes.
   */
  rhsApplied: boolean;
  bindings: Record<string, string>;
  buffers: StepBuffers;
};

export type SourceRange = {
  start: number;
  end: number;
};

type SlotPair = {
  modifier: string | null;
  slot: string;
  value: string;
  slotStart: number;
  slotEnd: number;
  valueStart: number;
  valueEnd: number;
};

type Clause = {
  kind: '=' | '+' | '-' | '?';
  buffer: string;
  actionStart: number;
  actionEnd: number;
  pairs: SlotPair[];
};

type ProductionParts = {
  start: number;
  end: number;
  lhs: Clause[];
  rhs: Clause[];
};

type Token = {
  text: string;
  start: number;
  end: number;
};

const EMPTY_VIEW: DebugView = {
  production: null,
  fired: false,
  rhsApplied: false,
  bindings: {},
  buffers: {},
};

export function parseDebugSnapshot(value: unknown): StepSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('debug-step returned no snapshot');
  }
  const record = value as Record<string, unknown>;
  const time = record.time;
  const moduleName = record.module;
  const details = record.details;
  return {
    time: typeof time === 'number' ? time : null,
    module: typeof moduleName === 'string' ? moduleName : null,
    details: typeof details === 'string' ? details : null,
    done: record.done === true,
    buffers: parseBuffers(record.buffers),
  };
}

function parseBuffers(value: unknown): StepBuffers {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const buffers: StepBuffers = {};
  for (const [name, slots] of Object.entries(value as Record<string, unknown>)) {
    if (slots == null) {
      buffers[name.toLowerCase()] = null;
      continue;
    }
    if (typeof slots !== 'object' || Array.isArray(slots)) continue;
    const parsed: BufferSlots = {};
    for (const [slot, slotValue] of Object.entries(slots as Record<string, unknown>)) {
      if (typeof slotValue === 'string' || typeof slotValue === 'number') {
        parsed[slot.toLowerCase()] = slotValue;
      }
    }
    buffers[name.toLowerCase()] = parsed;
  }
  return buffers;
}

/** Trace event heads Step can halt on (first token of the details column). */
export const DEBUG_HALT_EVENTS = [
  {
    id: 'PRODUCTION-SELECTED',
    label: 'Production selected',
    description: 'A matching production was chosen to fire',
  },
  {
    id: 'PRODUCTION-FIRED',
    label: 'Production fired',
    description: 'The selected production begins its actions',
  },
  {
    id: 'CONFLICT-RESOLUTION',
    label: 'Conflict resolution',
    description: 'Productions are matched against the buffers',
  },
  {
    id: 'SET-BUFFER-CHUNK',
    label: 'Set buffer chunk',
    description: 'A chunk is placed into a buffer',
  },
  {
    id: 'MOD-BUFFER-CHUNK',
    label: 'Mod buffer chunk',
    description: 'Slots of a buffer chunk are updated',
  },
  {
    id: 'CLEAR-BUFFER',
    label: 'Clear buffer',
    description: 'A buffer is emptied',
  },
  {
    id: 'MODULE-REQUEST',
    label: 'Module request',
    description: 'A request is sent to a module (e.g. retrieval)',
  },
] as const;

export type DebugHaltEventId = (typeof DEBUG_HALT_EVENTS)[number]['id'];

export const DEFAULT_HALT_EVENTS: ReadonlySet<DebugHaltEventId> = new Set([
  'PRODUCTION-SELECTED',
]);

export function eventDetailHead(snap: StepSnapshot): string | null {
  const details = (snap.details ?? '').trim();
  if (!details) return null;
  return details.split(/\s+/)[0]?.toUpperCase() ?? null;
}

/** True when Step should stop on this snapshot given the selected halt event types. */
export function shouldHaltOnSnapshot(
  snap: StepSnapshot,
  haltOn: ReadonlySet<string>,
): boolean {
  if (haltOn.size === 0) return true;
  const head = eventDetailHead(snap);
  return head != null && haltOn.has(head);
}

export function reduceDebugView(
  prev: DebugView | null,
  snap: StepSnapshot,
  source: string,
): DebugView {
  const details = (snap.details ?? '').trim();
  const head = details.split(/\s+/)[0]?.toUpperCase() ?? '';
  const name = details.split(/\s+/)[1] ?? '';

  if (!details) {
    return {
      ...(prev ?? EMPTY_VIEW),
      buffers: snap.buffers,
    };
  }

  if (head === 'CONFLICT-RESOLUTION') {
    return { ...EMPTY_VIEW, buffers: snap.buffers };
  }

  if (head === 'PRODUCTION-SELECTED' && name) {
    return {
      production: name,
      fired: false,
      rhsApplied: false,
      bindings: bindProduction(source, name, snap.buffers),
      buffers: snap.buffers,
    };
  }

  if (head === 'PRODUCTION-FIRED') {
    const production = name || prev?.production || null;
    return {
      production,
      fired: true,
      rhsApplied: false,
      bindings:
        prev?.bindings ??
        (production ? bindProduction(source, production, snap.buffers) : {}),
      buffers: snap.buffers,
    };
  }

  if (
    prev?.production &&
    prev.fired &&
    (head === 'MOD-BUFFER-CHUNK' ||
      head === 'MODULE-REQUEST' ||
      head === 'CLEAR-BUFFER' ||
      head === 'SET-BUFFER-CHUNK')
  ) {
    return { ...prev, rhsApplied: true, buffers: snap.buffers };
  }

  return { ...(prev ?? EMPTY_VIEW), buffers: snap.buffers };
}

export function findProductionRange(source: string, name: string): SourceRange | null {
  return parseProduction(source, name);
}

export function hoverText(source: string, offset: number, view: DebugView): string | null {
  if (!view.production) return null;
  const production = parseProduction(source, view.production);
  if (!production || offset < production.start || offset >= production.end) return null;

  const tokens = tokenize(source, production.start, production.end);
  const token = tokenAt(tokens, offset);
  if (!token) return null;
  if (isVariable(token.text)) {
    const bound = view.bindings[token.text.toLowerCase()];
    return bound == null ? null : slotLine(token.text, bound);
  }

  const clauses = [...production.lhs, ...production.rhs];
  const clause = clauseAt(clauses, token);
  if (!clause) return null;
  const onRhs = production.rhs.includes(clause);

  if (isBufferAction(token.text)) {
    return formatBufferAction(clause, view, onRhs);
  }

  const pair = clause.pairs.find((item) => item.slotStart === token.start || item.valueStart === token.start);
  if (!pair || !isBufferSlot(pair)) return null;

  if (pair.valueStart === token.start) return isNil(pair.value) ? absentLine(pair.slot) : null;

  if (clause.kind === '+') return formatWritten(pair, view.bindings);
  if (clause.kind === '=' && onRhs && !view.rhsApplied) return formatWritten(pair, view.bindings);
  if (clause.kind === '=') return formatSlot(clause.buffer, pair.slot, view.buffers[clause.buffer] ?? null);
  return null;
}

function bindProduction(source: string, name: string, buffers: StepBuffers): Record<string, string> {
  const production = parseProduction(source, name);
  if (!production) return {};
  const bindings: Record<string, string> = {};
  for (const clause of production.lhs) {
    if (clause.kind !== '=') continue;
    const slots = buffers[clause.buffer];
    if (!slots) continue;
    for (const pair of clause.pairs) {
      if (pair.modifier === '-' || !isBufferSlot(pair) || !isVariable(pair.value)) continue;
      const slotValue = lookupSlot(slots, pair.slot);
      if (slotValue == null) continue;
      bindings[pair.value.toLowerCase()] = String(slotValue);
    }
  }
  return bindings;
}

function parseProduction(source: string, name: string): ProductionParts | null {
  const target = name.toLowerCase();
  let i = 0;
  while (i < source.length) {
    const skipped = skipTrivia(source, i);
    if (skipped == null) return null;
    i = skipped;
    if (i >= source.length) return null;
    if (source[i] !== '(') {
      i += 1;
      continue;
    }
    const start = i;
    const end = matchingParen(source, start);
    if (end < 0) return null;
    const head = readSymbol(source, skipTrivia(source, start + 1) ?? start + 1);
    const nameToken =
      head && head.text.toLowerCase() === 'p'
        ? readSymbol(source, skipTrivia(source, head.end) ?? head.end)
        : null;
    if (nameToken && nameToken.text.toLowerCase() === target) {
      return {
        start,
        end,
        ...splitClauses(tokenize(source, start, end)),
      };
    }
    i = start + 1;
  }
  return null;
}

function splitClauses(tokens: Token[]): { lhs: Clause[]; rhs: Clause[] } {
  const lhs: Clause[] = [];
  const rhs: Clause[] = [];
  let side: Clause[] = lhs;
  let clause: Clause | null = null;

  const push = () => {
    if (!clause) return;
    side.push(clause);
    clause = null;
  };

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (!token) break;
    if (token.text === '==>') {
      push();
      side = rhs;
      i += 1;
      continue;
    }
    if (isBufferAction(token.text)) {
      push();
      clause = {
        kind: token.text[0] as Clause['kind'],
        buffer: token.text.slice(1, -1).trim().toLowerCase(),
        actionStart: token.start,
        actionEnd: token.end,
        pairs: [],
      };
      i += 1;
      continue;
    }
    if (!clause || token.text.startsWith('!')) {
      i += 1;
      continue;
    }
    let modifier: string | null = null;
    if (isSlotModifier(token.text) && tokens[i + 1] && tokens[i + 2]) {
      modifier = token.text;
      i += 1;
    }
    const slot = tokens[i];
    const value = tokens[i + 1];
    if (!slot || !value || isBufferAction(slot.text) || slot.text === '==>') break;
    clause.pairs.push({
      modifier,
      slot: slot.text,
      value: value.text,
      slotStart: slot.start,
      slotEnd: slot.end,
      valueStart: value.start,
      valueEnd: value.end,
    });
    i += 2;
  }
  push();
  return { lhs, rhs };
}

function tokenize(source: string, start: number, end: number): Token[] {
  const tokens: Token[] = [];
  let i = start;
  while (i < end) {
    const skipped = skipTrivia(source, i);
    if (skipped == null || skipped >= end) break;
    i = skipped;
    if (source[i] === '(' || source[i] === ')') {
      i += 1;
      continue;
    }
    const symbol = readSymbol(source, i);
    if (!symbol || symbol.end > end) break;
    tokens.push(symbol);
    i = symbol.end;
  }
  return tokens;
}

function clauseAt(clauses: Clause[], token: Token): Clause | null {
  let current: Clause | null = null;
  for (const clause of clauses) {
    if (token.start >= clause.actionStart) current = clause;
  }
  return current;
}

function formatBufferAction(clause: Clause, view: DebugView, onRhs: boolean): string | null {
  if (clause.kind === '+') {
    return block(`${clause.buffer} request`, clause.pairs.map((pair) => formatWritten(pair, view.bindings)));
  }
  if (clause.kind === '-') return `${clause.buffer} cleared`;
  if (clause.kind === '?') return null;
  if (onRhs && !view.rhsApplied) {
    return block(clause.buffer, clause.pairs.filter(isBufferSlot).map((pair) => formatWritten(pair, view.bindings)));
  }
  return formatChunk(clause.buffer, view.buffers[clause.buffer] ?? null);
}

function formatChunk(buffer: string, slots: BufferSlots | null): string {
  const lines = Object.entries(slots ?? {}).map(([slot, value]) => slotLine(slot, value));
  return lines.length === 0 ? `${buffer} is empty` : block(buffer, lines);
}

function formatSlot(buffer: string, slot: string, slots: BufferSlots | null): string {
  if (!slots) return `${buffer} is empty`;
  const value = lookupSlot(slots, slot);
  return value == null ? absentLine(slot) : slotLine(slot, value);
}

function formatWritten(pair: SlotPair, bindings: Record<string, string>): string {
  if (isNil(pair.value)) return absentLine(pair.slot);
  const value = isVariable(pair.value) ? bindings[pair.value.toLowerCase()] ?? pair.value : pair.value;
  return slotLine(pair.slot, value);
}

function block(title: string, lines: string[]): string {
  return [title, ...lines].join('\n');
}

function slotLine(slot: string, value: string | number): string {
  return `${slot} = ${value}`;
}

function absentLine(slot: string): string {
  return `${slot} is absent`;
}

function isBufferSlot(pair: SlotPair): boolean {
  return pair.slot.toLowerCase() !== 'isa' && !pair.slot.startsWith('!');
}

function isNil(value: string): boolean {
  return value.toLowerCase() === 'nil';
}

function lookupSlot(slots: BufferSlots, slot: string): string | number | undefined {
  const key = Object.keys(slots).find((name) => name.toLowerCase() === slot.toLowerCase());
  return key == null ? undefined : slots[key];
}

/** Includes the token end so a caret just after the last character still hits the token. */
function tokenAt(tokens: Token[], offset: number): Token | null {
  return tokens.find((item) => offset >= item.start && offset <= item.end) ?? null;
}

function isVariable(text: string): boolean {
  return /^=[A-Za-z][\w-]*$/.test(text);
}

function isBufferAction(text: string): boolean {
  return /^[+\-=?][A-Za-z][\w-]*\s*>$/.test(text);
}

function isSlotModifier(text: string): boolean {
  return text === '-' || text === '<' || text === '>' || text === '<=' || text === '>=';
}

function readSymbol(source: string, index: number): Token | null {
  if (index >= source.length || /[\s()"]/.test(source[index] ?? '')) return null;
  let end = index + 1;
  while (end < source.length && !/[\s()"]/.test(source[end] ?? '')) end += 1;
  return { text: source.slice(index, end), start: index, end };
}

function matchingParen(source: string, open: number): number {
  let depth = 0;
  let i = open;
  while (i < source.length) {
    const skipped = skipStringOrComment(source, i);
    if (skipped == null) return -1;
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    const ch = source[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
    i += 1;
  }
  return -1;
}

/** Returns the next code index, or null when an unterminated string or comment ends the scan. */
function skipTrivia(source: string, index: number): number | null {
  let i = index;
  while (i < source.length) {
    if (/\s/.test(source[i] ?? '')) {
      i += 1;
      continue;
    }
    const skipped = skipStringOrComment(source, i);
    if (skipped == null) return null;
    if (skipped === i) return i;
    i = skipped;
  }
  return i;
}

/** Returns the index after a string or comment starting at index, index itself if none starts there, or null if unterminated. */
function skipStringOrComment(source: string, index: number): number | null {
  const ch = source[index];
  if (ch === ';') {
    const newline = source.indexOf('\n', index);
    return newline < 0 ? source.length : newline;
  }
  if (ch === '#' && source[index + 1] === '|') {
    const close = source.indexOf('|#', index + 2);
    return close < 0 ? null : close + 2;
  }
  if (ch !== '"') return index;
  let i = index + 1;
  while (i < source.length && source[i] !== '"') {
    if (source[i] === '\\') i += 1;
    i += 1;
  }
  return i >= source.length ? null : i + 1;
}
