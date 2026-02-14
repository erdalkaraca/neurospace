import 'pace-js/themes/blue/pace-theme-minimal.css';
import Pace from 'pace-js';
Pace.start();

import {
  appLoaderService,
  applyAppHostConfig,
  TOOLBAR_MAIN,
  type HTMLContribution,
} from '@kispace-io/core';
import appPkg from '../package.json';

applyAppHostConfig({
  packageInfo: {
    name: appPkg.name,
    version: appPkg.version,
    dependencies: appPkg.dependencies,
    devDependencies: appPkg.devDependencies,
  },
});

import '@kispace-io/extension-utils';
import '@kispace-io/extension-command-palette';
import '@kispace-io/extension-memory-usage';
import '@kispace-io/extension-settings-tree';
import '@kispace-io/extension-monaco-editor';
import '@kispace-io/extension-python-runtime';
import '@kispace-io/extension-md-editor';
import '@kispace-io/extension-media-viewer';
import '@kispace-io/extension-notebook';
import '@kispace-io/extension-ai-system';
import '@kispace-io/extension-neuro-viewer';
import '@kispace-io/extension-snirf-viewer';
import '@kispace-io/extension-openneuro';

appLoaderService.registerApp(
  {
    id: 'neurospace-app',
    name: '🧠neuro!space',
    version: '0.0.0',
    description: 'Neuromorphic cognitive modeling platform',
    contributions: {
      ui: [
        {
          target: TOOLBAR_MAIN,
          slot: 'start',
          label: 'Brand',
          html: `<span style="margin-right: 1rem;"><span><nobr>🧠<i><b>neuro!</b></i><small>space</small></nobr></span></span>`,
        } as HTMLContribution,
      ],
    },
    extensions: [
      '@kispace-io/extension-utils',
      '@kispace-io/extension-command-palette',
      '@kispace-io/extension-memory-usage',
      '@kispace-io/extension-settings-tree',
      '@kispace-io/extension-monaco-editor',
      '@kispace-io/extension-python-runtime',
      '@kispace-io/extension-md-editor',
      '@kispace-io/extension-media-viewer',
      '@kispace-io/extension-notebook',
      '@kispace-io/extension-ai-system',
      '@kispace-io/extension-neuro-viewer',
      '@kispace-io/extension-snirf-viewer',
      '@kispace-io/extension-openneuro',
    ],
  },
  { autoStart: true }
);
