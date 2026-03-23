import { extensionRegistry } from '@eclipse-lyra/core';
import pkg from '../package.json';

extensionRegistry.registerExtension({
  id: pkg.name,
  name: 'Nengo editor',
  description: 'Nengo model editor with Python and live visualizations',
  loader: () => import('./nengo-gui-extension'),
  icon: 'brain',
});
