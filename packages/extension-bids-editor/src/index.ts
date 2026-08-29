import { extensionRegistry } from '@eclipse-docks/core';
import pkg from '../package.json';

export { BIDS_EDITOR_VALIDATE_TARGET } from './contributions';

extensionRegistry.registerExtension({
  id: pkg.name,
  name: 'BIDS editor',
  description: 'BIDS editor components',
  loader: () => import('./bids-editor-extension'),
  icon: 'pencil',
});

