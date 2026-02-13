import 'pace-js/themes/blue/pace-theme-minimal.css';
import Pace from 'pace-js';
Pace.start();

import { appLoaderService, applyAppHostConfig } from '@kispace-io/core';
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
import '@neurospace/extension-neuro-viewer';
import '@neurospace/extension-snirf-viewer';

appLoaderService.registerApp(
  {
    id: 'neurospace-app',
    name: 'Neurospace',
    version: '0.0.0',
    description: 'Neuroimaging viewer for NIfTI and DICOM',
    extensions: [
      '@kispace-io/extension-utils',
      '@kispace-io/extension-command-palette',
      '@kispace-io/extension-memory-usage',
      '@kispace-io/extension-settings-tree',
      '@neurospace/extension-neuro-viewer',
      '@neurospace/extension-snirf-viewer',
    ],
  },
  { autoStart: true }
);
