/// <reference types="vite/client" />

declare module '*.json' {
  const value: Record<string, string>;
  export default value;
}

declare module '../content/manifest.json' {
  export interface ActrCatalogItem {
    label: string;
    filename: string;
    importPath: string;
    icon: string;
  }

  export interface ActrCatalogUnit {
    id: string;
    label: string;
    items: ActrCatalogItem[];
  }

  export interface ActrManifest {
    actrVersion: string;
    sourceUrl: string;
    fetchedAt: string;
    units: ActrCatalogUnit[];
  }

  const manifest: ActrManifest;
  export default manifest;
}
