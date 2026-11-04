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
    beginHumanTrial();
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

function ensureView(state: ExpWindowState): { panel: ExpPanel; stage: HTMLElement } {
  const existing = views.get(state.title);
  if (existing) return existing;

  const panel = document.createElement('ns-exp-window') as ExpPanel;
  panel.label = state.title;
  panel.width = state.width;
  panel.height = state.height;
  panel.place(state.x, state.y);
  panel.addEventListener('exp-close', onExpHide);
  const stage = document.createElement('div');
  panel.append(stage);
  document.body.append(panel);
  ensureKeyListener();
  const view = { panel, stage };
  views.set(state.title, view);
  return view;
}

function paintExpWindows(windows: ReadonlyMap<string, ExpWindowState>): void {
  for (const [title, view] of views) {
    if (windows.has(title)) continue;
    view.panel.dataset.expClosing = '1';
    view.panel.remove();
    views.delete(title);
  }

  for (const state of windows.values()) {
    const view = ensureView(state);
    view.panel.label = state.title;
    view.panel.width = state.width;
    view.panel.height = state.height;
    view.stage.style.width = `${state.width}px`;
    view.stage.style.height = `${state.height}px`;
    view.stage.innerHTML = stageMarkup(state);
  }
}

/** Draw the current experiment windows. Safe to call after each mailbox reply. */
export function renderExpWindows(windows: ReadonlyMap<string, ExpWindowState>): void {
  if (typeof document === 'undefined') return;
  void import('./ns-exp-window').then(() => paintExpWindows(windows));
}

const expWindows = new Map<string, ExpWindowState>();
const pendingKeys: string[] = [];
let waiting = false;
let dismissed = false;
let notifyKey: (() => void) | null = null;
let listening = false;

function beginHumanTrial(): void {
  dismissed = false;
  pendingKeys.length = 0;
}

/** Queue a key while `process_events` is waiting. Focus does not have to be in the dialog. */
export function queueHumanKey(key: string): void {
  if (!waiting || !key) return;
  pendingKeys.push(key);
  const notify = notifyKey;
  notifyKey = null;
  notify?.();
}

/** The person closed the experiment dialog. The next wait ends even if it already started. */
export function noteHumanDismiss(): void {
  dismissed = true;
  queueHumanKey('escape');
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

function consumeDismiss(): string[] | null {
  if (!dismissed) return null;
  dismissed = false;
  pendingKeys.length = 0;
  return ['escape'];
}

/** Wait until the person presses a key, closes the window, or the timeout elapses. */
export function waitForHumanKeys(timeoutMs: number): Promise<string[]> {
  const closed = consumeDismiss();
  if (closed) return Promise.resolve(closed);
  const ready = pendingKeys.splice(0);
  if (ready.length) return Promise.resolve(ready);
  waiting = true;
  return new Promise((resolve) => {
    const finish = () => {
      if (timer) clearTimeout(timer);
      notifyKey = null;
      waiting = false;
      resolve(consumeDismiss() ?? pendingKeys.splice(0));
    };
    const timer = timeoutMs > 0 ? setTimeout(finish, timeoutMs) : undefined;
    notifyKey = finish;
  });
}

function onExpKeyDown(event: KeyboardEvent): void {
  if (!waiting) return;
  const key = actrKeyFromEvent(event);
  if (!key) return;
  event.preventDefault();
  event.stopPropagation();
  queueHumanKey(key);
}

function onExpHide(event: Event): void {
  const panel = event.currentTarget;
  if (!(panel instanceof HTMLElement) || panel.dataset.expClosing) return;
  panel.dataset.expClosing = '1';
  noteHumanDismiss();
  panel.remove();
  for (const [title, view] of views) {
    if (view.panel === panel) views.delete(title);
  }
}

function ensureKeyListener(): void {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  document.addEventListener('keydown', onExpKeyDown, true);
}

export function showExpWindowMessages(messages: readonly unknown[] | undefined): void {
  if (!messages?.length) return;
  reduceExpWindows(expWindows, messages);
  renderExpWindows(expWindows);
}
