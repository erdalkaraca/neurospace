/** CheerpX file-mailbox client for ACT-R evaluate RPC (no TCP / no EOT). */

export type MailboxDevice = {
  writeFile(path: string, content: string): Promise<void>;
  readFileAsBlob(path: string): Promise<Blob | null>;
};

export type ActrRpcResponse = {
  result: unknown[] | null;
  error: { message?: string } | string | null;
  id: number | string | null;
  callbacks?: unknown[];
  windows?: unknown[];
};

export function mailboxResult(response: ActrRpcResponse): unknown[] {
  if (!response.error) return response.result ?? [];
  const message =
    typeof response.error === 'string'
      ? response.error
      : (response.error.message ?? JSON.stringify(response.error));
  throw new Error(message);
}

export type MailboxClient = {
  readonly slot: string;
  call(method: string, params?: unknown[]): Promise<ActrRpcResponse>;
  waitUntilReady(options?: {
    timeoutMs?: number;
    pollMs?: number;
    onProgress?: (msg: string) => void;
    onPoll?: () => void;
  }): Promise<string>;
  evaluate(
    command: string,
    model?: string | boolean | null,
    ...args: unknown[]
  ): Promise<ActrRpcResponse>;
  readConsoleText(): Promise<string>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createMailboxClient({
  inDevice,
  outDevice,
  slot = 'main',
  pollMs = 50,
  timeoutMs = 120_000,
  onResponse,
}: {
  inDevice: Pick<MailboxDevice, 'writeFile'>;
  outDevice: Pick<MailboxDevice, 'readFileAsBlob'>;
  slot?: string;
  pollMs?: number;
  timeoutMs?: number;
  onResponse?: (response: ActrRpcResponse) => void;
}): MailboxClient {
  let nextId = 1;
  const prefix = `${slot}.`;

  async function readOutText(name: string): Promise<string | null> {
    const blob = await outDevice.readFileAsBlob(`/${prefix}${name}`);
    if (!blob) return null;
    return blob.text();
  }

  async function waitUntilReady({
    timeoutMs: readyTimeoutMs = 600_000,
    pollMs: readyPollMs = 500,
    onProgress,
    onPoll,
  }: {
    timeoutMs?: number;
    pollMs?: number;
    onProgress?: (msg: string) => void;
    onPoll?: () => void;
  } = {}): Promise<string> {
    const deadline = Date.now() + readyTimeoutMs;
    let lastProgress = '';
    while (Date.now() < deadline) {
      onPoll?.();
      const ready = await readOutText('ready');
      if (ready != null && ready.trim() !== '') {
        return ready.trim();
      }
      const progress = ((await readOutText('progress')) ?? '').trim();
      if (progress && progress !== lastProgress) {
        lastProgress = progress;
        onProgress?.(progress);
      }
      await sleep(readyPollMs);
    }
    throw new Error(
      `mailbox[${slot}] did not become ready in time (last progress: ${lastProgress || 'none'})`,
    );
  }

  async function call(method: string, params: unknown[] = []): Promise<ActrRpcResponse> {
    const id = nextId++;
    const token = String(id);
    const body = JSON.stringify({ method, params, id });

    // DataDevice cannot reliably overwrite files ("Unable to add file").
    // Use a fresh top-level name per request (no subdirs — CheerpX rejects them).
    await inDevice.writeFile(`/${prefix}r${token}.json`, body);
    await inDevice.writeFile(`/${prefix}r${token}.ready`, token);

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const ready = (await readOutText('res.ready'))?.trim();
      if (ready === token) {
        const raw = await readOutText('res.json');
        if (!raw) throw new Error(`mailbox[${slot}]: res.ready present but res.json missing`);
        const response = JSON.parse(raw) as ActrRpcResponse;
        onResponse?.(response);
        return response;
      }
      await sleep(pollMs);
    }
    throw new Error(`mailbox[${slot}] timeout waiting for ${method} id=${id}`);
  }

  return {
    slot,
    call,
    waitUntilReady,
    evaluate: (command, model = false, ...args) =>
      call('evaluate', [command, model, ...args]),
    readConsoleText: async () => (await readOutText('console')) ?? '',
  };
}
