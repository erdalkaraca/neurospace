import { LyraPart, EditorInput, File as LyraFile, activeEditorSignal } from '@eclipse-lyra/core';
import {
  customElement,
  property,
  state,
  html,
  css,
  createRef,
  ref,
} from '@eclipse-lyra/core/externals/lit';
import { PyEnv } from '@eclipse-lyra/extension-python-runtime/api';
import { ENV_NO_THREADS, FCNTL_STUB, INSTALL_NENGO } from './nengo-python-init';
import nameFinderScript from './py-scripts/name_finder.py?raw';
import initSimScript from './py-scripts/init-sim.py?raw';
import advanceScript from './py-scripts/advance.py?raw';
import extractModelScript from './py-scripts/extract-model.py?raw';
import type { NengoAddedVisualization, NengoModelSummary, NengoSimData } from './nengo-model-types';

/** Lyra `editorId` for this editor; must match `registerEditorInputHandler` and panel `coupledEditors`. */
export const NENGO_EDITOR_ID = 'nengo-editor';

/** Fired on `KNengoEditor` when state relevant to companion panels changes. */
export const NENGO_COMPANION_UPDATE = 'nengo-companion-update';

@customElement('k-nengo-editor')
export class KNengoEditor extends LyraPart {
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
  private pyenvReady = false;

  @state()
  private pyenvError?: string;

  @state()
  private runOutput?: string;

  @state()
  private running = false;

  @state()
  private simProgress = 0;

  @state()
  private simDurationTarget = 0;

  @state()
  private viewTime = 0;

  @state()
  private simData?: {
    trange: number[];
    probes: Record<string, number[]>;
    probeDims: Record<string, number>;
    probeLabels: Record<string, string>;
    ensembles: string[];
    nodes: string[];
    connections: { pre: string; post: string; kind: string }[];
    probesList: string[];
  };

  @state()
  private modelStructure?: {
    ensembles: string[];
    nodes: string[];
    probes: string[];
    connections: { pre: string; post: string; kind: string }[];
  };

  @state()
  private modelExtractLoading = false;

  @state()
  private addedVisualizations: NengoAddedVisualization[] = [];

  private pyenv?: PyEnv;
  private extractDebounce = 0;
  private widgetRef = createRef<any>();

  private static readonly CHUNK_DURATION_S = 0.05;

  public isEditor = true;

  protected override scrollMode = 'native' as const;

  protected override doBeforeUI(): void {
    // Companion panels bind to this element via NENGO_COMPANION_UPDATE; no global signals.
  }

  protected override updated(changedProperties: Map<string, unknown>): void {
    super.updated?.(changedProperties);
    const companionKeys = new Set([
      'modelStructure',
      'simData',
      'runOutput',
      'viewTime',
      'simProgress',
      'running',
      'pyenvReady',
      'modelExtractLoading',
      'addedVisualizations',
    ]);
    if ([...changedProperties.keys()].some((k) => companionKeys.has(k))) {
      this.dispatchEvent(new CustomEvent(NENGO_COMPANION_UPDATE));
    }
  }

  public getModelSummary(): NengoModelSummary | undefined {
    return this.computeModelSummaryInternal();
  }

  public get isModelExtractLoading(): boolean {
    return this.modelExtractLoading;
  }

  public getCompanionSimSnapshot(): NengoSimData {
    return {
      simData: this.simData,
      runOutput: this.runOutput,
      viewTime: this.viewTime,
      simDurationTarget: this.simDurationTarget,
      running: this.running,
      simProgress: this.simProgress,
      canRun: this.pyenvReady,
    };
  }

  public getCompanionAddedVisualizations(): readonly NengoAddedVisualization[] {
    return this.addedVisualizations;
  }

  public addCompanionVisualization(entry: NengoAddedVisualization): void {
    if (
      this.addedVisualizations.some(
        (a) => a.objectId === entry.objectId && a.vizType === entry.vizType
      )
    ) {
      return;
    }
    this.addedVisualizations = [...this.addedVisualizations, entry];
  }

  public runSimulation(): void {
    void this.run();
  }

  public stopSimulation(): void {
    this.stop();
  }

  public setCompanionViewTime(t: number): void {
    this.viewTime = t;
  }

