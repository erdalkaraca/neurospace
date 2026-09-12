import type { ActrProcess, ActrProcessId } from './actr-cheerpx-service';

const byBindId = new Map<string, ActrProcess>();
const pendingByBindId = new Map<string, Promise<ActrProcess>>();
const byTerminalId = new Map<string, ActrProcess>();
const byProcessId = new Map<ActrProcessId, string>();

export const ACTR_BIND_ENV = 'ACTR_BIND_ID';

export function registerActrBind(bindId: string, process: ActrProcess): void {
  byBindId.set(bindId, process);
}

export function registerActrBindPending(bindId: string, ready: Promise<ActrProcess>): void {
  const tracked = ready.then(
    (process) => {
      registerActrBind(bindId, process);
      return process;
    },
    (error) => {
      pendingByBindId.delete(bindId);
      throw error;
    },
  );
  pendingByBindId.set(bindId, tracked);
}

export function takeActrBind(bindId: string): ActrProcess | undefined {
  const process = byBindId.get(bindId);
  byBindId.delete(bindId);
  pendingByBindId.delete(bindId);
  return process;
}

/** Wait until the backend finishes booting the ACT-R process for this bind id. */
export async function waitActrBind(bindId: string): Promise<ActrProcess> {
  const ready = byBindId.get(bindId);
  if (ready) {
    byBindId.delete(bindId);
    pendingByBindId.delete(bindId);
    return ready;
  }
  const pending = pendingByBindId.get(bindId);
  if (!pending) {
    throw new Error('ACT-R process did not register with the console');
  }
  const process = await pending;
  byBindId.delete(bindId);
  pendingByBindId.delete(bindId);
  return process;
}

export function attachActrTerminal(terminalId: string, process: ActrProcess): void {
  byTerminalId.set(terminalId, process);
  byProcessId.set(process.id, terminalId);
}

export function detachActrTerminal(terminalId: string): ActrProcess | undefined {
  const process = byTerminalId.get(terminalId);
  byTerminalId.delete(terminalId);
  if (process) byProcessId.delete(process.id);
  return process;
}

export function getActrProcessForTerminal(terminalId: string): ActrProcess | undefined {
  return byTerminalId.get(terminalId);
}

export function getTerminalIdForProcess(processId: ActrProcessId): string | undefined {
  return byProcessId.get(processId);
}
