import { registerAll } from '@eclipse-docks/core';

import { actrIcon } from './actr-icons';
import { ACTR_COMMAND, getActiveActrEditor, type NsActrEditor } from './ns-actr-editor';

interface ActrEditorCommand {
  id: string;
  name: string;
  description: string;
  icon: string;
  keyBinding: string;
  enabled: (editor: NsActrEditor) => boolean;
  execute: (editor: NsActrEditor) => unknown;
}

const commands: ActrEditorCommand[] = [
  {
    id: ACTR_COMMAND.run,
    name: 'ACT-R: Run',
    description: 'Load the active ACT-R model into its console and run it for 10s',
    icon: actrIcon('run'),
    keyBinding: 'CTRL+F5',
    enabled: (editor) => editor.canRun,
    execute: (editor) => editor.run(),
  },
  {
    id: ACTR_COMMAND.step,
    name: 'ACT-R: Step',
    description: 'Run the next scheduled event of the active ACT-R model',
    icon: actrIcon('step-over'),
    keyBinding: 'F10',
    enabled: (editor) => editor.canStep,
    execute: (editor) => editor.step(),
  },
  {
    id: ACTR_COMMAND.stop,
    name: 'ACT-R: Stop',
    description: 'Leave the step session of the active ACT-R model',
    icon: actrIcon('stop'),
    keyBinding: 'SHIFT+F5',
    enabled: (editor) => editor.canStop,
    execute: (editor) => editor.stop(),
  },
];

for (const { enabled, execute, ...command } of commands) {
  registerAll({
    command,
    handler: {
      canExecute: () => {
        const editor = getActiveActrEditor();
        return editor !== null && enabled(editor);
      },
      execute: () => {
        const editor = getActiveActrEditor();
        return editor ? execute(editor) : undefined;
      },
    },
  });
}
