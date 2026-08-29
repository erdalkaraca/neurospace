import {
  appLoaderService,
  TOOLBAR_MAIN,
  type HTMLContribution,
} from '@eclipse-docks/core';

const appRoot = document.getElementById('app-root') ?? document.body;
appLoaderService.registerApp(
  {
    name: 'neuro!space',
    description: 'Scientific Platform for Hybrid Cognitive Architectures',
    layout: {
      id: 'standard',
      props: {
        showLeftSidebar: true,
        showAuxSidebar: true,
        showBottomPanel: true,
        showLeftAux: false,
        showRightAux: false,
      },
    },
    metadata: {
      github: {
        owner: 'erdalkaraca',
        repo: 'neurospace',
      },
      favicon: '/logo.svg',
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
      '@eclipse-docks/extension-utils',
      '@eclipse-docks/extension-pwa',
      '@eclipse-docks/extension-command-palette',
      '@eclipse-docks/extension-memory-usage',
      '@eclipse-docks/extension-settings-tree',
      '@eclipse-docks/extension-monaco-editor',
      '@eclipse-docks/extension-python-runtime',
      '@eclipse-docks/extension-md-editor',
      '@eclipse-docks/extension-media-viewer',
      '@eclipse-docks/extension-notebook',
      '@eclipse-docks/extension-ai-system',
      '@eclipse-docks/extension-dataviewer',
      '@eclipse-docks/extension-catalog',
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
