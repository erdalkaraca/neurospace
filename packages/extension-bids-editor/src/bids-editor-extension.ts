import { EditorInput, File as LyraFile, editorRegistry } from '@eclipse-lyra/core';
import { html } from '@eclipse-lyra/core/externals/lit';

import './k-bids-editor';

const isDatasetDescription = (file: LyraFile): boolean =>
  file.getName() === 'dataset_description.json';

editorRegistry.registerEditorInputHandler({
  editorId: 'bids-editor',
  label: 'BIDS Editor',
  canHandle: (input): input is LyraFile =>
    input instanceof LyraFile && isDatasetDescription(input),
  handle: async (input: LyraFile) => {
    const editorInput: EditorInput = {
      title: input.getWorkspacePath(),
      data: input,
      key: `bids-editor-${input.getWorkspacePath()}`,
      icon: 'pencil',
      noOverflow: false,
      state: {},
      component: () => html`<k-bids-editor .input=${editorInput}></k-bids-editor>`,
    };
    return editorInput;
  },
  ranking: 1000,
});

