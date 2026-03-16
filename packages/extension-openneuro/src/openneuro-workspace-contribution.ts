import {
  Directory,
  File,
  workspaceService,
  publish,
  TOPIC_WORKSPACE_CHANGED,
  type GetResourceOptions,
  type Resource,
} from '@eclipse-lyra/core';
import type { OpenNeuroFileEntry } from './types.js';
import {
  fetchSnapshotFiles,
  fetchLatestSnapshotTag,
  buildS3Url,
  fetchFile,
} from './openneuro-api.js';

const LIST_CACHE = new Map<string, OpenNeuroFileEntry[]>();

function listCacheKey(datasetId: string, tag: string, tree: string | undefined): string {
  return `${datasetId}:${tag}:${tree ?? ''}`;
}

async function getCachedList(
  datasetId: string,
  tag: string,
  tree: string | undefined
): Promise<OpenNeuroFileEntry[]> {
  const key = listCacheKey(datasetId, tag, tree);
  if (LIST_CACHE.has(key)) return LIST_CACHE.get(key)!;
  const entries = await fetchSnapshotFiles(datasetId, tag, tree);
  LIST_CACHE.set(key, entries);
  return entries;
}

function notifyWorkspaceChanged(): void {
  const workspace = workspaceService.getWorkspaceSync() ?? undefined;
  if (workspace) publish(TOPIC_WORKSPACE_CHANGED, workspace);
}

class LoadingPlaceholderFile extends File {
  constructor(private readonly parentDir: OpenNeuroVirtualDirectory) {
    super();
  }

  getName(): string {
    return 'Loading...';
  }

  getParent(): Directory | undefined {
    return this.parentDir;
  }

  async getContents(): Promise<unknown> {
    return null;
  }

  async saveContents(): Promise<void> {
    throw new Error('Read-only placeholder');
  }

  async size(): Promise<number | null> {
    return null;
  }

  async delete(): Promise<void> {
    throw new Error('Read-only placeholder');
  }

  async copyTo(): Promise<void> {
    throw new Error('Read-only placeholder');
  }

  async rename(): Promise<void> {
    throw new Error('Read-only placeholder');
  }
}

export class OpenNeuroVirtualFile extends File {
  constructor(
    private readonly datasetId: string,
    private readonly relativePath: string,
    private readonly parentDir: OpenNeuroVirtualDirectory,
    private readonly fileSize: number | null = null
  ) {
    super();
  }

  getName(): string {
    const segments = this.relativePath.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? this.relativePath;
  }

  getParent(): Directory | undefined {
    return this.parentDir;
  }

  async getContents(options?: { blob?: boolean }): Promise<unknown> {
    const url = buildS3Url(this.datasetId, this.relativePath);
    const res = await fetchFile(url);
    const blob = await res.blob();
    if (options?.blob) return blob;
    return blob;
  }

  async saveContents(_contents: unknown): Promise<void> {
    throw new Error('OpenNeuro virtual folder is read-only');
  }

  async size(): Promise<number | null> {
    return this.fileSize;
  }

  async delete(): Promise<void> {
    throw new Error('OpenNeuro virtual folder is read-only');
  }

  async copyTo(): Promise<void> {
    throw new Error('OpenNeuro virtual folder is read-only');
  }

  async rename(): Promise<void> {
    throw new Error('OpenNeuro virtual folder is read-only');
  }
}

export class OpenNeuroVirtualDirectory extends Directory {
  constructor(
    private readonly datasetId: string,
    private readonly tag: string,
    private readonly tree: string | undefined,
    private readonly displayName: string,
    private readonly pathPrefix: string,
    private readonly parentDir: OpenNeuroVirtualDirectory | undefined
  ) {
    super();
  }

  getName(): string {
    return this.displayName;
  }

  getParent(): Directory | undefined {
    return this.parentDir;
  }

  getDatasetId(): string {
    return this.datasetId;
  }

  getTag(): string {
    return this.tag;
  }

  async listChildren(forceRefresh: boolean): Promise<Resource[]> {
    const key = listCacheKey(this.datasetId, this.tag, this.tree);
    if (LIST_CACHE.has(key)) {
      return this.buildChildrenFromEntries(LIST_CACHE.get(key)!);
    }
    const isRoot = this.parentDir === undefined;
    const isExpand = !forceRefresh;
    if (isRoot || isExpand) {
      getCachedList(this.datasetId, this.tag, this.tree).then((entries) => {
        LIST_CACHE.set(key, entries);
        notifyWorkspaceChanged();
      });
      return [new LoadingPlaceholderFile(this)];
    }
    return [];
  }

