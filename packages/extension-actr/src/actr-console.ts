import { File, workspaceService } from '@eclipse-docks/core';
import { terminalService, type Terminal } from '@eclipse-docks/extension-terminal/api';

import { actrCheerpXService, type ActrProcess } from './actr-cheerpx-service';
import { ACTR_BIND_ENV, attachActrTerminal, waitActrBind } from './actr-console-registry';
import { actrWorkspacePath } from './actr-dispatcher';
import { ACTR_TERMINAL_PROFILE_ID } from './actr-terminal-backend';

export async function openActrConsole(
  name: string,
  onCreated?: (terminal: Terminal) => void,
): Promise<{ terminal: Terminal; process: ActrProcess }> {
  const bindId = crypto.randomUUID();
  const terminal = await terminalService.createTerminal({
    profileId: ACTR_TERMINAL_PROFILE_ID,
    name,
    env: { [ACTR_BIND_ENV]: bindId },
  });
  if (!terminal) throw new Error('Failed to create ACT-R terminal');

  terminal.show(true);
  onCreated?.(terminal);

  const process = await waitActrBind(bindId);
  attachActrTerminal(terminal.id, process);
  terminal.show(true);
  return { terminal, process };
}

export function actrProcessAlive(process: ActrProcess): boolean {
  return actrCheerpXService.getProcess(process.id) === process;
}

export async function readTutorialModel(logicalPath: string): Promise<string> {
  const workspacePath = actrWorkspacePath(logicalPath);
  if (!workspacePath) throw new Error(`Tutorial model not found: ${logicalPath}`);

  const workspace = await workspaceService.getWorkspace();
  if (!workspace) throw new Error('No workspace selected');

  const resource = await workspace.getResource(workspacePath);
  if (!resource || !(resource instanceof File)) {
    throw new Error(`Tutorial model not found: ${workspacePath}`);
  }

  const contents = await resource.getContents();
  if (typeof contents !== 'string') {
    throw new Error(`Tutorial model is not text: ${workspacePath}`);
  }
  return contents;
}
