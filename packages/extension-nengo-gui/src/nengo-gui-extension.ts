import { EditorInput, File as DocksFile, editorRegistry } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';

import { NENGO_EDITOR_ID } from './k-nengo-editor';
import './nengo-attribution';
import './nengo-catalog';
import './nengo-viz-contributions';
import './nengo-model-graph-panel';
import './nengo-visualizations-panel';

const isNengoFile = (file: DocksFile): boolean =>
  file.getName().toLowerCase().endsWith('.nengo.py');

editorRegistry.registerEditorInputHandler({
  editorId: NENGO_EDITOR_ID,
  label: 'Nengo Editor',
  canHandle: (input): input is DocksFile =>
    input instanceof DocksFile && isNengoFile(input),
  handle: async (input: DocksFile) => {
    const editorInput: EditorInput = {
      title: input.getWorkspacePath(),
      data: input,
      key: `nengo-editor-${input.getWorkspacePath()}`,
      icon: 'brain',
      state: {},
      component: (id: string) => html`<k-nengo-editor id="${id}" .input=${editorInput}></k-nengo-editor>`,
    };
    return editorInput;
  },
  ranking: 2000,
});
