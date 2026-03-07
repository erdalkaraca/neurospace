export interface OpenNeuroFileEntry {
  id: string;
  key: string;
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
  file: import('@eclipse-lyra/core/api').File;
}
