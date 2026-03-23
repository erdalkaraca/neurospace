import { signal } from '@lit-labs/signals';

export type NengoModelSummary = {
  ensembles: string[];
  nodes: string[];
  probes: string[];
  connections: { pre: string; post: string; kind: string }[];
};

export const nengoModelSummarySignal = signal<NengoModelSummary | undefined>(undefined);
export const nengoModelLoadingSignal = signal<boolean>(false);
