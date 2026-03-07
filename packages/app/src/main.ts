import 'pace-js/themes/blue/pace-theme-minimal.css';
import Pace from 'pace-js';
import { appLoaderService, applyAppHostConfig } from '@eclipse-lyra/core/api';
import appPkg from '../package.json';

Pace.start();

applyAppHostConfig({
  packageInfo: {
    name: appPkg.name,
    version: appPkg.version,
    dependencies: appPkg.dependencies,
    devDependencies: appPkg.devDependencies,
  },
});

import '@eclipse-lyra/extension-utils';
import '@eclipse-lyra/extension-command-palette';
import '@kispace-io/extension-neuro-viewer';

appLoaderService.registerApp(
  {
    id: 'neurospace-app',
    name: 'Neurospace',
    version: '0.0.0',
    description: 'Neuroimaging viewer for NIfTI and DICOM',
    extensions: [
      '@eclipse-lyra/extension-utils',
      '@eclipse-lyra/extension-command-palette',
      '@kispace-io/extension-neuro-viewer',
    ],
  },
  { autoStart: true }
);
