import { EditorInput, File as LyraFile, editorRegistry } from '@eclipse-lyra/core';
import { html } from '@eclipse-lyra/core/externals/lit';

import './k-nengo-editor';
import './nengo-catalog';
import './nengo-viz-contributions';
import './nengo-model-graph-panel';
import './nengo-visualizations-panel';

const isNengoFile = (file: LyraFile): boolean =>
  file.getName().toLowerCase().endsWith('.nengo.py');

editorRegistry.registerEditorInputHandler({
  editorId: 'nengo-editor',
  label: 'Nengo Editor',
  canHandle: (input): input is LyraFile =>
    input instanceof LyraFile && isNengoFile(input),
  handle: async (input: LyraFile) => {
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
