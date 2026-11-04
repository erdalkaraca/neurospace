import { createLogger } from '@eclipse-docks/core';
import { PyEnv } from '@eclipse-docks/extension-python-runtime/api';

import actrSource from './actr.py?raw';
import { actrProcessAlive, openActrConsole, readTutorialModel } from './actr-console';
import { isProcessEvents, waitForHumanKeys } from './exp-window';
import type { ActrProcess } from './actr-cheerpx-service';
import {
  ACTR_RESPONSE,
  actrWorkerBridgeSource,
  answerActrRequest,
  isActrRequest,
  loadActRModelPath,
  type ActrResponseMessage,
} from './actr-dispatcher';

const log = createLogger('ACT-R');
const INSTALLED = Symbol.for('neurospace.actrDispatcher');

const currentByWorker = new WeakMap<Worker, ActrProcess>();

async function consoleForModel(worker: Worker, logicalPath: string): Promise<ActrProcess> {
  const source = await readTutorialModel(logicalPath);
  let process = currentByWorker.get(worker);
  if (!process || !actrProcessAlive(process)) {
    const opened = await openActrConsole('ACT-R');
    process = opened.process;
    currentByWorker.set(worker, process);
  }
  await process.loadModel(source);
  return process;
}

function currentProcess(worker: Worker): ActrProcess {
  const process = currentByWorker.get(worker);
  if (!process || !actrProcessAlive(process)) {
    throw new Error('Could not start ACT-R connection.');
  }
  return process;
}

function installScript(): string {
  const source = JSON.stringify(JSON.stringify(actrSource));
  const bridge = JSON.stringify(JSON.stringify(actrWorkerBridgeSource()));
  return `
import json, sys, sysconfig
from pathlib import Path
from pyodide.ffi import run_sync, to_js
import js

source = json.loads(${source})
root = Path(sysconfig.get_path("purelib"))
(root / "actr.py").write_text(source, encoding="utf-8")
sys.modules.pop("actr", None)
import actr

from pyodide.code import run_js
run_js(json.loads(${bridge}))

def _send(method, params):
    converted = to_js(params)
    try:
        result = run_sync(js.actrDispatch(method, converted))
    finally:
        if hasattr(converted, "destroy"):
            converted.destroy()
    if hasattr(result, "to_py"):
        return result.to_py()
    return result

actr.set_dispatcher(_send)
`;
}

function attachWorker(worker: Worker): void {
  const marked = worker as Worker & { __actrMainBridge?: boolean };
  if (marked.__actrMainBridge) return;
  marked.__actrMainBridge = true;
  const previous = worker.onmessage?.bind(worker);
  worker.onmessage = (event: MessageEvent) => {
    if (!isActrRequest(event.data)) {
      previous?.(event);
      return;
    }
    const message = event.data;
    void (async () => {
      let response: ActrResponseMessage;
      try {
        const logicalPath = loadActRModelPath(message);
        if (logicalPath) {
          await consoleForModel(worker, logicalPath);
          response = { id: message.id, type: ACTR_RESPONSE, payload: { result: [true] } };
        } else if (isProcessEvents(message.payload.method, message.payload.params)) {
          const keys = await waitForHumanKeys(0);
          response = keys.length
            ? await answerActrRequest(currentProcess(worker), {
                ...message,
                payload: { method: 'human-keys', params: keys },
              })
            : { id: message.id, type: ACTR_RESPONSE, payload: { result: [null] } };
        } else {
          response = await answerActrRequest(currentProcess(worker), message);
        }
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        response = { id: message.id, type: ACTR_RESPONSE, payload: { error: text } };
      }
      worker.postMessage(response);
    })();
  };
}

export async function attachActrDispatcher(pyenv: PyEnv): Promise<void> {
  const worker = (pyenv as unknown as { worker?: Worker }).worker;
  if (!worker) throw new Error('Python worker is not running');
  attachWorker(worker);
  await pyenv.execCode(installScript());
}

export function installActrDispatcherHook(): void {
  const init = PyEnv.prototype.init as PyEnv['init'] & { [INSTALLED]?: boolean };
  if (init[INSTALLED]) return;
  const original = PyEnv.prototype.init;
  PyEnv.prototype.init = async function (this: PyEnv, ...args: Parameters<PyEnv['init']>) {
    await original.apply(this, args);
    try {
      await attachActrDispatcher(this);
    } catch (error) {
      log.error(error instanceof Error ? error.message : String(error));
    }
  };
  (PyEnv.prototype.init as typeof init)[INSTALLED] = true;
}

installActrDispatcherHook();
