import type { Contribution } from '@eclipse-docks/core';
import type { TemplateResult } from '@eclipse-docks/core/externals/lit';

export const NENGO_VIZ_SLOT = 'nengo-editor.visualizations';

export type NengoObjectType = 'ensemble' | 'node' | 'connection' | 'network';

export interface NengoVizContext {
  simProxy: {
    trange: number[];
    getProbeData: (probeId: string) => number[];
    getSpikeData?: (probeId: string) => { times: number[]; neurons: number[] };
  };
  nengoObjectId: string;
  nengoObjectType: NengoObjectType;
  label?: string;
  config?: Record<string, unknown>;
}

export interface NengoVisualizationContribution extends Contribution {
  name: string;
  label: string;
  icon?: string;
  canVisualize: NengoObjectType[];
  component: (context: NengoVizContext) => TemplateResult;
}
