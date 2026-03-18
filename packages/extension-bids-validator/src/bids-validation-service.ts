import { Directory, File as LyraFile, publish, taskService } from '@eclipse-lyra/core';
import type { ValidationResult } from '@bids/validator/main';
import { fileListToTree, validate } from '@bids/validator/main';
import type { DataView, TabularData } from '@eclipse-lyra/extension-dataviewer/api';
import { TOPIC_DATAVIEW_PUBLISH } from '@eclipse-lyra/extension-dataviewer/api';

type NativeFile = globalThis.File;

export interface BidsValidationProgress {
  message?: string;
  totalSteps?: number;
  currentStep?: number;
}

export type BidsValidationProgressReporter = (update: BidsValidationProgress) => void;

export interface BidsValidationOutput {
  summary: ValidationResult['summary'];
  issues: unknown[];
}

interface WorkspaceFileEntry {
  path: string;
  file: LyraFile;
}

async function collectDatasetFiles(root: Directory): Promise<WorkspaceFileEntry[]> {
  const results: WorkspaceFileEntry[] = [];
  const walk = async (dir: Directory, prefix: string) => {
    const children = await dir.listChildren(false);
    for (const child of children) {
      if (child instanceof Directory) {
        const nextPrefix = prefix ? `${prefix}/${child.getName()}` : child.getName();
        await walk(child, nextPrefix);
        continue;
      }
      if (child instanceof LyraFile) {
        const relPath = prefix ? `${prefix}/${child.getName()}` : child.getName();
        results.push({ path: relPath, file: child });
      }
    }
  };
  await walk(root, '');
  return results;
}

async function toBrowserFiles(entries: WorkspaceFileEntry[], datasetName: string): Promise<NativeFile[]> {
  const browserFiles: NativeFile[] = [];
  for (const { path, file } of entries) {
    const contents = await file.getContents({ blob: true });
    const blob = contents instanceof Blob ? contents : new Blob([contents as ArrayBuffer]);
    const browserFile = new globalThis.File([blob], file.getName(), {
      type: blob.type || 'application/octet-stream',
    });
    const rel = `${datasetName}/${path}`;
    Object.defineProperty(browserFile, 'webkitRelativePath', { value: rel });
    browserFiles.push(browserFile);
  }
  return browserFiles;
}

export function bidsIssuesToTabularData(issues: unknown[]): TabularData {
  const columns = ['severity', 'code', 'location', 'message'];
  const severityRank: Record<string, number> = { error: 0, warning: 1, info: 2 };
  const sorted = [...issues].sort((a: any, b: any) => {
    const sa = (a.severity ?? 'warning').toString().toLowerCase();
    const sb = (b.severity ?? 'warning').toString().toLowerCase();
    const ra = severityRank[sa] ?? 99;
    const rb = severityRank[sb] ?? 99;
    if (ra !== rb) return ra - rb;
    return (a.code ?? '').toString().localeCompare((b.code ?? '').toString());
  });
  const rows = sorted.map((issue: any) => [
    issue.severity ?? 'warning',
    issue.code ?? '',
    issue.location ?? issue.affects?.[0] ?? '',
    issue.reason ?? issue.issueMessage ?? '',
  ]);
  return { columns, rows };
}

function computeIssueStats(issues: unknown[]) {
  let errors = 0;
  let warnings = 0;
  for (const issue of issues as any[]) {
    const sev = (issue?.severity ?? 'warning').toString().toLowerCase();
    if (sev === 'error') errors++;
    else if (sev === 'warning') warnings++;
  }
  return { total: issues.length, errors, warnings };
}

export class BidsValidationService {
  public async validateDataset(
    datasetRoot: Directory,
    reportProgress?: BidsValidationProgressReporter,
  ): Promise<BidsValidationOutput> {
    reportProgress?.({ message: 'Collecting files...' });
    const entries = await collectDatasetFiles(datasetRoot);

    const datasetName = datasetRoot.getName() || 'dataset';
    reportProgress?.({
      totalSteps: entries.length || 1,
      currentStep: 0,
      message: 'Preparing files for validation...',
    });

    const browserFiles = await toBrowserFiles(entries, datasetName);
    reportProgress?.({ message: 'Building BIDS file tree...' });
    const tree = await fileListToTree(browserFiles as unknown as NativeFile[]);

    reportProgress?.({ message: 'Running BIDS validator...' });
    const options = {} as Parameters<typeof validate>[1];
    const result = await validate(tree, options);

    return {
      summary: result.summary,
      issues: (result as any).issues?.issues ?? [],
    };
  }

  public async runValidation(datasetRoot: Directory, opts?: { source?: string; title?: string }) {
    return await taskService.runAsync('Validate BIDS dataset', async (pm) => {
      const result = await this.validateDataset(datasetRoot, (u) => {
        if (u.message !== undefined) pm.message = u.message;
        if (u.totalSteps !== undefined) pm.totalSteps = u.totalSteps;
        if (u.currentStep !== undefined) pm.currentStep = u.currentStep;
      });
      pm.currentStep = pm.totalSteps;

      const datasetName = datasetRoot.getName() || 'dataset';
      const stats = computeIssueStats(result.issues);
      const statsSuffix = ` (total ${stats.total} · errors ${stats.errors} · warnings ${stats.warnings})`;
      const view: DataView = {
        title: opts?.title ?? `${datasetName}${statsSuffix}`,
        source: opts?.source ?? 'BIDS Validator',
        data: bidsIssuesToTabularData(result.issues),
      };
      publish(TOPIC_DATAVIEW_PUBLISH, view);

      return result;
    });
  }
}

export const bidsValidationService = new BidsValidationService();

