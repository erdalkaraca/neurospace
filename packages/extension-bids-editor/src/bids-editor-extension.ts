import { EditorInput, File as DocksFile, editorRegistry } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';

import './k-bids-editor';

const isDatasetDescription = (file: DocksFile): boolean =>
  file.getName() === 'dataset_description.json';

editorRegistry.registerEditorInputHandler({
  editorId: 'bids-editor',
  label: 'BIDS Editor',
  canHandle: (input): input is DocksFile =>
    input instanceof DocksFile && isDatasetDescription(input),
  handle: async (input: DocksFile) => {
    const editorInput: EditorInput = {
      title: input.getWorkspacePath(),
      data: input,
      key: `bids-editor-${input.getWorkspacePath()}`,
      icon: 'pencil',
      state: {},
      component: (id: string) => html`<k-bids-editor id="${id}" .input=${editorInput}></k-bids-editor>`,
    };
    return editorInput;
  },
  ranking: 1000,
});

