import { File as LyraFile, contributionRegistry, registerAll, toastError } from '@eclipse-lyra/core';
import type { CommandContribution } from '@eclipse-lyra/core';

import { bidsValidationService } from './bids-validation-service';

const isDatasetDescription = (file: LyraFile): boolean =>
  file.getName() === 'dataset_description.json';

function getDatasetRootFromActiveEditor(activeEditor: any) {
  const input = activeEditor?.input;
  const data = input?.data;
  if (!(data instanceof LyraFile)) return null;
  if (!isDatasetDescription(data)) return null;
  return data.getParent();
}

registerAll({
  command: {
    id: 'bids.validate',
    name: 'Validate BIDS dataset',
    description: 'Runs the BIDS validator and publishes results to DataView.',
    icon: 'check',
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

contributionRegistry.registerContribution<CommandContribution>('toolbar:bids-editor', {
  label: 'Validate',
  icon: 'check',
  command: 'bids.validate',
  showLabel: true,
});