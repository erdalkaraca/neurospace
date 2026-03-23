import { contributionRegistry } from '@eclipse-lyra/core';
import { html } from '@eclipse-lyra/core/externals/lit';
import type { NengoVisualizationContribution } from './nengo-viz-api';
import { NENGO_VIZ_SLOT } from './nengo-viz-api';

import './viz/nengo-value-plot';
import './viz/nengo-raster-plot';
import './viz/nengo-netgraph';

contributionRegistry.registerContribution<NengoVisualizationContribution>(
  NENGO_VIZ_SLOT,
  {
    name: 'value',
    label: 'Value plot',
    icon: 'chart-line',
    canVisualize: ['ensemble', 'node'],
    component: (ctx) => html`<nengo-value-plot .context=${ctx}></nengo-value-plot>`,
  }
);

contributionRegistry.registerContribution<NengoVisualizationContribution>(
  NENGO_VIZ_SLOT,
  {
    name: 'raster',
    label: 'Raster plot',
    icon: 'braille',
    canVisualize: ['ensemble'],
    component: (ctx) => html`<nengo-raster-plot .context=${ctx}></nengo-raster-plot>`,
  }
);

contributionRegistry.registerContribution<NengoVisualizationContribution>(
  NENGO_VIZ_SLOT,
  {
    name: 'netgraph',
    label: 'Network graph',
    icon: 'project-diagram',
    canVisualize: ['network'],
    component: (ctx) => html`<nengo-netgraph .context=${ctx}></nengo-netgraph>`,
  }
);