  protected async doInitUI() {
    this.loading = true;
    this.error = undefined;
    this.initialContent = undefined;
    this.uri = undefined;
    this.pyenvReady = false;
    this.pyenvError = undefined;
    this.addedVisualizations = [];

    try {
      const data = this.input?.data;
      if (!(data instanceof LyraFile)) throw new Error('No file input available');
      const raw = await data.getContents();
      const text =
        typeof raw === 'string' ? raw : new TextDecoder().decode(raw as ArrayBuffer);
      this.initialContent = text;
      this.uri = data.getWorkspacePath();

      this.pyenv = new PyEnv();
      await this.pyenv.init();
      await this.pyenv.execCode(ENV_NO_THREADS);
      await this.pyenv.loadPackages(['micropip', 'numpy', 'scipy']);
      await this.pyenv.execCode(FCNTL_STUB);
      await this.pyenv.execCode(INSTALL_NENGO);
      await this.pyenv.execCode(nameFinderScript);
      await this.pyenv.execCode(initSimScript);
      await this.pyenv.execCode(advanceScript);
      await this.pyenv.execCode(extractModelScript);

      this.pyenv.setStdoutCallback((s) => {
        this.runOutput = (this.runOutput ?? '') + s;
        queueMicrotask(() => this.requestUpdate());
      });
      this.pyenv.setStderrCallback((s) => {
        this.runOutput = (this.runOutput ?? '') + s;
        queueMicrotask(() => this.requestUpdate());
      });
      this.pyenvReady = true;
      void this.extractModelStructure(this.initialContent ?? '');
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
      this.pyenvError = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private onContentChange = () => {
    this.markDirty(true);
    this.scheduleExtractModel();
  };

  private scheduleExtractModel(): void {
    if (!this.pyenvReady || !this.pyenv) return;
    clearTimeout(this.extractDebounce);
    this.extractDebounce = window.setTimeout(() => {
      this.extractModelStructure(this.widgetRef.value?.getContent?.() ?? this.initialContent ?? '');
    }, 400);
  }

  private async extractModelStructure(code: string): Promise<void> {
    if (!this.pyenv || !code.trim()) {
      this.modelExtractLoading = false;
      return;
    }
    this.modelExtractLoading = true;
    try {
      const wrappedCode = '__name__ = "__main__"\n' + code;
      await this.pyenv.execCode(wrappedCode);
      const resp = await this.pyenv.runFunction('__nengo_extract_model_structure', {});
      const raw = resp && typeof resp === 'object' && 'result' in resp ? resp.result : resp;
      const data = raw as { ensembles?: string[]; nodes?: string[]; probes?: string[]; connections?: { pre: string; post: string; kind: string }[]; error?: string } | undefined;
      if (data?.error) {
        this.modelStructure = undefined;
        return;
      }
      if (data && !data.error) {
        this.modelStructure = {
          ensembles: data.ensembles ?? [],
          nodes: data.nodes ?? [],
          probes: data.probes ?? [],
          connections: data.connections ?? [],
        };
      }
    } catch {
      this.modelStructure = undefined;
    } finally {
      this.modelExtractLoading = false;
    }
  }

  private run = async () => {
    if (!this.pyenv || !this.pyenvReady) return;
    const code = this.widgetRef.value?.getContent?.() ?? this.initialContent ?? '';
    if (!code.trim()) return;

    this.running = true;
    this.runOutput = undefined;
    this.simData = undefined;
    this.simDurationTarget = 0;
    this.simProgress = 0;
    this.viewTime = 0;
    const wrappedCode = '__name__ = "__main__"\n' + code;
    try {
      await this.pyenv.execCode(wrappedCode);
      const initResponse = await this.pyenv.runFunction('__nengo_init_sim', {});
      const initRaw = initResponse && typeof initResponse === 'object' && 'result' in initResponse ? initResponse.result : initResponse;
      const init = initRaw as { session_id?: string; dt?: number; error?: string; ok?: boolean } | undefined;
      const out = initResponse?.console?.join('') ?? '';
      if (out) this.runOutput = (this.runOutput ?? '') + out;

      if (!init?.ok && init?.error) {
        this.runOutput = (this.runOutput ?? '') + String(init.error) + '\n';
        return;
      }

      const sessionId = init?.session_id ?? '';
      const dt = init?.dt ?? 0.001;
      const chunkSteps = Math.max(1, Math.round((KNengoEditor.CHUNK_DURATION_S / dt)));

      while (this.running) {
        const advanceResponse = await this.pyenv.runFunction('__nengo_advance', {
          session_id: sessionId,
          steps: chunkSteps,
        });
        const dataRaw = advanceResponse && typeof advanceResponse === 'object' && 'result' in advanceResponse ? advanceResponse.result : advanceResponse;
        const data = dataRaw as {
          trange?: number[];
          probes?: Record<string, number[]>;
          probe_dims?: Record<string, number>;
          probe_labels?: Record<string, string>;
          ensembles?: string[];
          nodes?: string[];
          connections?: { pre: string; post: string; kind: string }[];
          probes_list?: string[];
          error?: string;
        } | undefined;

        if (data?.error) {
          this.runOutput = (this.runOutput ?? '') + String(data.error) + '\n';
          break;
        }
        if (data && typeof data === 'object' && !data.error) {
          const trange = data.trange ?? [];
          this.simData = {
            trange,
            probes: data.probes ?? {},
            probeDims: data.probe_dims ?? {},
            probeLabels: data.probe_labels ?? {},
            ensembles: data.ensembles ?? [],
            nodes: data.nodes ?? [],
            connections: data.connections ?? [],
            probesList: data.probes_list ?? [],
          };
          const tMax = trange.length > 0 ? trange[trange.length - 1] : 0;
          this.simProgress = tMax;
          this.viewTime = tMax;
          this.simDurationTarget = tMax;
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    } catch (err) {
      this.runOutput = (err instanceof Error ? err.message : String(err)) + '\n';
    } finally {
      this.running = false;
    }
  };

  private stop = () => {
    this.running = false;
  };

  public override async save() {
    const data = this.input?.data;
    if (!(data instanceof LyraFile)) return;
    const value = this.widgetRef.value?.getContent?.() ?? '';
    await data.saveContents(value);
    if (typeof this.widgetRef.value?.setContent === 'function') {
      this.widgetRef.value.setContent(value);
    } else {
      this.initialContent = value;
    }
    this.markDirty(false);
  }

  protected override doClose(): void {
    clearTimeout(this.extractDebounce);
    this.widgetRef.value?.dispose?.();
    this.pyenv?.close();
    this.pyenv = undefined;
  }

  private computeModelSummaryInternal(): NengoModelSummary | undefined {
    const toArray = (v: unknown): string[] => {
      if (v == null) return [];
      if (Array.isArray(v)) return v.map(String);
      if (typeof (v as Iterable<unknown>)[Symbol.iterator] === 'function') return Array.from(v as Iterable<unknown>, String);
      return [];
    };
    if (this.simData) {
      return {
        ensembles: toArray(this.simData.ensembles),
        nodes: toArray(this.simData.nodes),
        probes: (this.simData.probesList ?? []).map((id: string) => this.simData!.probeLabels?.[id] ?? id),
        connections: Array.isArray(this.simData.connections) ? this.simData.connections : [],
      };
    }
    if (this.modelStructure) {
      return {
        ensembles: toArray(this.modelStructure.ensembles),
        nodes: toArray(this.modelStructure.nodes),
        probes: toArray(this.modelStructure.probes),
        connections: Array.isArray(this.modelStructure.connections) ? this.modelStructure.connections : [],
      };
    }
    return undefined;
  }

  protected override renderToolbar() {
    return html``;
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
    if (this.pyenvError) {
      return html`<div class="state state-error">PyEnv: ${this.pyenvError}</div>`;
    }

    return html`
      <div class="editor-container">
        <lyra-monaco-widget
          .value=${this.initialContent}
          .uri=${this.uri}
          language="python"
          @content-change=${this.onContentChange}
          ${ref(this.widgetRef)}
        ></lyra-monaco-widget>
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

    .editor-container lyra-monaco-widget {
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

export function getActiveNengoEditor(): KNengoEditor | null {
  const el = activeEditorSignal.get();
  return el instanceof KNengoEditor ? el : null;
}
