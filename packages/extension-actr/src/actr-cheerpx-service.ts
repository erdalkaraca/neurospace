import { createLogger } from '@eclipse-docks/core';

import { createMailboxLogFilter } from './actr-console-filter';
import { actrCheerpXImageBase } from './actr-cheerpx-image-paths';
import { createMailboxClient, type ActrRpcResponse, type MailboxClient } from './mailbox-client';
import { parseDebugSnapshot, type StepSnapshot } from './actr-debug-model';

const log = createLogger('ACT-R');

const CX_URL = 'https://cxrtnc.leaningtech.com/1.1.5/cx.esm.js';
const DEFAULT_IMAGE_BASE = actrCheerpXImageBase(import.meta.env.BASE_URL);
const ROOT_IDB = 'actr-cheerpx-editor-v8';
const IPC_OUT_IDB = 'actr-cheerpx-editor-ipc-out-v8';
/** CheerpX dir mounts need an existing parent; use top-level paths (not /ipc/in). */
const IPC_IN_MOUNT = '/ipc-in';
const IPC_OUT_MOUNT = '/ipc-out';
const MAX_PROCESSES = 4;
const CONSOLE_POLL_MS = 200;

const BASE_ENV = [
  'HOME=/home/user',
  'USER=user',
  'SHELL=/bin/bash',
  'LANG=C.UTF-8',
  'LC_ALL=C',
  'PATH=/opt/ecl/bin:/usr/local/bin:/usr/bin:/bin',
  'LD_LIBRARY_PATH=/opt/ecl/lib',
];

const RUN_OPTS_BASE = {
  cwd: '/home/user',
  uid: 1000,
  gid: 1000,
};

const MAILBOX_SCRIPT = '/opt/actr-mailbox/actr-mailbox.sh';

export type ActrProcessId = string;

export type ActrProgressReporter = (message: string) => void;

export type ActrRunOptions = {
  seconds?: number;
  onProgress?: ActrProgressReporter;
};

export type ActrRunResult = {
  version: string;
  load: ActrRpcResponse;
  run: ActrRpcResponse;
  console: string;
};

export type ActrProcess = {
  readonly id: ActrProcessId;
  readonly name: string;
  readonly version: string;
  onConsole(cb: (chunk: string) => void): () => void;
  onBatchEnd(cb: () => void): () => void;
  loadAndRun(source: string, opts?: ActrRunOptions): Promise<ActrRunResult>;
  loadModel(source: string): Promise<void>;
  debugStep(): Promise<StepSnapshot>;
  evaluate(command: string, ...args: unknown[]): Promise<ActrRpcResponse>;
  dispose(): Promise<void>;
};

type CheerpXModule = {
  GitHubDevice: { create(url: string): Promise<unknown> };
  HttpBytesDevice: { create(url: string): Promise<unknown> };
  IDBDevice: { create(name: string): Promise<MailboxInOutDevice> };
  OverlayDevice: { create(http: unknown, idb: unknown): Promise<unknown> };
  DataDevice: { create(): Promise<MailboxInOutDevice> };
  Linux: {
    create(opts: { mounts: unknown[] }): Promise<CheerpXLinux>;
  };
};

type MailboxInOutDevice = {
  writeFile(path: string, content: string): Promise<void>;
  readFileAsBlob(path: string): Promise<Blob | null>;
};

type CheerpXLinux = {
  setCustomConsole(
    writeFunc: (buf: Uint8Array, vt: number) => void,
    cols: number,
    rows: number,
  ): (keyCode: number) => void;
  run(path: string, args: string[], opts: Record<string, unknown>): Promise<unknown>;
};

function imageBaseUrl(): string {
  const fromWindow =
    typeof globalThis !== 'undefined'
      ? (globalThis as { __ACTR_CHEERPX_IMAGE__?: string }).__ACTR_CHEERPX_IMAGE__
      : undefined;
  return fromWindow || DEFAULT_IMAGE_BASE;
}

async function imageHasMeta(baseUrl: string): Promise<boolean> {
  const metaUrl = `${baseUrl}.meta`;
  try {
    const head = await fetch(metaUrl, { method: 'HEAD' });
    if (head.ok) return true;
    const get = await fetch(metaUrl, { method: 'GET' });
    return get.ok;
  } catch {
    return false;
  }
}

