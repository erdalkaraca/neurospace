import {
  LineInput,
  registerTerminalProfile,
  type TerminalBackend,
  type TerminalCreationOptions,
} from '@eclipse-docks/extension-terminal/api';

import { actrCheerpXService, type ActrProcess } from './actr-cheerpx-service';
import { ACTR_BIND_ENV, registerActrBindPending } from './actr-console-registry';
import { formatActrTextTrace } from './actr-trace-format';

export const ACTR_TERMINAL_PROFILE_ID = 'terminal.actr';

const PROMPT = 'ACT-R> ';

function toXterm(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
}

function coerceArg(token: string): string | number {
  if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token);
  return token;
}

/** Parse `run 10` or `(run 10)` into command + args for mailbox evaluate. */
export function parseActrCommandLine(line: string): { command: string; args: unknown[] } | null {
  let text = line.trim();
  if (!text) return null;
  if (text.startsWith('(') && text.endsWith(')')) {
    text = text.slice(1, -1).trim();
  }
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const [command, ...rest] = tokens;
  return { command, args: rest.map(coerceArg) };
}

function formatEvaluateResult(response: {
  result: unknown[] | null;
  error: { message?: string } | string | null;
}): string {
  if (response.error) {
    const msg =
      typeof response.error === 'string'
        ? response.error
        : (response.error.message ?? JSON.stringify(response.error));
    return `\x1b[31m${msg}\x1b[0m\r\n`;
  }
  if (response.result == null || response.result.length === 0) return '';
  return `${JSON.stringify(response.result)}\r\n`;
}

export class ActrProcessBackend implements TerminalBackend {
  private readonly writeCallbacks = new Set<(data: string) => void>();
  private readonly lineInput: LineInput;
  private process: ActrProcess | null = null;
  private unsubConsole?: () => void;
  private unsubBatchEnd?: () => void;
  private busy = false;
  private atLineStart = true;
  private readonly bindId: string;
  private readonly label: string;
  private pendingOutput = '';
  private liveOutputSeen = false;
  private consoleCarry = '';
  private bootPromise: Promise<ActrProcess> | null = null;
  private closed = false;

  private constructor(bindId: string, label: string) {
    this.bindId = bindId;
    this.label = label;
    this.lineInput = new LineInput((data: string) => this.emit(data));
  }

  static create(options?: TerminalCreationOptions): ActrProcessBackend {
    const bindId = options?.env?.[ACTR_BIND_ENV] ?? crypto.randomUUID();
    const label = options?.name?.trim() || 'ACT-R';
    const backend = new ActrProcessBackend(bindId, label);
    // Start boot immediately but return the backend so the Terminal tab can open first.
    registerActrBindPending(bindId, backend.startBoot());
    return backend;
  }

  private startBoot(): Promise<ActrProcess> {
    if (this.bootPromise) return this.bootPromise;

    this.bootPromise = (async () => {
      this.emit('Starting ACT-R runtime…\r\n');
      this.emit('Boot progress will appear here while the console loads.\r\n\r\n');

      const process = await actrCheerpXService.createProcess({
        name: this.label,
        onProgress: (message) => {
          this.emit(`${toXterm(message)}\r\n`);
        },
      });

      if (this.closed) {
        await process.dispose();
        throw new Error('ACT-R console was closed during startup');
      }

      this.process = process;
      this.attachProcess(process);
      this.emit(`\r\nACT-R console ready (${process.version || 'ready'}). `);
      this.emit('Type commands (e.g. run 10, reset) or use Run in the editor.\r\n');
      this.emitPrompt();
      return process;
    })();

    return this.bootPromise;
  }

  private attachProcess(process: ActrProcess): void {
    this.unsubConsole?.();
    this.unsubBatchEnd?.();
    this.unsubConsole = process.onConsole((chunk) => this.emitConsoleChunk(chunk));
    this.unsubBatchEnd = process.onBatchEnd(() => {
      if (!this.busy) this.emitPrompt();
    });
  }

  onDidWrite(callback: (data: string) => void): () => void {
    this.writeCallbacks.add(callback);
    if (this.pendingOutput) {
      callback(this.pendingOutput);
      this.pendingOutput = '';
      this.liveOutputSeen = true;
    }
    return () => this.writeCallbacks.delete(callback);
  }

  private emit(data: string): void {
    if (!data) return;
    if (this.writeCallbacks.size === 0) {
      this.pendingOutput += data;
    } else {
      for (const cb of this.writeCallbacks) cb(data);
      this.liveOutputSeen = true;
    }
    this.atLineStart = /[\r\n]$/.test(data);
  }

  private emitPrompt(): void {
    if (!this.atLineStart) this.emit('\r\n');
    this.emit(PROMPT);
  }

  private emitConsoleChunk(raw: string): void {
    const combined = this.consoleCarry + raw;
    const formatted = formatActrTextTrace(combined);
    const lastNl = formatted.lastIndexOf('\n');
    if (
      lastNl >= 0 &&
      lastNl < formatted.length - 1 &&
      !/^\d+\.\d{3}\s/.test(formatted.slice(lastNl + 1))
    ) {
      this.consoleCarry = formatted.slice(lastNl + 1);
      const ready = formatted.slice(0, lastNl + 1);
      if (ready) this.emit(toXterm(ready));
      return;
    }
    this.consoleCarry = '';
    if (formatted) {
      this.emit(toXterm(formatted.endsWith('\n') ? formatted : `${formatted}\n`));
    }
  }

  async open(): Promise<void> {
    // Ensure boot is running; progress may already be in pendingOutput.
    void this.startBoot();
    if (!this.liveOutputSeen && this.pendingOutput === '') {
      this.emit('Starting ACT-R runtime…\r\n');
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    this.unsubConsole?.();
    this.unsubConsole = undefined;
    this.unsubBatchEnd?.();
    this.unsubBatchEnd = undefined;
    this.lineInput.reset();

    const proc = this.process;
    this.process = null;

    if (proc) {
      await proc.dispose();
      return;
    }

    // Boot still in flight — wait and dispose if it finishes.
    if (this.bootPromise) {
      try {
        const process = await this.bootPromise;
        await process.dispose();
      } catch {
        // startup failed or already disposed
      }
    }
  }

  setDimensions(_dimensions: { cols: number; rows: number }): void {}

  handleInput(data: string): void {
    if (this.busy || this.closed) return;
    if (!this.process) {
      // Swallow input while booting; echo nothing so we don't look broken mid-start.
      return;
    }
    const line = this.lineInput.feed(data);
    if (line === null) return;
    void this.runLine(line);
  }

  private async runLine(line: string): Promise<void> {
    if (!this.process) {
      this.emitPrompt();
      return;
    }
    const parsed = parseActrCommandLine(line);
    if (!parsed) {
      this.emitPrompt();
      return;
    }

    this.busy = true;
    try {
      const response = await this.process.evaluate(parsed.command, ...parsed.args);
      const out = formatEvaluateResult(response);
      if (out) this.emit(out);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emit(`\x1b[31m${msg}\x1b[0m\r\n`);
    } finally {
      this.busy = false;
      this.emitPrompt();
    }
  }
}

registerTerminalProfile({
  id: ACTR_TERMINAL_PROFILE_ID,
  label: 'ACT-R',
  icon: 'brain',
  hidden: true,
  persist: false,
  create: async (options) => ActrProcessBackend.create(options),
});
