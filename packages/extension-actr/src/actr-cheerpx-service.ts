import { createLogger } from '@eclipse-docks/core';

import { actrCheerpXImageBase } from './actr-cheerpx-image-paths';
import { createMailboxClient, type ActrRpcResponse, type MailboxClient } from './mailbox-client';

const log = createLogger('ACT-R');

const CX_URL = 'https://cxrtnc.leaningtech.com/1.1.5/cx.esm.js';
const DEFAULT_IMAGE_BASE = actrCheerpXImageBase(import.meta.env.BASE_URL);
const ROOT_IDB = 'actr-cheerpx-editor-v6';
const IPC_OUT_IDB = 'actr-cheerpx-editor-ipc-out-v6';
/** CheerpX dir mounts need an existing parent; use top-level paths (not /ipc/in). */
const IPC_IN_MOUNT = '/ipc-in';
const IPC_OUT_MOUNT = '/ipc-out';
const GUEST_MODEL_PATH = '/tmp/actr-run/model.lisp';
/** Keep DataDevice payloads small — large writeFile hits CheerpX "Unable to add file". */
const WRITE_CHUNK_CHARS = 400;

const RUN_OPTS = {
  env: [
    'HOME=/home/user',
    'USER=user',
    'SHELL=/bin/bash',
    'LANG=C.UTF-8',
    'LC_ALL=C',
    'PATH=/opt/ecl/bin:/usr/local/bin:/usr/bin:/bin',
    'LD_LIBRARY_PATH=/opt/ecl/lib',
  ],
  cwd: '/home/user',
  uid: 1000,
  gid: 1000,
};

const MAILBOX_SCRIPT = '/opt/actr-mailbox/actr-mailbox.sh';

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
  run(path: string, args: string[], opts: typeof RUN_OPTS): Promise<unknown>;
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

async function writeGuestFile(
  mailbox: MailboxClient,
  guestPath: string,
  text: string,
  onProgress?: ActrProgressReporter,
) {
  assertOk('write-begin', await mailbox.call('write-begin', [guestPath]));
  const total = Math.max(1, Math.ceil(text.length / WRITE_CHUNK_CHARS));
  for (let i = 0, n = 0; i < text.length; i += WRITE_CHUNK_CHARS, n += 1) {
    const chunk = text.slice(i, i + WRITE_CHUNK_CHARS);
    progress(onProgress, `Staging model… chunk ${n + 1}/${total}`);
    assertOk('write-chunk', await mailbox.call('write-chunk', [chunk]));
  }
  assertOk('write-end', await mailbox.call('write-end', []));
}

export class ActrCheerpXService {
  private ready?: Promise<{ mailbox: MailboxClient; version: string }>;
  private mailbox?: MailboxClient;
  /** Full CheerpX stdout/stderr — DOM setConsole truncates; setCustomConsole does not. */
  private consoleLog = '';
  private readonly consoleDecoder = new TextDecoder('utf-8');
  private operation: Promise<unknown> = Promise.resolve();

  public reset(): void {
    this.ready = undefined;
    this.mailbox = undefined;
    this.consoleLog = '';
  }

  private getConsoleText(): string {
    return this.consoleLog;
  }

  private async bootstrap(onProgress?: ActrProgressReporter) {
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

    this.consoleLog = '';
    cx.setCustomConsole(
      (buf) => {
        this.consoleLog += this.consoleDecoder.decode(buf);
      },
      80,
      24,
    );

    progress(onProgress, 'Starting ACT-R mailbox…');
    let mailboxExit: Error | null = null;
    const mailboxRun = cx.run(MAILBOX_SCRIPT, [], RUN_OPTS);
    mailboxRun.catch((error) => {
      mailboxExit = error instanceof Error ? error : new Error(String(error));
      log.error(`mailbox exited: ${mailboxExit.message}`);
    });

    const mailbox = createMailboxClient({
      inDevice: ipcIn,
      outDevice: ipcOut,
      timeoutMs: 180_000,
    });

    const version = await mailbox.waitUntilReady({
      timeoutMs: 600_000,
      pollMs: 250,
      onProgress: (msg) => progress(onProgress, `ACT-R: ${msg}`),
      onPoll: () => {
        if (mailboxExit) throw mailboxExit;
        const elf = this.consoleLog.match(/ELF execution failed[^\n]*/);
        if (elf) {
          throw new Error(elf[0]);
        }
      },
    });

    log.info(`mailbox ready (${version})`);
    this.mailbox = mailbox;
    return { mailbox, version };
  }

  public ensureReady(onProgress?: ActrProgressReporter) {
    if (this.mailbox) {
      progress(onProgress, 'ACT-R runtime ready');
      return Promise.resolve({ mailbox: this.mailbox, version: '' });
    }
    if (!this.ready) {
      this.ready = this.bootstrap(onProgress).catch((error) => {
        log.error(error instanceof Error ? error.message : String(error));
        this.reset();
        throw error;
      });
    }
    return this.ready;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.operation.then(fn, fn);
    this.operation = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  public runLisp(source: string, options: ActrRunOptions = {}): Promise<ActrRunResult> {
    const seconds = options.seconds ?? 10;
    const onProgress = options.onProgress;

    return this.enqueue(async () => {
      const { mailbox } = await this.ensureReady(onProgress);

      const consoleBefore = this.getConsoleText().length;

      progress(onProgress, `Staging model (${source.length} chars)…`);
      await writeGuestFile(mailbox, GUEST_MODEL_PATH, source, onProgress);

      progress(onProgress, 'Resetting ACT-R…');
      const reset = await mailbox.evaluate('reset', false);
      if (reset.error) {
        log.warn(formatRpc('reset', reset));
      }

      progress(onProgress, 'Loading model…');
      const load = await mailbox.call('load-model', [GUEST_MODEL_PATH]);
      assertOk('load-model', load);
      log.info(formatRpc('load-model', load));

      progress(onProgress, `Running for ${seconds}s…`);
      const run = await mailbox.evaluate('run', false, seconds);
      assertOk('run', run);
      log.info(formatRpc('run', run));

      const consoleText = this.getConsoleText().slice(consoleBefore);
      const versionResp = await mailbox.evaluate('act-r-version', false);
      const version =
        Array.isArray(versionResp.result) && versionResp.result[0] != null
          ? String(versionResp.result[0])
          : '';

      progress(onProgress, 'Done');
      return { version, load, run, console: consoleText };
    });
  }
}

export const actrCheerpXService = new ActrCheerpXService();
