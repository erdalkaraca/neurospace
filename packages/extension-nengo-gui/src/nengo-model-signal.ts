import { signal } from '@lit-labs/signals';

export type NengoModelSummary = {
  ensembles: string[];
  nodes: string[];
  probes: string[];
  connections: { pre: string; post: string; kind: string }[];
};

export type NengoSimData = {
  simData?: {
    trange: number[];
    probes: Record<string, number[]>;
    probeDims: Record<string, number>;
    probeLabels: Record<string, string>;
    ensembles: string[];
    nodes: string[];
    connections: { pre: string; post: string; kind: string }[];
    probesList: string[];
  };
  runOutput?: string;
  viewTime: number;
  simDurationTarget: number;
  running: boolean;
  simProgress: number;
  canRun: boolean;
};

export const nengoModelSummarySignal = signal<NengoModelSummary | undefined>(undefined);
export const nengoModelLoadingSignal = signal<boolean>(false);
export const nengoSimDataSignal = signal<NengoSimData>({
  viewTime: 0,
  simDurationTarget: 0,
  running: false,
  simProgress: 0,
  canRun: false,
});

export type NengoAddedVisualization = { objectId: string; objectType: 'node' | 'ensemble'; vizType: string };
export const nengoAddedVisualizationsSignal = signal<NengoAddedVisualization[]>([]);
export const nengoRunRequestSignal = signal<number>(0);
export const nengoStopRequestSignal = signal<number>(0);
export const nengoViewTimeRequestSignal = signal<number | undefined>(undefined);

export const nengoModelSyncRequestSignal = signal<number>(0);
