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
import '@neurospace/extension-neuro-viewer';

appLoaderService.registerApp(
  {
    id: 'neurospace-app',
    name: 'Neurospace',
    version: '0.0.0',
    description: 'Neuroimaging viewer for NIfTI and DICOM',
    extensions: [
      '@kispace-io/extension-utils',
      '@kispace-io/extension-command-palette',
      '@neurospace/extension-neuro-viewer',
    ],
  },
  { autoStart: true }
);