async function imageHasFlat(baseUrl: string): Promise<boolean> {
  try {
    const head = await fetch(baseUrl, { method: 'HEAD' });
    if (head.ok) return true;
    const get = await fetch(baseUrl, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    return get.ok || get.status === 206;
  } catch {
    return false;
  }
}

async function createRootBlockDevice(CheerpX: CheerpXModule, baseUrl: string) {
  if (await imageHasMeta(baseUrl)) {
    log.info('Loading ACT-R disk image (GitHubDevice chunks)…');
    return CheerpX.GitHubDevice.create(baseUrl);
  }
  if (await imageHasFlat(baseUrl)) {
    log.info('Loading ACT-R disk image (HttpBytesDevice flat ext2)…');
    return CheerpX.HttpBytesDevice.create(baseUrl);
  }
  throw new Error(
    `ACT-R CheerpX image not found at ${baseUrl} — run npm run cheerpx:build-image in extension-actr`,
  );
}

function progress(onProgress: ActrProgressReporter | undefined, message: string) {
  log.info(message);
  onProgress?.(message);
}

function formatRpc(label: string, response: ActrRpcResponse): string {
  if (response.error) {
    const msg =
      typeof response.error === 'string'
        ? response.error
        : (response.error.message ?? JSON.stringify(response.error));
    return `${label}: ERROR ${msg}`;
  }
  return `${label}: ${JSON.stringify(response.result)}`;
}

function assertOk(label: string, response: ActrRpcResponse): void {
  if (response.error) {
    const msg =
      typeof response.error === 'string'
        ? response.error
        : (response.error.message ?? JSON.stringify(response.error));
    throw new Error(`${label} failed: ${msg}`);
  }
}

/**
 * Stage model source as one DataDevice file under /ipc-in.
 * Unique names avoid CheerpX DataDevice overwrite failures ("Unable to add file").
 * (Chunked write-* RPC was only needed when embedding source inside small RPC JSON bodies.)
 */
async function stageModelOnIpcIn(
  ipcIn: MailboxInOutDevice,
  slot: string,
  text: string,
): Promise<string> {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const name = `${slot}model${token}.lisp`;
  await ipcIn.writeFile(`/${name}`, text);
  return `${IPC_IN_MOUNT}/${name}`;
}

function nextProcessId(counter: number): ActrProcessId {
  return `p${counter}`;
}

class ActrProcessImpl implements ActrProcess {
  readonly id: ActrProcessId;
  readonly name: string;
  version = '';
  private readonly mailbox: MailboxClient;
  private readonly ipcIn: MailboxInOutDevice;
  private readonly service: ActrCheerpXService;
  private readonly listeners = new Set<(chunk: string) => void>();
  private readonly batchEndListeners = new Set<() => void>();
  private readonly filterMailboxLogs = createMailboxLogFilter();
  private consoleOffset = 0;
  private pollTimer?: ReturnType<typeof setInterval>;
  private operation: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private mailboxExit: Error | null = null;

  constructor(
    id: ActrProcessId,
    name: string,
    mailbox: MailboxClient,
    ipcIn: MailboxInOutDevice,
    service: ActrCheerpXService,
  ) {
    this.id = id;
    this.name = name;
    this.mailbox = mailbox;
    this.ipcIn = ipcIn;
    this.service = service;
  }

  markMailboxExit(error: Error): void {
    this.mailboxExit = error;
  }

  onConsole(cb: (chunk: string) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  onBatchEnd(cb: () => void): () => void {
    this.batchEndListeners.add(cb);
    return () => this.batchEndListeners.delete(cb);
  }

  emitConsole(chunk: string): void {
    const filtered = this.filterMailboxLogs(chunk);
    if (!filtered) return;
    for (const cb of this.listeners) cb(filtered);
  }

  private signalBatchEnd(): void {
    for (const cb of this.batchEndListeners) cb();
  }

  startConsolePoll(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void this.pollConsole();
    }, CONSOLE_POLL_MS);
  }

  private async pollConsole(): Promise<void> {
    if (this.disposed) return;
    try {
      const text = await this.mailbox.readConsoleText();
      if (text.length > this.consoleOffset) {
        const chunk = text.slice(this.consoleOffset);
        this.consoleOffset = text.length;
        this.emitConsole(chunk);
      }
    } catch {
      // ignore transient read errors while guest writes
    }
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.operation.then(fn, fn);
    this.operation = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private ensureAlive(): void {
    if (this.disposed) throw new Error(`ACT-R process ${this.id} is disposed`);
    if (this.mailboxExit) throw this.mailboxExit;
  }

  async loadAndRun(source: string, options: ActrRunOptions = {}): Promise<ActrRunResult> {
    const seconds = options.seconds ?? 10;
    const onProgress = options.onProgress;

    return this.enqueue(async () => {
      this.ensureAlive();
      const globalBefore = this.service.globalConsoleLength();
      this.service.beginConsoleCapture(this);
      try {
        await this.pollConsole();
        const consoleBefore = this.consoleOffset;

        progress(onProgress, `Staging model (${source.length} chars)…`);
        const load = await this.resetAndLoad(source);

        progress(onProgress, `Running for ${seconds}s…`);
        const run = await this.mailbox.evaluate('run', false, seconds);
        assertOk('run', run);
        log.info(formatRpc('run', run));

        await this.pollConsole();
        const fromFile = (await this.mailbox.readConsoleText()).slice(consoleBefore);
        const fromGlobal = this.service.globalConsoleText().slice(globalBefore);
        const consoleText = fromFile.length >= fromGlobal.length ? fromFile : fromGlobal;
        // IDB console mirror can lag; ensure listeners see the run output.
        if (fromGlobal.length > fromFile.length) {
          this.emitConsole(fromGlobal.slice(fromFile.length));
        }

        const versionResp = await this.mailbox.evaluate('act-r-version', false);
        const version =
          Array.isArray(versionResp.result) && versionResp.result[0] != null
            ? String(versionResp.result[0])
            : '';

        progress(onProgress, 'Done');
        return { version, load, run, console: consoleText };
      } finally {
        this.service.endConsoleCapture(this);
        this.signalBatchEnd();
      }
    });
  }

  async loadModel(source: string): Promise<void> {
    return this.enqueue(async () => {
      this.ensureAlive();
      this.service.beginConsoleCapture(this);
      try {
        await this.pollConsole();
        await this.resetAndLoad(source);
        await this.pollConsole();
      } finally {
        this.service.endConsoleCapture(this);
        this.signalBatchEnd();
      }
    });
  }

  async debugStep(): Promise<StepSnapshot> {
    return this.enqueue(async () => {
      this.ensureAlive();
      this.service.beginConsoleCapture(this);
      try {
        const response = await this.mailbox.call('debug-step');
        assertOk('debug-step', response);
        await this.pollConsole();
        return parseDebugSnapshot(response.result?.[0]);
      } finally {
        this.service.endConsoleCapture(this);
        this.signalBatchEnd();
      }
    });
  }

  private async resetAndLoad(source: string): Promise<ActrRpcResponse> {
    const guestPath = await stageModelOnIpcIn(this.ipcIn, this.mailbox.slot, source);
    const reset = await this.mailbox.evaluate('reset', false);
    if (reset.error) {
      log.warn(formatRpc('reset', reset));
    }
    const load = await this.mailbox.call('load-model', [guestPath]);
    assertOk('load-model', load);
    log.info(formatRpc('load-model', load));
    return load;
  }

  async evaluate(command: string, ...args: unknown[]): Promise<ActrRpcResponse> {
    return this.enqueue(async () => {
      this.ensureAlive();
      this.service.beginConsoleCapture(this);
      try {
        const response = await this.mailbox.evaluate(command, false, ...args);
        await this.pollConsole();
        return response;
      } finally {
        this.service.endConsoleCapture(this);
        this.signalBatchEnd();
      }
    });
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.service.endConsoleCapture(this);
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    try {
      await this.mailbox.call('quit', []);
    } catch {
      // process may already be gone
    }
    this.service.forgetProcess(this.id);
  }
}

export class ActrCheerpXService {
  private vmReady?: Promise<void>;
  private cx?: CheerpXLinux;
  private ipcIn?: MailboxInOutDevice;
  private ipcOut?: MailboxInOutDevice;
  private readonly processes = new Map<ActrProcessId, ActrProcessImpl>();
  private processCounter = 0;
  private globalConsole = '';
  private consoleCapture: ActrProcessImpl | null = null;

  public listProcesses(): ActrProcess[] {
    return [...this.processes.values()];
  }

  public getProcess(id: ActrProcessId): ActrProcess | undefined {
    return this.processes.get(id);
  }

  forgetProcess(id: ActrProcessId): void {
    this.processes.delete(id);
  }

  globalConsoleLength(): number {
    return this.globalConsole.length;
  }

  globalConsoleText(): string {
    return this.globalConsole;
  }

  beginConsoleCapture(proc: ActrProcessImpl): void {
    this.consoleCapture = proc;
  }

  endConsoleCapture(proc: ActrProcessImpl): void {
    if (this.consoleCapture === proc) this.consoleCapture = null;
  }

  public async ensureVm(onProgress?: ActrProgressReporter): Promise<void> {
    if (this.cx) {
      progress(onProgress, 'ACT-R VM ready');
      return;
    }
    if (!this.vmReady) {
      this.vmReady = this.bootstrapVm(onProgress).catch((error) => {
        log.error(error instanceof Error ? error.message : String(error));
        this.resetVm();
        throw error;
      });
    }
    await this.vmReady;
  }

  private resetVm(): void {
    this.vmReady = undefined;
    this.cx = undefined;
    this.ipcIn = undefined;
    this.ipcOut = undefined;
    this.globalConsole = '';
    this.consoleCapture = null;
    for (const proc of this.processes.values()) {
      void proc.dispose();
    }
    this.processes.clear();
  }

  private async bootstrapVm(onProgress?: ActrProgressReporter): Promise<void> {
    progress(onProgress, 'Loading CheerpX…');
    const CheerpX = (await import(
      /* @vite-ignore */
      CX_URL
    )) as unknown as CheerpXModule;

    progress(onProgress, 'Loading ACT-R disk image…');
    const baseUrl = imageBaseUrl();
    const httpDevice = await createRootBlockDevice(CheerpX, baseUrl);
    const rootIdb = await CheerpX.IDBDevice.create(ROOT_IDB);
    const overlayDevice = await CheerpX.OverlayDevice.create(httpDevice, rootIdb);
    const ipcIn = await CheerpX.DataDevice.create();
    const ipcOut = await CheerpX.IDBDevice.create(IPC_OUT_IDB);

    progress(onProgress, 'Starting Linux…');
    const cx = await CheerpX.Linux.create({
      mounts: [
        { type: 'ext2', path: '/', dev: overlayDevice },
        { type: 'devs', path: '/dev' },
        { type: 'proc', path: '/proc' },
        { type: 'dir', path: IPC_IN_MOUNT, dev: ipcIn },
        { type: 'dir', path: IPC_OUT_MOUNT, dev: ipcOut },
      ],
    });

    this.globalConsole = '';
    const decoder = new TextDecoder('utf-8');
    cx.setCustomConsole(
      (buf) => {
        const text = decoder.decode(buf);
        this.globalConsole += text;
        this.consoleCapture?.emitConsole(text);
      },
      80,
      24,
    );

    this.cx = cx;
    this.ipcIn = ipcIn;
    this.ipcOut = ipcOut;
    log.info('ACT-R CheerpX VM ready');
  }

  public async createProcess(opts?: {
    name?: string;
    onProgress?: ActrProgressReporter;
  }): Promise<ActrProcess> {
    if (this.processes.size >= MAX_PROCESSES) {
      throw new Error(
        `ACT-R process limit reached (${MAX_PROCESSES}). Close a console before starting another.`,
      );
    }

    const onProgress = opts?.onProgress;
    await this.ensureVm(onProgress);

    const cx = this.cx;
    const ipcIn = this.ipcIn;
    const ipcOut = this.ipcOut;
    if (!cx || !ipcIn || !ipcOut) {
      throw new Error('ACT-R VM is not available');
    }

    this.processCounter += 1;
    const id = nextProcessId(this.processCounter);
    const name = opts?.name?.trim() || `ACT-R ${id}`;

    progress(onProgress, `Starting ACT-R process ${id}…`);
    const mailbox = createMailboxClient({
      inDevice: ipcIn,
      outDevice: ipcOut,
      slot: id,
      timeoutMs: 180_000,
    });

    const proc = new ActrProcessImpl(id, name, mailbox, ipcIn, this);
    this.processes.set(id, proc);

    const runOpts = {
      ...RUN_OPTS_BASE,
      env: [...BASE_ENV, `ACTR_SLOT=${id}`],
    };

    const mailboxRun = cx.run(MAILBOX_SCRIPT, [], runOpts);
    mailboxRun.catch((error) => {
      const err = error instanceof Error ? error : new Error(String(error));
      log.error(`mailbox[${id}] exited: ${err.message}`);
      proc.markMailboxExit(err);
    });

    const version = await mailbox.waitUntilReady({
      timeoutMs: 600_000,
      pollMs: 250,
      onProgress: (msg) => progress(onProgress, `ACT-R[${id}]: ${msg}`),
      onPoll: () => {
        if (this.globalConsole.match(/ELF execution failed[^\n]*/)) {
          const elf = this.globalConsole.match(/ELF execution failed[^\n]*/);
          if (elf) throw new Error(elf[0]);
        }
      },
    });

    log.info(`mailbox[${id}] ready (${version})`);
    proc.version = version || 'ready';
    proc.startConsolePoll();
    proc.emitConsole(`ACT-R process ${id} ready (${version})\r\n`);
    return proc;
  }
}

export const actrCheerpXService = new ActrCheerpXService();
