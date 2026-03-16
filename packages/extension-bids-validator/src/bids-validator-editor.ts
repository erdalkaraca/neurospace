import {
  LyraPart,
  Directory,
  File as LyraFile,
  EditorInput,
  taskService,
  infoDialog,
  icon,
} from '@eclipse-lyra/core';
import { customElement, property, state, html, css } from '@eclipse-lyra/core/externals/lit';
import type { ValidationResult } from '@bids/validator/main';
import { fileListToTree, validate } from '@bids/validator/main';
import type { TabularData } from '@eclipse-lyra/extension-dataviewer/api';

type NativeFile = globalThis.File;

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
      } else if (child instanceof LyraFile) {
        const relPath = prefix ? `${prefix}/${child.getName()}` : child.getName();
        results.push({ path: relPath, file: child });
      }
    }
  };
  await walk(root, '');
  return results;
}

async function toBrowserFiles(
  entries: WorkspaceFileEntry[],
  datasetName: string,
): Promise<NativeFile[]> {
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

@customElement('k-bids-validator-editor')
export class KBidsValidatorEditor extends LyraPart {
  @property({ attribute: false })
  public input?: EditorInput;

  @state()
  private loading = false;

  @state()
  private error?: string;

  @state()
  private resultSummary: ValidationResult['summary'] | null = null;

  @state()
  private issues: unknown[] = [];

  public isEditor = true;

  protected renderToolbar() {
    const stats = this.computeIssueStats();
    return html`
      <wa-button
        size="small"
        appearance="plain"
        ?disabled=${this.loading}
        @click=${() => this.runValidation()}
      >
        ${icon('rotate-right')}
      </wa-button>
      ${this.resultSummary
        ? html`
            <wa-button
              size="small"
              appearance="plain"
              @click=${() => this.showSummaryDialog()}
            >
              ${icon('info')}
            </wa-button>
          `
        : null}
      <span>
        Issues: ${stats.total}
        ${stats.errors > 0 ? html` · Errors: ${stats.errors}` : null}
        ${stats.warnings > 0 ? html` · Warnings: ${stats.warnings}` : null}
      </span>
    `;
  }

  protected async doInitUI() {
    await this.runValidation();
  }

  private async getDatasetRootDir(): Promise<Directory> {
    if (!this.input?.data) throw new Error('No dataset_description.json file');
    const file = this.input.data as LyraFile;
    const parent = file.getParent();
    if (!parent) throw new Error('Dataset root directory not found');
    return parent;
  }

  private async runValidation() {
    this.loading = true;
    this.error = undefined;
    this.resultSummary = null;
    this.issues = [];

    try {
      const datasetRoot = await this.getDatasetRootDir();
      await taskService.runAsync('Validate BIDS dataset', async (pm) => {
        pm.message = 'Collecting files...';
        const entries = await collectDatasetFiles(datasetRoot);
        const datasetName = datasetRoot.getName() || 'dataset';
        pm.totalSteps = entries.length || 1;
        pm.currentStep = 0;
        pm.message = 'Preparing files for validation...';
        const browserFiles = await toBrowserFiles(entries, datasetName);
        pm.message = 'Building BIDS file tree...';
        const tree = await fileListToTree(browserFiles as unknown as NativeFile[]);
        pm.message = 'Running BIDS validator...';
        const options = {} as Parameters<typeof validate>[1];
        const result = await validate(tree, options);
        this.resultSummary = result.summary;
        this.issues = (result as any).issues?.issues ?? [];
        pm.currentStep = pm.totalSteps;
      });

      if (!this.resultSummary && this.issues.length === 0) {
        await infoDialog('BIDS validation', 'No issues reported.');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
      this.updateToolbar();
    }
  }

  private computeIssueStats() {
    let errors = 0;
    let warnings = 0;
    for (const issue of this.issues as any[]) {
      const sev = (issue.severity ?? 'warning').toString().toLowerCase();
      if (sev === 'error') errors++;
      else if (sev === 'warning') warnings++;
    }
    return {
      total: (this.issues as any[]).length,
      errors,
      warnings,
    };
  }

  private async showSummaryDialog() {
    const summaryText = this.resultSummary
      ? JSON.stringify(this.resultSummary, null, 2)
      : 'No summary available.';
    await infoDialog('BIDS validation summary', summaryText);
  }

  private get issuesTable(): TabularData {
    const columns = ['severity', 'code', 'location', 'message'];
    const severityRank: Record<string, number> = { error: 0, warning: 1, info: 2 };
    const sorted = [...this.issues].sort((a: any, b: any) => {
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

  protected render() {
    if (this.error) {
      return html`
        <div class="state state-error">
          <wa-icon name="triangle-exclamation"></wa-icon>
          <span>${this.error}</span>
        </div>
      `;
    }
    if (this.loading) {
      return html`
        <div class="state state-loading">
          <wa-spinner></wa-spinner>
          <span>Validating BIDS dataset...</span>
        </div>
      `;
    }
    return html`
      <div class="issues">
        ${this.issues.length === 0
          ? html`<p class="issues-empty">No issues found.</p>`
          : html`<lyra-data-table .data=${this.issuesTable}></lyra-data-table>`}
      </div>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      padding: var(--wa-space-m, 1rem);
      box-sizing: border-box;
      overflow: hidden;
    }
    .issues {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .issues lyra-data-table {
      flex: 1;
      min-height: 0;
    }
    .state {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .issues-empty {
      margin: 0;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'k-bids-validator-editor': KBidsValidatorEditor;
    'lyra-data-table': HTMLElement;
  }
}
