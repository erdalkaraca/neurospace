import { extensionRegistry, i18n } from '@eclipse-lyra/core';
import pkg from '../package.json';

const t = await i18n(import.meta.glob('./i18n*.json'), true).catch(() => ({} as any));

extensionRegistry.registerExtension({
  id: pkg.name,
  name: (t && (t.EXT_BIDS_VALIDATOR_NAME as string)) || 'BIDS validator',
  description: (t && (t.EXT_BIDS_VALIDATOR_DESC as string)) || 'Validate BIDS datasets',
  loader: () => import('./bids-validator-extension'),
  icon: 'check',
});


