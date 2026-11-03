import {
  appLoaderService,
  TOOLBAR_MAIN,
  type HTMLContribution,
} from '@eclipse-docks/core';
import {
  SYSTEM_CANVASES,
  type CanvasContribution,
} from '@eclipse-docks/extension-canvas/contribution';
import { fetchReleases } from '@eclipse-docks/extension-github-service';
import attentionalBlinkSource from './canvas/attentional-blink.canvas.js?raw';

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

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
      favicon: assetUrl('logo.svg'),
    },
    releaseHistory: fetchReleases,
    contributions: {
      ui: [
        {
          name: 'toolbar.brand.neurospace',
          target: TOOLBAR_MAIN,
          slot: 'start',
          label: 'Brand',
          component: `<span style="margin-right: 1rem; display: inline-flex; align-items: center; gap: 0.5rem; color: #2299dd; font-size: 1.05rem; letter-spacing: -0.02em; line-height: 1;">
            <img src="${assetUrl('logo.svg')}" alt="" style="height: 22px; width: 22px; display: block;" />
            <span aria-label="neuro!space"><b style="font-weight: 700;">neuro!</b><i style="font-weight: 500; font-style: italic;">space</i></span>
          </span>`,
        } as HTMLContribution,
        {
          name: 'attentional-blink',
          target: SYSTEM_CANVASES,
          label: 'Attentional blink',
          icon: 'eye',
          settingsKey: 'canvas.neurospace.attentional-blink',
          source: attentionalBlinkSource,
        } as CanvasContribution,
      ],
    },
    extensions: [
      '@eclipse-docks/extension-utils',
      '@eclipse-docks/extension-github-service',
      '@eclipse-docks/extension-pwa',
      '@eclipse-docks/extension-command-palette',
      '@eclipse-docks/extension-memory-usage',
      '@eclipse-docks/extension-settings-tree',
      '@eclipse-docks/extension-monaco-editor',
      '@eclipse-docks/extension-python-runtime',
      '@eclipse-docks/extension-md-editor',
      '@eclipse-docks/extension-media-viewer',
      '@eclipse-docks/extension-notebook',
      '@eclipse-docks/extension-dataviewer',
      '@eclipse-docks/extension-catalog',
      '@eclipse-docks/extension-canvas',
      '@eclipse-docks/extension-ai-system',
      '@kispace-io/extension-neuro-viewer',
      '@kispace-io/extension-snirf-viewer',
      '@kispace-io/extension-openneuro',
      '@kispace-io/extension-bids-editor',
      '@kispace-io/extension-bids-validator',
      '@kispace-io/extension-ancpbids',
      '@kispace-io/extension-nengo-gui',
      '@kispace-io/extension-actr',
    ],
  },
  { autoStart: true, hostConfig: true, container: appRoot },
);