  private buildChildrenFromEntries(entries: OpenNeuroFileEntry[]): Resource[] {
    const result: Resource[] = [];
    for (const e of entries) {
      if (e.directory) {
        result.push(
          new OpenNeuroVirtualDirectory(
            this.datasetId,
            this.tag,
            e.key,
            e.filename,
            this.pathPrefix ? `${this.pathPrefix}/${e.filename}` : e.filename,
            this
          )
        );
      } else {
        const relPath = this.pathPrefix ? `${this.pathPrefix}/${e.filename}` : e.filename;
        result.push(
          new OpenNeuroVirtualFile(this.datasetId, relPath, this, e.size ?? null)
        );
      }
    }
    return result.sort((a, b) => a.getName().localeCompare(b.getName()));
  }

  async getResource(path: string, options?: GetResourceOptions): Promise<Resource | null> {
    if (options?.create) return null;
    const normalized = path?.replace(/^\/+/, '').trim();
    if (!normalized) return null;
    const segments = normalized.split('/').filter(Boolean);
    let current: OpenNeuroVirtualDirectory = this;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const entries = await getCachedList(
        current.datasetId,
        current.tag,
        current.tree
      );
      const entry = entries.find((e) => e.filename === segment);
      if (!entry) return null;
      if (entry.directory) {
        const nextPrefix = current.pathPrefix
          ? `${current.pathPrefix}/${entry.filename}`
          : entry.filename;
        current = new OpenNeuroVirtualDirectory(
          current.datasetId,
          current.tag,
          entry.key,
          entry.filename,
          nextPrefix,
          current
        );
        if (i === segments.length - 1) return current;
      } else {
        if (i !== segments.length - 1) return null;
        const relPath = current.pathPrefix
          ? `${current.pathPrefix}/${entry.filename}`
          : entry.filename;
        return new OpenNeuroVirtualFile(
          current.datasetId,
          relPath,
          current,
          entry.size ?? null
        );
      }
    }
    return current;
  }

  touch(): void {
    LIST_CACHE.delete(listCacheKey(this.datasetId, this.tag, this.tree));
    notifyWorkspaceChanged();
  }

  async delete(): Promise<void> {
    throw new Error('OpenNeuro virtual folder is read-only');
  }

  async copyTo(): Promise<void> {
    throw new Error('OpenNeuro virtual folder is read-only');
  }

  async rename(): Promise<void> {
    throw new Error('OpenNeuro virtual folder is read-only');
  }
}

workspaceService.registerContribution({
  type: 'openneuro',
  name: 'openneuro+readonly',

  canHandle(input: unknown): boolean {
    return (
      typeof input === 'object' &&
      input !== null &&
      (input as { openneuro?: boolean }).openneuro === true &&
      typeof (input as { datasetId?: string }).datasetId === 'string'
    );
  },

  async connect(input: {
    openneuro: true;
    datasetId: string;
    name?: string;
  }): Promise<Directory> {
    const datasetId = (input.datasetId ?? '').trim().toLowerCase();
    if (!datasetId) throw new Error('OpenNeuro dataset ID is required');
    const tag = await fetchLatestSnapshotTag(datasetId);
    const name = (input.name?.trim() || datasetId) as string;
    return new OpenNeuroVirtualDirectory(
      datasetId,
      tag,
      undefined,
      name,
      '',
      undefined
    );
  },

  async restore(data: unknown): Promise<Directory | undefined> {
    if (
      typeof data !== 'object' ||
      data === null ||
      (data as { openneuro?: boolean }).openneuro !== true
    ) {
      return undefined;
    }
    const { datasetId, tag, name } = data as {
      datasetId?: string;
      tag?: string;
      name?: string;
    };
    if (typeof datasetId !== 'string' || !datasetId.trim()) return undefined;
    const id = datasetId.trim().toLowerCase();
    const resolvedTag =
      typeof tag === 'string' && tag.trim()
        ? tag.trim()
        : await fetchLatestSnapshotTag(id);
    const displayName = (name?.trim() || id) as string;
    return new OpenNeuroVirtualDirectory(
      id,
      resolvedTag,
      undefined,
      displayName,
      '',
      undefined
    );
  },

  async persist(workspace: Directory): Promise<unknown> {
    if (
      workspace instanceof OpenNeuroVirtualDirectory &&
      workspace.getParent() === undefined
    ) {
      return {
        openneuro: true,
        datasetId: workspace.getDatasetId(),
        tag: workspace.getTag(),
        name: workspace.getName(),
      };
    }
    return null;
  },
});
