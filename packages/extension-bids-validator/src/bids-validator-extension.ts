import {
  editorRegistry,
  File as LyraFile,
  EditorInput,
  registerAll,
  contributionRegistry,
  toastError,
  activeSelectionSignal,
} from '@eclipse-lyra/core';
import { html } from '@eclipse-lyra/core/externals/lit';

import './bids-validator-editor';

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
      key: "bids-editor-" + input.getWorkspacePath(),
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

function getSelectedDatasetDescription(): LyraFile | null {
  const sel = activeSelectionSignal.get();
  if (sel instanceof LyraFile && isDatasetDescription(sel)) return sel;
  return null;
}