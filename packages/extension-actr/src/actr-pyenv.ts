import { activeEditorSignal, createLogger } from '@eclipse-docks/core';
import { PyEnv } from '@eclipse-docks/extension-python-runtime/api';
import type { Terminal } from '@eclipse-docks/extension-terminal/api';

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
const terminalByWorker = new WeakMap<Worker, Terminal>();
const pyenvByWorker = new WeakMap<Worker, PyEnv>();
const editorNameByWorker = new WeakMap<Worker, string>();
const closedWorkers = new WeakSet<Worker>();

function sessionWorker(pyenv: PyEnv): Worker | undefined {
  return (pyenv as unknown as { worker?: Worker }).worker;
}

function releaseActrSession(pyenv: PyEnv): void {
  const worker = sessionWorker(pyenv);
  if (!worker) return;
  closedWorkers.add(worker);
  const terminal = terminalByWorker.get(worker);
  terminalByWorker.delete(worker);
  currentByWorker.delete(worker);
  pyenvByWorker.delete(worker);
  editorNameByWorker.delete(worker);
  void terminal?.dispose({ confirm: false });
}

function owningEditorFileName(pyenv: PyEnv): string | undefined {
  const editor = activeEditorSignal.get() as {
    getPyEnv?: () => PyEnv | undefined;
    input?: { data?: { getName?: () => string } };
  } | null;
  if (editor?.getPyEnv?.() !== pyenv) return undefined;
  const name = editor.input?.data?.getName?.()?.trim();
  return name || undefined;
}

async function consoleForModel(worker: Worker, logicalPath: string): Promise<ActrProcess> {
  const source = await readTutorialModel(logicalPath);
  let process = currentByWorker.get(worker);
  if (!process || !actrProcessAlive(process)) {
    const pyenv = pyenvByWorker.get(worker);
    const name = (pyenv && owningEditorFileName(pyenv)) || editorNameByWorker.get(worker) || 'ACT-R';
    const opened = await openActrConsole(name);
    if (closedWorkers.has(worker)) {
      void opened.terminal.dispose({ confirm: false });
      throw new Error('Python session closed');
    }
    process = opened.process;
    currentByWorker.set(worker, process);
    terminalByWorker.set(worker, opened.terminal);
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
          const process = currentProcess(worker);
          const keys = await waitForHumanKeys(process.id, 0);
          response = keys.length
            ? await answerActrRequest(process, {
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
  const worker = sessionWorker(pyenv);
  if (!worker) throw new Error('Python worker is not running');
  pyenvByWorker.set(worker, pyenv);
  const editorName = owningEditorFileName(pyenv);
  if (editorName) editorNameByWorker.set(worker, editorName);
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
  const originalClose = PyEnv.prototype.close;
  PyEnv.prototype.close = function (this: PyEnv) {
    releaseActrSession(this);
    originalClose.call(this);
  };
  (PyEnv.prototype.init as typeof init)[INSTALLED] = true;
}

installActrDispatcherHook();
