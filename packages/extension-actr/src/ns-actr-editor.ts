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

import { detachActrTerminal } from './actr-console-registry';
import { openActrConsole } from './actr-console';
import type { ActrProcess } from './actr-cheerpx-service';
import {
  DEBUG_HALT_EVENTS,
  DEFAULT_HALT_EVENTS,
  reduceDebugView,
  type DebugHaltEventId,
  type DebugView,
} from './actr-debug-model';
import {
  applyProductionHighlight,
  clearActrDebugSession,
  clearProductionHighlight,
  setActrDebugSession,
} from './actr-debug-monaco';
import { actrIcon } from './actr-icons';

export const ACTR_EDITOR_ID = 'actr-editor';

export const ACTR_COMMAND = {
  run: 'actr_run',
  step: 'actr_step',
  stop: 'actr_stop',
} as const;

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

  /** Event detail heads Step should stop on. Empty = every event. */
  @state()
  private haltOnEvents: ReadonlySet<DebugHaltEventId> = DEFAULT_HALT_EVENTS;

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

  get canRun(): boolean {
    return (
      this.actrConnected &&
      this.language === 'actr-lisp' &&
      !this.running &&
      !this.stepping &&
      !this.debugging &&
      !this.loading &&
      !this.actrConnecting
    );
  }

  get canStep(): boolean {
    return (
      this.actrConnected &&
      this.language === 'actr-lisp' &&
      !this.running &&
      !this.stepping &&
      !this.debugDone &&
      !this.loading &&
      !this.actrConnecting
    );
  }

  get canStop(): boolean {
    return this.debugging && !this.stepping && !this.running;
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

    const opened = await openActrConsole(this.modelLabel, (terminal) => {
      this.boundTerminalId = terminal.id;
    });
    this.boundTerminalId = opened.terminal.id;
    this.boundProcess = opened.process;
    this.actrConnected = true;
    this.actrVersion = opened.process.version || 'ready';
    return opened;
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

  async run(): Promise<void> {
    if (!this.canRun || !this.boundProcess) return;

    const source = this.editorSource();
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
  }

  async step(): Promise<void> {
    if (!this.canStep || !this.boundProcess) return;
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
      const snapshot = await process.debugStep({ haltOn: this.haltOnEvents });
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
  }

  stop(): void {
    if (!this.canStop) return;
    this.endDebugSession();
  }

  private editorSource(): string {
    return this.widgetRef.value?.getContent?.() ?? this.initialContent ?? '';
  }

  private showDebugView(): void {
    const editor = this.widgetRef.value?.getEditor();
    const uri = this.widgetRef.value?.getModel()?.uri.toString();
    if (!editor || !uri || !this.debugView) return;
    setActrDebugSession(uri, this.debugView);
    applyProductionHighlight(editor, this.debugView);
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
      <docks-command
        cmd=${ACTR_COMMAND.run}
        icon=${actrIcon('run')}
        ?disabled=${!this.canRun}
        title="Load model into the attached ACT-R console and run for 10s"
      >${this.running ? 'Running…' : 'Run'}</docks-command>
      <docks-command
        cmd=${ACTR_COMMAND.step}
        icon=${actrIcon('step-over')}
        ?disabled=${!this.canStep}
        title=${this.stepTitle()}
      >${this.stepping ? 'Stepping…' : 'Step'}</docks-command>
      <docks-command
        cmd=${ACTR_COMMAND.stop}
        icon=${actrIcon('stop')}
        ?disabled=${!this.canStop}
        title="Leave the step session and clear the highlight"
      >Stop</docks-command>
      <wa-dropdown
        style=${styleMap({ alignSelf: 'center' })}
        @wa-select=${this.onHaltEventSelect}
      >
        <wa-button
          slot="trigger"
          appearance="plain"
          size="s"
          with-caret
          ?disabled=${this.stepping || this.running}
          title="Choose which ACT-R events Step should halt on"
        >
          Halt on
        </wa-button>
        ${DEBUG_HALT_EVENTS.map(
          (event) => html`
            <wa-dropdown-item
              type="checkbox"
              value=${event.id}
              ?checked=${this.haltOnEvents.has(event.id)}
            >
              <span style=${styleMap({ display: 'flex', flexDirection: 'column', gap: '0.15em' })}>
                <span>${event.label}</span>
                <span
                  style=${styleMap({
                    fontSize: 'var(--wa-font-size-2xs, 0.6875rem)',
                    lineHeight: '1.3',
                    color: 'var(--wa-color-text-quiet)',
                    fontWeight: 'normal',
                  })}
                >
                  ${event.description}
                </span>
              </span>
            </wa-dropdown-item>
          `,
        )}
      </wa-dropdown>
    `;
  }

  private stepTitle(): string {
    if (this.debugDone) return 'The model has finished. Stop to load it again.';
    if (this.haltOnEvents.size === 0) {
      return this.debugging
        ? 'Run the next scheduled event'
        : 'Load the model and run one scheduled event';
    }
    if (this.haltOnEvents.size === 1 && this.haltOnEvents.has('PRODUCTION-SELECTED')) {
      return this.debugging
        ? 'Run until the next production is selected'
        : 'Load the model and run until the first production is selected';
    }
    return this.debugging
      ? 'Run until the next selected event type'
      : 'Load the model and run until the first selected event type';
  }

  private onHaltEventSelect = (event: Event): void => {
    event.preventDefault();
    const item = (event as CustomEvent<{ item?: { value?: string; checked?: boolean } }>).detail
      ?.item;
    if (!item) return;
    const id = item.value as DebugHaltEventId | undefined;
    if (!id || !DEBUG_HALT_EVENTS.some((e) => e.id === id)) return;

    const next = new Set(this.haltOnEvents);
    if (item.checked) next.add(id);
    else next.delete(id);
    this.haltOnEvents = next;
  };

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
