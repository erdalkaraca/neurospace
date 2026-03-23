import {
  appLoaderService,
  TOOLBAR_MAIN,
  type HTMLContribution,
} from '@eclipse-lyra/core';

import '@eclipse-lyra/extension-md-editor';
import '@eclipse-lyra/extension-media-viewer';
import '@eclipse-lyra/extension-memory-usage';
import '@eclipse-lyra/extension-monaco-editor';
import '@eclipse-lyra/extension-settings-tree';
import '@eclipse-lyra/extension-utils';
import '@eclipse-lyra/extension-catalog';
import '@eclipse-lyra/extension-ai-system';
import '@eclipse-lyra/extension-command-palette';
import '@eclipse-lyra/extension-github-service';
import '@eclipse-lyra/extension-howto-system';
import '@eclipse-lyra/extension-in-browser-ml';
import '@eclipse-lyra/extension-notebook';
import '@eclipse-lyra/extension-python-runtime';
import '@eclipse-lyra/extension-dataviewer';
import '@eclipse-lyra/extension-sqleditor';
import '@eclipse-lyra/extension-duckdb';
import '@eclipse-lyra/extension-pglite';

import '@kispace-io/extension-neuro-viewer';
import '@kispace-io/extension-snirf-viewer';
import '@kispace-io/extension-openneuro';
import '@kispace-io/extension-bids-editor';
import '@kispace-io/extension-bids-validator';
import '@kispace-io/extension-nengo-gui';

const appRoot = document.getElementById('app-root') ?? document.body;
appLoaderService.registerApp(
  {
    name: 'neuro!space',
    description: 'Neuromorphic cognitive modeling platform',
    layout: 'standard',
    metadata: {
      github: {
          owner: 'erdalkaraca',
          repo: 'neurospace'
      },
      favicon: '/logo.svg'
  },
    contributions: {
      ui: [
        {
          name: 'toolbar.brand.neurospace',
          target: TOOLBAR_MAIN,
          slot: 'start',
          label: 'Brand',
          component: `<span style="margin-right: 1rem; display: inline-flex; align-items: center;"><img src="/neurospace.svg" alt="neuro!space" style="height: 24px; display: block;" /></span>`,
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
      '@eclipse-lyra/extension-dataviewer',
      '@eclipse-lyra/extension-catalog',
      
      '@kispace-io/extension-neuro-viewer',
      '@kispace-io/extension-snirf-viewer',
      '@kispace-io/extension-openneuro',
      '@kispace-io/extension-bids-editor',
      '@kispace-io/extension-bids-validator',
      '@kispace-io/extension-nengo-gui',
    ],
  },
  { autoStart: true, hostConfig: true, container: appRoot },
);
