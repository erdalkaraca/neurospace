import 'pace-js/themes/blue/pace-theme-minimal.css';
import Pace from 'pace-js';
Pace.start();

import {
  appLoaderService,
  TOOLBAR_MAIN,
  type HTMLContribution,
} from '@eclipse-lyra/core/api';

import '@eclipse-lyra/extension-utils';
import '@eclipse-lyra/extension-command-palette';
import '@eclipse-lyra/extension-memory-usage';
import '@eclipse-lyra/extension-settings-tree';
import '@eclipse-lyra/extension-monaco-editor';
import '@eclipse-lyra/extension-python-runtime';
import '@eclipse-lyra/extension-md-editor';
import '@eclipse-lyra/extension-media-viewer';
import '@eclipse-lyra/extension-notebook';
import '@eclipse-lyra/extension-ai-system';
import '@kispace-io/extension-neuro-viewer';
import '@kispace-io/extension-snirf-viewer';
import '@kispace-io/extension-openneuro';

appLoaderService.registerApp(
  {
    layout: 'standard',
    contributions: {
      ui: [
        {
          target: TOOLBAR_MAIN,
          slot: 'start',
          label: 'Brand',
          component: `<span style="margin-right: 1rem;"><span><nobr>🧠<i><b>neuro!</b></i><small>space</small></nobr></span></span>`,
        } as HTMLContribution,
      ],
    },
    extensions: [
      '@eclipse-lyra/extension-utils',
      '@eclipse-lyra/extension-command-palette',
      '@eclipse-lyra/extension-memory-usage',
      '@eclipse-lyra/extension-settings-tree',
      '@eclipse-lyra/extension-monaco-editor',
      '@eclipse-lyra/extension-python-runtime',
      '@eclipse-lyra/extension-md-editor',
      '@eclipse-lyra/extension-media-viewer',
      '@eclipse-lyra/extension-notebook',
      '@eclipse-lyra/extension-ai-system',
      '@kispace-io/extension-neuro-viewer',
      '@kispace-io/extension-snirf-viewer',
      '@kispace-io/extension-openneuro',
    ],
  },
  { autoStart: true, hostConfig: true }
);
