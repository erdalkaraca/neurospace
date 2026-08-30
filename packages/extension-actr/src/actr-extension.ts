import { EditorInput, File as DocksFile, editorRegistry } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';

import './actr-lisp-language';
import './ns-actr-editor';
import './actr-text-trace-panel';
import './actr-attribution';
import './actr-catalog';
import { ACTR_EDITOR_ID } from './ns-actr-editor';

const isActrLispFile = (file: DocksFile): boolean =>
  file.getName().toLowerCase().endsWith('.lisp');

editorRegistry.registerEditorInputHandler({
  editorId: ACTR_EDITOR_ID,
  label: 'ACT-R Editor',
  canHandle: (input): input is DocksFile =>
    input instanceof DocksFile && isActrLispFile(input),
  handle: async (input: DocksFile) => {
    const editorInput: EditorInput = {
      title: input.getWorkspacePath(),
      data: input,
      key: `actr-editor-${input.getWorkspacePath()}`,
      icon: 'brain',
      state: {},
      component: (id: string) =>
        html`<ns-actr-editor id="${id}" .input=${editorInput}></ns-actr-editor>`,
    };
    return editorInput;
  },
  ranking: 2000,
});
