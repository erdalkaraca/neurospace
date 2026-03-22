import { extensionRegistry } from '@eclipse-lyra/core';
import pkg from '../package.json';

extensionRegistry.registerExtension({
  id: pkg.name,
  name: 'BIDS editor',
  description: 'BIDS editor components',
  loader: () => import('./bids-editor-extension'),
  icon: 'pencil',
});

