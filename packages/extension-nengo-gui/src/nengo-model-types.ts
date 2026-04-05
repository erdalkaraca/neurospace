/** Shared types for Nengo editor ↔ companion panels (no global mutable state). */

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

export type NengoAddedVisualization = {
  objectId: string;
  objectType: 'node' | 'ensemble';
  vizType: string;
};
