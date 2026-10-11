import {
  DocksPart,
  EditorInput,
  File as DocksFile,
  activeEditorSignal,
  toastError,
} from '@eclipse-docks/core';
import {
  customElement,
  property,
  state,
  html,
  css,
  createRef,
  ref,
  styleMap,
} from '@eclipse-docks/core/externals/lit';
import { terminalService, type Terminal } from '@eclipse-docks/extension-terminal/api';
import '@eclipse-docks/extension-monaco-editor/widget';
import type { DocksMonacoWidget } from '@eclipse-docks/extension-monaco-editor/widget';

import {
  ACTR_BIND_ENV,
  attachActrTerminal,
  detachActrTerminal,
  waitActrBind,
} from './actr-console-registry';
import type { ActrProcess } from './actr-cheerpx-service';
import { ACTR_TERMINAL_PROFILE_ID } from './actr-terminal-backend';
import { reduceDebugView, type DebugView } from './actr-debug-model';
import {
  applyProductionHighlight,
  clearActrDebugSession,
  clearProductionHighlight,
  setActrDebugSession,
} from './actr-debug-monaco';

export const ACTR_EDITOR_ID = 'actr-editor';

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
  private stepping = false;

  @state()
  private debugging = false;

  @state()
  private debugDone = false;

  @state()
  private actrConnecting = false;

  @state()
  private actrConnected = false;

  @state()
  private actrVersion = '';

  @state()
  private boundTerminalId: string | null = null;

  private boundProcess: ActrProcess | null = null;
  private widgetRef = createRef<DocksMonacoWidget>();
  private unsubTerminalClosed?: () => void;
  private debugView: DebugView | null = null;

  public isEditor = true;

  protected override scrollMode = 'native' as const;

  protected override doBeforeUI(): void {
    this.watch(activeEditorSignal, () => {
      if (activeEditorSignal.get() === this) {
        void this.revealBoundConsole();
      }
    });
    this.unsubTerminalClosed = terminalService.onDidCloseTerminal((terminal) => {
      if (terminal.id === this.boundTerminalId) {
        this.clearBinding();
      }
    });
  }

  override disconnectedCallback(): void {
    this.unsubTerminalClosed?.();
    this.unsubTerminalClosed = undefined;
    super.disconnectedCallback();
  }

  protected async doInitUI() {
    this.loading = true;
    this.error = undefined;
    this.initialContent = undefined;
    this.uri = undefined;

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
    if (this.debugging) this.showDebugView();
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

  private get modelLabel(): string {
    const path = this.uri ?? 'model.lisp';
    const parts = path.split('/');
    return parts[parts.length - 1] || 'ACT-R';
  }

  private get canRun(): boolean {
    return (
      this.language === 'actr-lisp' &&
      !this.running &&
      !this.stepping &&
      !this.debugging &&
      !this.loading &&
      !this.actrConnecting
    );
  }

  private get canStep(): boolean {
    return (
      this.language === 'actr-lisp' &&
      !this.running &&
      !this.stepping &&
      !this.debugDone &&
      !this.loading &&
      !this.actrConnecting
    );
  }

  private clearBinding(): void {
    if (this.boundTerminalId) {
      detachActrTerminal(this.boundTerminalId);
    }
    this.boundTerminalId = null;
    this.boundProcess = null;
    this.actrConnected = false;
    this.actrVersion = '';
    this.actrConnecting = false;
    this.endDebugSession();
    this.requestUpdate();
  }

  private disposeBoundConsole(): void {
    const terminalId = this.boundTerminalId;
    if (!terminalId) return;
    const terminal = terminalService.getTerminals().find((t) => t.id === terminalId);
    this.clearBinding();
    void terminal?.dispose();
  }

  private async revealBoundConsole(): Promise<void> {
    if (!this.boundTerminalId) return;
    const terminal = terminalService.getTerminals().find((t) => t.id === this.boundTerminalId);
    terminal?.show(true);
  }

  private async ensureConsole(): Promise<{ terminal: Terminal; process: ActrProcess }> {
    if (this.boundTerminalId && this.boundProcess && this.actrConnected) {
      const existing = terminalService.getTerminals().find((t) => t.id === this.boundTerminalId);
      if (existing) {
        existing.show(true);
        return { terminal: existing, process: this.boundProcess };
      }
      this.clearBinding();
    }

    const bindId = crypto.randomUUID();
    const terminal = await terminalService.createTerminal({
      profileId: ACTR_TERMINAL_PROFILE_ID,
      name: this.modelLabel,
      env: { [ACTR_BIND_ENV]: bindId },
    });
    if (!terminal) {
      throw new Error('Failed to create ACT-R terminal');
    }

    // Show the console immediately; ACT-R continues booting inside the backend.
    this.boundTerminalId = terminal.id;
    terminal.show(true);

    const process = await waitActrBind(bindId);
    attachActrTerminal(terminal.id, process);
    this.boundProcess = process;
    this.actrConnected = true;
    this.actrVersion = process.version || 'ready';
    terminal.show(true);
    return { terminal, process };
  }

  private onConnect = async () => {
    if (this.actrConnecting || this.actrConnected || this.language !== 'actr-lisp') return;
    this.actrConnecting = true;
    try {
      await this.ensureConsole();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toastError(message);
      this.disposeBoundConsole();
    } finally {
      this.actrConnecting = false;
    }
  };

  private onRun = async () => {
    if (!this.canRun || !this.actrConnected || !this.boundProcess) return;

    const source = this.widgetRef.value?.getContent?.() ?? this.initialContent ?? '';
    if (!source.trim()) {
      toastError('Nothing to run');
      return;
    }

    this.running = true;

    try {
      const { terminal, process } = await this.ensureConsole();
      terminal.clear?.();

      const result = await process.loadAndRun(source, {
        seconds: 10,
      });

      if (result.version) {
        this.actrVersion = result.version;
      }

      terminal.show(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toastError(message);
    } finally {
      this.running = false;
    }
  };

  private onStep = async () => {
    if (!this.canStep || !this.actrConnected || !this.boundProcess) return;
    const source = this.editorSource();
    if (!source.trim()) {
      toastError('Nothing to step');
      return;
    }

    this.stepping = true;
    try {
      const { terminal, process } = await this.ensureConsole();
      if (!this.debugging) {
        terminal.clear?.();
        await process.loadModel(source);
        this.debugging = true;
        this.debugView = null;
      }
      const snapshot = await process.debugStep();
      this.debugDone = snapshot.done;
      this.debugView = reduceDebugView(this.debugView, snapshot, this.editorSource());
      this.showDebugView();
      terminal.show(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toastError(message);
      this.endDebugSession();
    } finally {
      this.stepping = false;
    }
  };

  private onStop = () => {
    this.endDebugSession();
  };

  private editorSource(): string {
    return this.widgetRef.value?.getContent?.() ?? this.initialContent ?? '';
  }

  private showDebugView(): void {
    const editor = this.widgetRef.value?.getEditor();
    const uri = this.widgetRef.value?.getModel()?.uri.toString();
    if (!editor || !uri || !this.debugView) return;
    setActrDebugSession(uri, this.debugView);
    applyProductionHighlight(editor, this.debugView.production);
  }

  private endDebugSession(): void {
    const editor = this.widgetRef.value?.getEditor();
    const uri = this.widgetRef.value?.getModel()?.uri.toString();
    if (uri) clearActrDebugSession(uri);
    if (editor) clearProductionHighlight(editor);
    this.debugView = null;
    this.debugging = false;
    this.debugDone = false;
  }

  protected override renderToolbar() {
    if (this.language !== 'actr-lisp') {
      return html`
        <span class="toolbar-note">Run is only available for .lisp ACT-R models</span>
      `;
    }

    const connectionTitle = this.actrConnecting
      ? 'Connecting to ACT-R…'
      : this.actrConnected
        ? 'ACT-R Connected'
        : 'ACT-R Disconnected — Click to connect';
    const connectionText = this.actrConnecting
      ? 'Connecting...'
      : this.actrConnected && this.actrVersion
        ? `ACT-R ${this.actrVersion}`
        : 'Not connected';
    const iconColor = this.actrConnected
      ? 'var(--wa-color-green-40)'
      : this.actrConnecting
        ? 'var(--wa-color-warning-500)'
        : 'var(--wa-color-red-40)';

    return html`
      <wa-button
        appearance="plain"
        size="s"
        style=${styleMap({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}
        ?disabled=${this.actrConnecting}
        title=${connectionTitle}
        @click=${this.onConnect}
      >
        <wa-icon name="circle" label="ACT-R status" style=${styleMap({ color: iconColor })}></wa-icon>
        ${connectionText}
      </wa-button>
      <wa-button
        appearance="plain"
        size="s"
        ?disabled=${!this.actrConnected || !this.canRun}
        title="Load model into the attached ACT-R console and run for 10s"
        @click=${this.onRun}
      >
        <wa-icon name="play" slot="prefix"></wa-icon>
        ${this.running ? 'Running…' : 'Run'}
      </wa-button>
      <wa-button
        appearance="plain"
        size="s"
        ?disabled=${!this.actrConnected || !this.canStep}
        title=${this.debugDone
          ? 'The model has finished. Stop to load it again.'
          : this.debugging
            ? 'Run the next scheduled event'
            : 'Load the model and run one scheduled event'}
        @click=${this.onStep}
      >
        <wa-icon name="forward-step" slot="prefix"></wa-icon>
        ${this.stepping ? 'Stepping…' : 'Step'}
      </wa-button>
      <wa-button
        appearance="plain"
        size="s"
        ?disabled=${!this.debugging || this.stepping || this.running}
        title="Leave the step session and clear the highlight"
        @click=${this.onStop}
      >
        <wa-icon name="stop" slot="prefix"></wa-icon>
        Stop
      </wa-button>
    `;
  }

  protected override doClose(): void {
    this.endDebugSession();
    this.disposeBoundConsole();
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

    .toolbar-note {
      margin-left: 0.5rem;
      font-size: 0.75rem;
      color: var(--wa-color-text-quiet, #aaa);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 28rem;
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
