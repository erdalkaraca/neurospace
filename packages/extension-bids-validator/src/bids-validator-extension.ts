import { File as DocksFile, contributionRegistry, registerAll, toastError } from '@eclipse-docks/core';
import type { CommandContribution } from '@eclipse-docks/core';
import { BIDS_EDITOR_VALIDATE_TARGET } from '@kispace-io/extension-bids-editor';

import { bidsValidationService } from './bids-validation-service';
import './bids-validator-attribution';

const isDatasetDescription = (file: DocksFile): boolean =>
  file.getName() === 'dataset_description.json';

function getDatasetRootFromActiveEditor(activeEditor: any) {
  const input = activeEditor?.input;
  const data = input?.data;
  if (!(data instanceof DocksFile)) return null;
  if (!isDatasetDescription(data)) return null;
  return data.getParent();
}

registerAll({
  command: {
    id: 'bids.validate',
    name: 'Validate BIDS dataset',
    description: 'Runs the BIDS validator and publishes results to DataView.',
    icon: 'clipboard-list',
  },
  handler: {
    canExecute: (context) => !!getDatasetRootFromActiveEditor(context.activeEditor),
    execute: async (context) => {
      const root = getDatasetRootFromActiveEditor(context.activeEditor);
      if (!root) return;
      try {
        await bidsValidationService.runValidation(root);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toastError(`BIDS validation failed: ${msg}`);
      }
    },
  },
});

contributionRegistry.registerContribution<CommandContribution>(BIDS_EDITOR_VALIDATE_TARGET, {
  label: 'BIDS Validator',
  icon: 'clipboard-list',
  command: 'bids.validate',
  ranking: 0,
});