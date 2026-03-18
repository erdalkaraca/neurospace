import {
  EditorInput,
  File as LyraFile,
  editorRegistry
} from '@eclipse-lyra/core';
import { html } from '@eclipse-lyra/core/externals/lit';

import './bids-validator-editor';

const isDatasetDescription = (file: LyraFile): boolean =>
  file.getName() === 'dataset_description.json';

editorRegistry.registerEditorInputHandler({
  editorId: 'bids-validator',
  label: 'BIDS Validator',
  canHandle: (input): input is LyraFile =>
    input instanceof LyraFile && isDatasetDescription(input),
  handle: async (input: LyraFile) => {
    const editorInput: EditorInput = {
      title: input.getWorkspacePath(),
      data: input,
      key: "bids-validator-" + input.getWorkspacePath(),
      icon: 'brain',
      noOverflow: false,
      state: {},
      component: () =>
        html`<k-bids-validator-editor
          .input=${editorInput}
        ></k-bids-validator-editor>`,
    };
    return editorInput;
  },
  ranking: 1000,
});