export type ExpItem =
  | { kind: 'text'; name: string; x: number; y: number; text: string; color: string; size: number }
  | { kind: 'button'; name: string; x: number; y: number; width: number; height: number; text: string; color: string }
  | { kind: 'line'; name: string; x1: number; y1: number; x2: number; y2: number; color: string };

export type ExpMarker = { x: number; y: number; color: string };

export type ExpWindowState = {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  items: ExpItem[];
  attention?: ExpMarker;
  cursor?: ExpMarker;
};

type ExpPanel = HTMLElement & {
  label: string;
  width: number;
  height: number;
  place: (x: number, y: number) => void;
};

const views = new Map<string, { panel: ExpPanel; stage: HTMLElement }>();

function viewKey(slot: string, title: string): string {
  return `${slot}\0${title}`;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value);
}

function cssColor(value: unknown): string {
  const color = text(value, 'black');
  return /^[#a-zA-Z0-9(),.%\s-]+$/.test(color) ? color : 'black';
}

function windowFor(windows: Map<string, ExpWindowState>, title: string): ExpWindowState {
  let state = windows.get(title);
  if (!state) {
    state = { title, x: 0, y: 0, width: 300, height: 300, items: [] };
    windows.set(title, state);
  }
  return state;
}

function upsert(state: ExpWindowState, item: ExpItem): void {
  const index = state.items.findIndex((entry) => entry.name === item.name);
  if (index >= 0) state.items[index] = item;
  else state.items.push(item);
}

/** Apply one AGI visible-window message. `check` is answered in Lisp. */
export function reduceExpWindowMessage(windows: Map<string, ExpWindowState>, message: unknown[]): void {
  const kind = text(message[0]);
  if (kind === 'check' || !kind) return;

  if (kind === 'close') {
    windows.delete(text(message[1]));
    return;
  }

  const title = text(message[1], 'Experiment');
  const state = windowFor(windows, title);

  if (kind === 'open') {
    state.x = num(message[2]);
    state.y = num(message[3]);
    state.width = num(message[4], 300);
    state.height = num(message[5], 300);
    state.items = [];
    state.attention = undefined;
    state.cursor = undefined;
    return;
  }
  if (kind === 'remove') {
    const name = text(message[2]);
    state.items = state.items.filter((item) => item.name !== name);
    return;
  }
  if (kind === 'text') {
    upsert(state, {
      kind: 'text',
      name: text(message[2]),
      x: num(message[3]),
      y: num(message[4]),
      text: text(message[5]),
      color: cssColor(message[6]),
      size: num(message[7], 12),
    });
    return;
  }
  if (kind === 'button') {
    upsert(state, {
      kind: 'button',
      name: text(message[2]),
      x: num(message[3]),
      y: num(message[4]),
      width: num(message[5], 75),
      height: num(message[6], 20),
      text: text(message[7]),
      color: cssColor(message[8]),
    });
    return;
  }
  if (kind === 'line') {
    upsert(state, {
      kind: 'line',
      name: text(message[2]),
      x1: num(message[3]),
      y1: num(message[4]),
      x2: num(message[5]),
      y2: num(message[6]),
      color: cssColor(message[7]),
    });
    return;
  }
  if (kind === 'attention') {
    state.attention = {
      x: num(message[3]) - state.x,
      y: num(message[4]) - state.y,
      color: cssColor(message[5]),
    };
    return;
  }
  if (kind === 'clearattention') {
    state.attention = undefined;
    return;
  }
  if (kind === 'cursor') {
    state.cursor = { x: num(message[3]), y: num(message[4]), color: cssColor(message[5]) };
    return;
  }
  if (kind === 'clearcursor') state.cursor = undefined;
}

export function reduceExpWindows(windows: Map<string, ExpWindowState>, messages: readonly unknown[]): void {
  for (const message of messages) {
    if (Array.isArray(message)) reduceExpWindowMessage(windows, message);
  }
}

function marker(point: ExpMarker, label: string): string {
  return `<circle cx="${point.x}" cy="${point.y}" r="6" fill="none" stroke="${point.color}" stroke-width="2"><title>${label}</title></circle>`;
}

function stageMarkup(state: ExpWindowState): string {
  const lines = state.items
    .filter((item) => item.kind === 'line')
    .map(
      (item) =>
        `<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="${item.color}" stroke-width="2"/>`,
    );
  if (state.attention) lines.push(marker(state.attention, 'attention'));
  if (state.cursor) lines.push(marker(state.cursor, 'cursor'));
  const svg = `<svg width="${state.width}" height="${state.height}" style="position:absolute;inset:0;pointer-events:none">${lines.join('')}</svg>`;
  const nodes = state.items
    .filter((item) => item.kind !== 'line')
    .map((item) => {
      if (item.kind === 'text') {
        return `<div style="position:absolute;left:${item.x}px;top:${item.y}px;color:${item.color};font-size:${item.size}px;line-height:1.2">${escapeHtml(item.text)}</div>`;
      }
      return `<button type="button" style="position:absolute;left:${item.x}px;top:${item.y}px;width:${item.width}px;height:${item.height}px;background:${item.color};border:1px solid #666">${escapeHtml(item.text)}</button>`;
    });
  return `${svg}${nodes.join('')}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function ensureView(slot: string, state: ExpWindowState): { panel: ExpPanel; stage: HTMLElement } {
  const existing = views.get(viewKey(slot, state.title));
  if (existing) return existing;

  const panel = document.createElement('ns-exp-window') as ExpPanel;
  panel.label = state.title;
  panel.width = state.width;
  panel.height = state.height;
  panel.dataset.expSlot = slot;
  panel.place(state.x, state.y);
  panel.addEventListener('exp-close', onExpHide);
  const stage = document.createElement('div');
  panel.append(stage);
  document.body.append(panel);
  ensureKeyListener();
  const view = { panel, stage };
  views.set(viewKey(slot, state.title), view);
  return view;
}

function paintExpWindows(slot: string, windows: ReadonlyMap<string, ExpWindowState>): void {
  const prefix = `${slot}\0`;
  for (const [key, view] of views) {
    if (!key.startsWith(prefix)) continue;
    const title = key.slice(prefix.length);
    if (windows.has(title)) continue;
    view.panel.dataset.expClosing = '1';
    view.panel.remove();
    views.delete(key);
  }

  for (const state of windows.values()) {
    const view = ensureView(slot, state);
    view.panel.label = state.title;
    view.panel.width = state.width;
    view.panel.height = state.height;
    view.stage.style.width = `${state.width}px`;
    view.stage.style.height = `${state.height}px`;
    view.stage.innerHTML = stageMarkup(state);
  }
}

function renderExpWindows(slot: string, windows: ReadonlyMap<string, ExpWindowState>): void {
  if (typeof document === 'undefined') return;
  void import('./ns-exp-window').then(() => paintExpWindows(slot, windows));
}

const windowsBySlot = new Map<string, Map<string, ExpWindowState>>();

type SlotInput = {
  keys: string[];
  dismissed: boolean;
  waiting: boolean;
  notify: (() => void) | null;
};

const inputBySlot = new Map<string, SlotInput>();
let listening = false;

function slotInput(slot: string): SlotInput {
  let input = inputBySlot.get(slot);
  if (!input) {
    input = { keys: [], dismissed: false, waiting: false, notify: null };
    inputBySlot.set(slot, input);
  }
  return input;
}

export function beginHumanTrial(slot: string): void {
  const input = slotInput(slot);
  input.dismissed = false;
  input.keys.length = 0;
}

/** Queue a key for one ACT-R process that is waiting in `process_events`. */
export function queueHumanKey(slot: string, key: string): void {
  const input = slotInput(slot);
  if (!input.waiting || !key) return;
  input.keys.push(key);
  const notify = input.notify;
  input.notify = null;
  notify?.();
}

/** The person closed this process's experiment window. */
export function noteHumanDismiss(slot: string): void {
  const input = slotInput(slot);
  input.dismissed = true;
  queueHumanKey(slot, 'escape');
}

/** `evaluate("process-events", ...)` is the human-wait call from `actr.process_events`. */
export function isProcessEvents(method: string, params: readonly unknown[] | undefined): boolean {
  return method === 'evaluate' && params?.[0] === 'process-events';
}

/** ACT-R key name for a browser key, or null when it is not a response key. */
export function actrKeyFromEvent(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>): string | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  if (event.key === ' ') return 'space';
  if (event.key === 'Enter') return 'return';
  if (event.key.length === 1) return event.key.toLowerCase();
  return null;
}

function consumeDismiss(input: SlotInput): string[] | null {
  if (!input.dismissed) return null;
  input.dismissed = false;
  input.keys.length = 0;
  return ['escape'];
}

/** Wait until the person presses a key for this process, closes its window, or the timeout elapses. */
export function waitForHumanKeys(slot: string, timeoutMs: number): Promise<string[]> {
  const input = slotInput(slot);
  const closed = consumeDismiss(input);
  if (closed) return Promise.resolve(closed);
  const ready = input.keys.splice(0);
  if (ready.length) return Promise.resolve(ready);
  input.waiting = true;
  return new Promise((resolve) => {
    const finish = () => {
      if (timer) clearTimeout(timer);
      input.notify = null;
      input.waiting = false;
      resolve(consumeDismiss(input) ?? input.keys.splice(0));
    };
    const timer = timeoutMs > 0 ? setTimeout(finish, timeoutMs) : undefined;
    input.notify = finish;
  });
}

function waitingSlots(): string[] {
  return [...inputBySlot.entries()].filter(([, input]) => input.waiting).map(([slot]) => slot);
}

function slotFromEvent(event: Event): string | null {
  for (const node of event.composedPath()) {
    if (node instanceof HTMLElement && node.dataset.expSlot) return node.dataset.expSlot;
  }
  const waiting = waitingSlots();
  return waiting.length === 1 ? waiting[0] : null;
}

function onExpKeyDown(event: KeyboardEvent): void {
  const slot = slotFromEvent(event);
  if (!slot) return;
  const key = actrKeyFromEvent(event);
  if (!key) return;
  event.preventDefault();
  event.stopPropagation();
  queueHumanKey(slot, key);
}

function onExpHide(event: Event): void {
  const panel = event.currentTarget;
  if (!(panel instanceof HTMLElement) || panel.dataset.expClosing) return;
  const slot = panel.dataset.expSlot;
  panel.dataset.expClosing = '1';
  if (slot) noteHumanDismiss(slot);
  panel.remove();
  for (const [key, view] of views) {
    if (view.panel === panel) views.delete(key);
  }
}

function ensureKeyListener(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('keydown', onExpKeyDown, true);
}

/** Apply one process's window messages without changing any other process's display. */
export function showExpWindowMessages(slot: string, messages: readonly unknown[] | undefined): void {
  if (!slot || !messages?.length) return;
  let windows = windowsBySlot.get(slot);
  if (!windows) {
    windows = new Map();
    windowsBySlot.set(slot, windows);
  }
  if (messages.some((message) => Array.isArray(message) && message[0] === 'open')) {
    beginHumanTrial(slot);
  }
  reduceExpWindows(windows, messages);
  renderExpWindows(slot, windows);
}

export function expWindowsFor(slot: string): ReadonlyMap<string, ExpWindowState> | undefined {
  return windowsBySlot.get(slot);
}
