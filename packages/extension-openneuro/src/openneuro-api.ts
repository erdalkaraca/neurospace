import { Directory, File } from '@kispace-io/core';
import type { OpenNeuroFileEntry } from './types.js';

const GRAPHQL_ENDPOINT = 'https://openneuro.org/crn/graphql';
const S3_BASE = 'https://s3.us-east-1.amazonaws.com/openneuro.org';

export async function fetchDatasetInfo(datasetId: string): Promise<{
  dataset: { id: string; name?: string };
  snapshot?: { id: string; tag: string };
}> {
  const query = `
    query($datasetId: ID!) {
      dataset(id: $datasetId) {
        id
        name
      }
    }
  `;
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { datasetId } }),
  });
  if (!res.ok) {
    throw new Error(`OpenNeuro API error: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { data?: { dataset?: { id: string; name?: string } }; errors?: unknown[] };
  if (json.errors?.length) {
    throw new Error(`OpenNeuro GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  const dataset = json.data?.dataset;
  if (!dataset) {
    throw new Error(`Dataset ${datasetId} not found`);
  }
  return { dataset };
}

async function fetchSnapshotFiles(
  datasetId: string,
  tag: string,
  tree?: string
): Promise<OpenNeuroFileEntry[]> {
  const query = `
    query($datasetId: ID!, $tag: String!, $tree: String) {
      snapshot(datasetId: $datasetId, tag: $tag) {
        files(tree: $tree) {
          id
          key
          filename
          size
          directory
          annexed
        }
      }
    }
  `;
  const variables: Record<string, string> = { datasetId, tag };
  if (tree) variables.tree = tree;
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`OpenNeuro API error: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as {
    data?: { snapshot?: { files?: OpenNeuroFileEntry[] } };
    errors?: unknown[];
  };
  if (json.errors?.length) {
    throw new Error(`OpenNeuro GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data?.snapshot?.files ?? [];
}

export async function fetchLatestSnapshotTag(datasetId: string): Promise<string> {
  const query = `
    query($datasetId: ID!) {
      dataset(id: $datasetId) {
        id
        latestSnapshot {
          tag
        }
      }
    }
  `;
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { datasetId } }),
  });
  if (!res.ok) {
    throw new Error(`OpenNeuro API error: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as {
    data?: { dataset?: { latestSnapshot?: { tag: string } } };
    errors?: unknown[];
  };
  if (json.errors?.length) {
    throw new Error(`OpenNeuro GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  const tag = json.data?.dataset?.latestSnapshot?.tag;
  if (!tag) {
    throw new Error(`No snapshots found for dataset ${datasetId}`);
  }
  return tag;
}

export async function collectFilesRecursive(
  datasetId: string,
  tag: string,
  tree?: string,
  pathPrefix = ''
): Promise<{ path: string; size: number }[]> {
  const entries = await fetchSnapshotFiles(datasetId, tag, tree);
  const files: { path: string; size: number }[] = [];
  for (const e of entries) {
    const relPath = pathPrefix ? `${pathPrefix}/${e.filename}` : e.filename;
    if (e.directory) {
      const sub = await collectFilesRecursive(datasetId, tag, e.key, relPath);
      files.push(...sub);
    } else {
      files.push({ path: relPath, size: e.size });
    }
  }
  return files;
}

export function buildS3Url(datasetId: string, relativePath: string, _snapshotTag?: string): string {
  const key = `${datasetId}/${relativePath}`;
  return `${S3_BASE}/${key}`;
}

export async function fetchFile(url: string): Promise<Response> {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }
  return res;
}

export async function listWorkspaceFilesRecursive(
  dir: Directory,
  basePath: string
): Promise<{ path: string; file: File }[]> {
  const result: { path: string; file: File }[] = [];
  const children = await dir.listChildren(false);
  for (const child of children) {
    const name = child.getName();
    const relPath = basePath ? `${basePath}/${name}` : name;
    if (child instanceof Directory) {
      const sub = await listWorkspaceFilesRecursive(child as Directory, relPath);
      result.push(...sub);
    } else if (child instanceof File) {
      result.push({ path: relPath, file: child as File });
    }
  }
  return result;
}
