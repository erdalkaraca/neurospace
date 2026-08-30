import {
  DocksPart,
  EditorInput,
  File as DocksFile,
  activeEditorSignal,
} from '@eclipse-docks/core';
import { customElement, property, state, html, css, createRef, ref } from '@eclipse-docks/core/externals/lit';

import { actrCheerpXService } from './actr-cheerpx-service';
import { formatActrTextTrace } from './actr-trace-format';

export const ACTR_EDITOR_ID = 'actr-editor';

/** Fired on `NsActrEditor` when state relevant to companion panels changes. */
export const ACTR_COMPANION_UPDATE = 'actr-companion-update';

export type ActrTraceSnapshot = {
  status: string;
  textTrace: string;
  running: boolean;
  canRun: boolean;
};

@customElement('ns-actr-editor')
export class NsActrEditor extends DocksPart {
  @property({ attribute: false })
  public input?: EditorInput;

  @state()
  private loading = false;

  @state()
  private error?: string;

  @state()
  private initialContent?: string;

  @state()
  private uri?: string;

  @state()
  private running = false;

  @state()
  private runStatus = '';

  @state()
  private textTrace = '';

  private widgetRef = createRef<any>();

  public isEditor = true;

  protected override scrollMode = 'native' as const;

  protected override updated(changedProperties: Map<string, unknown>): void {
    super.updated?.(changedProperties);
    const companionKeys = new Set(['runStatus', 'textTrace', 'running', 'loading']);
    if ([...changedProperties.keys()].some((k) => companionKeys.has(k))) {
      this.dispatchEvent(new CustomEvent(ACTR_COMPANION_UPDATE));
    }
  }

  public getCompanionTraceSnapshot(): ActrTraceSnapshot {
    return {
      status: this.runStatus,
      textTrace: this.textTrace,
      running: this.running,
      canRun: this.canRun,
    };
  }

  protected async doInitUI() {
    this.loading = true;
    this.error = undefined;
    this.initialContent = undefined;
    this.uri = undefined;
    this.runStatus = '';
    this.textTrace = '';

    try {
      const data = this.input?.data;
      if (!(data instanceof DocksFile)) throw new Error('No file input available');
      const raw = await data.getContents();
      const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as ArrayBuffer);
      this.initialContent = text;
      this.uri = data.getWorkspacePath();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private onContentChange = () => {
    this.markDirty(true);
  };

  public override save() {
    const data = this.input?.data;
    if (!(data instanceof DocksFile)) return;
    const value = this.widgetRef.value?.getContent?.() ?? '';
    data.saveContents(value);
    this.markDirty(false);
  }

  private get language(): string {
    return this.uri?.toLowerCase().endsWith('.lisp') ? 'actr-lisp' : 'plaintext';
  }

  private get canRun(): boolean {
    return this.language === 'actr-lisp' && !this.running && !this.loading;
  }

  private onRun = async () => {
    if (!this.canRun) return;

    const source = this.widgetRef.value?.getContent?.() ?? this.initialContent ?? '';
    if (!source.trim()) {
      this.runStatus = 'Nothing to run';
      this.textTrace = '';
      return;
    }

    this.running = true;
    this.runStatus = 'Starting…';
    this.textTrace = '';

    try {
      const result = await actrCheerpXService.runLisp(source, {
        seconds: 10,
        onProgress: (message) => {
          this.runStatus = message;
        },
      });

      const meta = [
        result.version ? `ACT-R ${result.version}` : null,
        `load → ${JSON.stringify(result.load.result)}`,
        `run  → ${JSON.stringify(result.run.result)}`,
      ].filter(Boolean);

      this.textTrace = formatActrTextTrace(result.console);
      this.runStatus = meta.join(' · ') || 'Done';
    } catch (err) {
      this.runStatus = 'Failed';
      this.textTrace = err instanceof Error ? err.message : String(err);
    } finally {
      this.running = false;
    }
  };

  protected override renderToolbar() {
    const title = this.language === 'actr-lisp'
      ? 'Load model into in-browser ACT-R and run for 10s'
      : 'Run is only available for .lisp ACT-R models';

    return html`
      <wa-button
        appearance="plain"
        size="s"
        ?disabled=${!this.canRun}
        title=${title}
        @click=${this.onRun}
      >
        <wa-icon name="play" slot="prefix"></wa-icon>
        ${this.running ? 'Running…' : 'Run'}
      </wa-button>
    `;
  }

  protected override doClose(): void {
    this.widgetRef.value?.dispose?.();
  }

  protected renderContent() {
    if (this.error) {
      return html`<div class="state state-error">${this.error}</div>`;
    }
    if (this.loading) {
      return html`<div class="state state-loading"><wa-spinner></wa-spinner></div>`;
    }
    if (this.initialContent === undefined) {
      return html`<div class="editor-placeholder"></div>`;
    }

    return html`
      <div class="editor-container">
        <docks-monaco-widget
          .value=${this.initialContent}
          .uri=${this.uri}
          language=${this.language}
          @content-change=${this.onContentChange}
          ${ref(this.widgetRef)}
        ></docks-monaco-widget>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 0;
    }

    :host .part-shell {
      flex: 1;
      min-height: 0;
    }

    :host .part-content-inner {
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .editor-container {
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    .editor-container docks-monaco-widget {
      display: block;
      height: 100%;
      width: 100%;
    }

    .editor-placeholder {
      flex: 1;
      min-height: 0;
    }

    .state {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--wa-space-m, 1rem);
      box-sizing: border-box;
    }

    .state-error {
      color: var(--wa-color-danger-fill-loud);
    }
  `;
}

export function getActiveActrEditor(): NsActrEditor | null {
  const el = activeEditorSignal.get();
  return el instanceof NsActrEditor ? el : null;
}

declare global {
  interface HTMLElementTagNameMap {
    'ns-actr-editor': NsActrEditor;
  }
}
