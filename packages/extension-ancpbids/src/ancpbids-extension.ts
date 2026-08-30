import { File as DocksFile, contributionRegistry, registerAll, toastError } from '@eclipse-docks/core';
import type { CommandContribution } from '@eclipse-docks/core';
import { BIDS_EDITOR_VALIDATE_TARGET } from '@kispace-io/extension-bids-editor';

import { ancpbidsService } from './ancpbids-service';
import './ancpbids-attribution';

const isDatasetDescription = (file: DocksFile): boolean =>
  file.getName() === 'dataset_description.json';

function getDatasetRootFromActiveEditor(activeEditor: unknown) {
  const input = (activeEditor as { input?: { data?: unknown } } | null | undefined)?.input;
  const data = input?.data;
  if (!(data instanceof DocksFile)) return null;
  if (!isDatasetDescription(data)) return null;
  return data.getParent();
}

registerAll({
  command: {
    id: 'ancpbids.validate',
    name: 'Validate BIDS dataset (ancpBIDS)',
    description: 'Loads and validates a BIDS dataset with ancpBIDS via Pyodide.',
  },
  handler: {
    canExecute: (context) => !!getDatasetRootFromActiveEditor(context.activeEditor),
    execute: async (context) => {
      const root = getDatasetRootFromActiveEditor(context.activeEditor);
      if (!root) return;
      try {
        await ancpbidsService.runValidation(root);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toastError(`ancpBIDS validation failed: ${msg}`);
      }
    },
  },
});

contributionRegistry.registerContribution<CommandContribution>(BIDS_EDITOR_VALIDATE_TARGET, {
  label: 'ancpBIDS',
  icon: 'clipboard-list',
  command: 'ancpbids.validate',
  ranking: 10,
});
