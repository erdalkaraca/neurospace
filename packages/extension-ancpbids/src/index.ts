import { extensionRegistry, i18n } from '@eclipse-docks/core';
import pkg from '../package.json';

const t = await i18n(import.meta.glob('./i18n*.json'), true);

extensionRegistry.registerExtension({
  id: pkg.name,
  name: t.EXT_ANCPBIDS_NAME,
  description: t.EXT_ANCPBIDS_DESC,
  loader: () => import('./ancpbids-extension'),
  icon: 'list-check',
});
