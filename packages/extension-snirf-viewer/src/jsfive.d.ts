declare module 'jsfive' {
  export class File {
    constructor(buffer: ArrayBuffer, filename?: string);
    get(path: string): Group | Dataset;
    keys: string[];
  }

  export class Group {
    get(path: string): Group | Dataset;
    keys: string[];
    attrs: Record<string, unknown>;
  }

  export class Dataset {
    value: unknown;
    shape: number[];
    attrs: Record<string, unknown>;
  }
}
