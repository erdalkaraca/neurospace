import type { File } from '@eclipse-docks/core';

export interface OpenNeuroFileEntry {
  id: string;
  filename: string;
  size: number;
  directory: boolean;
  annexed: boolean;
}

export interface OpenNeuroDatasetInfo {
  id: string;
  name?: string;
}

export interface OpenNeuroSnapshot {
  id: string;
  tag: string;
}

export interface FileWithPath {
  path: string;
  file: File;
}
