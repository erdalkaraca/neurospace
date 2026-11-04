import type { ActrProcess } from './actr-cheerpx-service';

export const ACTR_REQUEST = 'actrRequest';
export const ACTR_RESPONSE = 'actrResponse';

export type ActrRequestMessage = {
  id: string;
  type: typeof ACTR_REQUEST;
  payload: { method: string; params?: unknown[] };
};

export type ActrResponseMessage = {
  id: string;
  type: typeof ACTR_RESPONSE;
  payload: { result?: unknown[]; error?: string; callbacks?: unknown[] };
};

export function isActrRequest(data: unknown): data is ActrRequestMessage {
  if (!data || typeof data !== 'object') return false;
  const message = data as Partial<ActrRequestMessage>;
  return message.type === ACTR_REQUEST && typeof message.id === 'string' && !!message.payload;
}

/** Python `load_act_r_model` arrives as evaluate("load-act-r-model", model, path). */
export function loadActRModelPath(message: ActrRequestMessage): string | undefined {
  if (message.payload.method !== 'evaluate') return undefined;
  const params = message.payload.params ?? [];
  if (params[0] !== 'load-act-r-model') return undefined;
  const path = params[2];
  return typeof path === 'string' && path.trim() ? path.trim() : undefined;
}

/** `ACT-R:tutorial;unit2;unit2-assignment-model.lisp` → `ACT-R/tutorial/unit2/unit2-assignment-model.lisp`. */
export function actrWorkspacePath(logicalPath: string): string {
  return logicalPath.replace(/[;:]/g, '/');
}

export async function dispatchActrCall(
  process: Pick<ActrProcess, 'call'>,
  method: string,
  params: unknown[] = [],
): Promise<unknown[]> {
  if (!method) throw new Error('ACT-R dispatch requires a method');
  return process.call(method, params);
}

export async function answerActrRequest(
  process: Pick<ActrProcess, 'call'> & { takeCallbacks?: () => unknown[] },
  message: ActrRequestMessage,
): Promise<ActrResponseMessage> {
  try {
    const result = await dispatchActrCall(
      process,
      message.payload.method,
      message.payload.params ?? [],
    );
    const callbacks = process.takeCallbacks?.() ?? [];
    return {
      id: message.id,
      type: ACTR_RESPONSE,
      payload: callbacks.length ? { result, callbacks } : { result },
    };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return { id: message.id, type: ACTR_RESPONSE, payload: { error: text } };
  }
}

/** Worker-side bridge. Python calls actrDispatch; the reply arrives as actrResponse. */
export function actrWorkerBridgeSource(): string {
  return `
if (!globalThis.__actrBridge) {
  globalThis.__actrBridge = true;
  const previous = globalThis.onmessage;
  const waiters = new Map();
  let sequence = 0;
  globalThis.onmessage = (event) => {
    const data = event.data;
    if (data && data.type === ${JSON.stringify(ACTR_RESPONSE)}) {
      const waiter = waiters.get(data.id);
      if (!waiter) return;
      waiters.delete(data.id);
      if (data.payload && data.payload.error) waiter.reject(new Error(data.payload.error));
      else waiter.resolve({
        result: (data.payload && data.payload.result) || [],
        callbacks: (data.payload && data.payload.callbacks) || [],
      });
      return;
    }
    if (previous) previous.call(globalThis, event);
  };
  globalThis.actrDispatch = (method, params) => new Promise((resolve, reject) => {
    const id = 'actr-' + (++sequence);
    waiters.set(id, { resolve, reject });
    globalThis.postMessage({
      id,
      type: ${JSON.stringify(ACTR_REQUEST)},
      payload: { method: String(method), params },
    });
  });
}
`;
}
