import {
  extensionRegistry,
  i18n,
  contributionRegistry,
} from '@eclipse-lyra/core';
import pkg from '../package.json';

const t = await i18n(import.meta.glob('./i18n*.json'), true);

extensionRegistry.registerExtension({
  id: pkg.name,
  name: t.EXT_OPENNEURO_NAME,
  description: t.EXT_OPENNEURO_DESC,
  loader: () => import('./openneuro-extension'),
  icon: 'database',
});
