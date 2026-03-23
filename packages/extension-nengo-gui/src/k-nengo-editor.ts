import {
  LyraPart,
  EditorInput,
  File as LyraFile,
  activeEditorSignal,
  contributionRegistry,
} from '@eclipse-lyra/core';
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
import {
  NENGO_VIZ_SLOT,
  type NengoVizContext,
  type NengoVisualizationContribution,
} from './nengo-viz-api';
import { nengoModelSummarySignal, nengoModelLoadingSignal } from './nengo-model-signal';

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
  private simDuration = 5.0;

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

  private pyenv?: PyEnv;
  private extractDebounce = 0;
  private widgetRef = createRef<any>();

  private static readonly CHUNK_DURATION_S = 0.05;

  public isEditor = true;

  protected override scrollMode = 'native' as const;

  protected override doBeforeUI(): void {
    this.watch(activeEditorSignal, () => this.syncModelToSignal());
  }

  protected override updated(changedProperties: Map<string, unknown>): void {
    super.updated?.(changedProperties);
    if (changedProperties.has('modelStructure') || changedProperties.has('simData')) {
      this.syncModelToSignal();
    }
  }

  private syncModelToSignal(): void {
    if (activeEditorSignal.get() !== this) return;
    const summary = this.getModelSummary();
    nengoModelSummarySignal.set(summary ?? undefined);
    if (summary) nengoModelLoadingSignal.set(false);
  }

  protected async doInitUI() {
    this.loading = true;
    this.error = undefined;
    this.initialContent = undefined;
    this.uri = undefined;
    this.pyenvReady = false;
    this.pyenvError = undefined;

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
      if (activeEditorSignal.get() === this) {
        nengoModelLoadingSignal.set(true);
      }
      this.extractModelStructure(this.initialContent ?? '');
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
    if (!this.pyenv || !code.trim()) return;
    if (activeEditorSignal.get() === this) {
      nengoModelLoadingSignal.set(true);
    }
    try {
      await this.pyenv.execCode(code);
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
      if (activeEditorSignal.get() === this) {
        nengoModelLoadingSignal.set(false);
      }
    }
  }

  private readonly durationFormatter = (v: number) => `${v}s`;

  private run = async () => {
    if (!this.pyenv || !this.pyenvReady) return;
    const code = this.widgetRef.value?.getContent?.() ?? this.initialContent ?? '';
    if (!code.trim()) return;

    this.running = true;
    this.runOutput = undefined;
    this.simData = undefined;
    const duration = Math.max(0.1, Math.min(10, this.simDuration));
    this.simDurationTarget = duration;
    this.simProgress = 0;
    this.viewTime = 0;
    let completed = false;
    try {
      await this.pyenv.execCode(code);
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
      const totalSteps = Math.round(duration / dt);
      const chunkSteps = Math.max(1, Math.round((KNengoEditor.CHUNK_DURATION_S / dt)));

      for (let done = 0; done < totalSteps; ) {
        if (!this.running) break;
        const steps = Math.min(chunkSteps, totalSteps - done);
        const advanceResponse = await this.pyenv.runFunction('__nengo_advance', {
          session_id: sessionId,
          steps,
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
          this.simData = {
            trange: data.trange ?? [],
            probes: data.probes ?? {},
            probeDims: data.probe_dims ?? {},
            probeLabels: data.probe_labels ?? {},
            ensembles: data.ensembles ?? [],
            nodes: data.nodes ?? [],
            connections: data.connections ?? [],
            probesList: data.probes_list ?? [],
          };
        }
        done += steps;
        this.simProgress = (done / totalSteps) * duration;
        this.viewTime = this.simProgress;
        completed = done >= totalSteps;
        await new Promise((r) => setTimeout(r, 0));
      }
    } catch (err) {
      this.runOutput = (err instanceof Error ? err.message : String(err)) + '\n';
    } finally {
      this.running = false;
      if (this.simDurationTarget > 0 && completed) {
        this.simProgress = this.simDurationTarget;
        this.viewTime = this.simDurationTarget;
      }
    }
  };

  public override save() {
    const data = this.input?.data;
    if (!(data instanceof LyraFile)) return;
    const value = this.widgetRef.value?.getContent?.() ?? '';
    data.saveContents(value);
    this.markDirty(false);
  }

  protected override doClose(): void {
    clearTimeout(this.extractDebounce);
    this.widgetRef.value?.dispose?.();
    this.pyenv?.close();
    this.pyenv = undefined;
  }

  private getModelSummary(): { ensembles: string[]; nodes: string[]; probes: string[]; connections: { pre: string; post: string; kind: string }[] } | undefined {
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

  private renderVizPanels() {
    const data = this.simData;
    if (!data) return html``;

    const fullTrange = data.trange;
    const viewT = this.viewTime;
    const endIdx =
      fullTrange.length === 0
        ? -1
        : (() => {
            let i = fullTrange.length - 1;
            while (i >= 0 && (fullTrange[i] ?? 0) > viewT) i--;
            return i;
          })();
    const trimCount = Math.max(0, endIdx + 1);
    const trange = fullTrange.slice(0, trimCount);

    const simProxy = {
      trange,
      getProbeData: (id: string) => {
        const raw = data?.probes?.[id] ?? [];
        if (trimCount >= fullTrange.length || fullTrange.length === 0) return raw;
        const nLines = Math.floor(raw.length / fullTrange.length) || 1;
        return raw.slice(0, trimCount * nLines);
      },
      getSpikeData: undefined as ((id: string) => { times: number[]; neurons: number[] }) | undefined,
    };

    const contributions = contributionRegistry.getContributions<NengoVisualizationContribution>(
      NENGO_VIZ_SLOT
    );

    const probePanels = data.probesList?.map((probeId) => {
      const ctx: NengoVizContext = {
        simProxy,
        nengoObjectId: probeId,
        nengoObjectType: 'ensemble',
        label: data.probeLabels?.[probeId] ?? probeId,
      };
      const valueContrib = contributions.find((c) => c.name === 'value');
      if (!valueContrib?.component) return html``;
      return html`
        <div class="viz-panel">
          ${valueContrib.component(ctx)}
        </div>
      `;
    });

    return html`
      <div class="viz-grid">
        ${probePanels ?? []}
      </div>
    `;
  }

  protected override renderToolbar() {
    return html`
      <span style="display: inline-flex; align-items: center; gap: 0.5rem; min-width: 140px;">
        <wa-slider
          label="Duration"
          size="small"
          .value=${this.simDuration}
          min="0.1"
          max="10"
          step="0.1"
          .withTooltip=${true}
          ?disabled=${!this.pyenvReady || this.running}
          .valueFormatter=${this.durationFormatter}
          @input=${(e: Event) => {
            const el = e.target as { value?: number };
            const v = el?.value ?? this.simDuration;
            if (typeof v === 'number' && v > 0) this.simDuration = v;
          }}
        ></wa-slider>
      </span>
      <wa-button
        @click=${this.run}
        ?disabled=${!this.pyenvReady || this.running}
        title="Run"
        appearance="plain"
      >
        <wa-icon name="play"></wa-icon>
      </wa-button>
    `;
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
      <div class="split-layout">
        <div class="code-pane">
          <lyra-monaco-widget
            .value=${this.initialContent}
            .uri=${this.uri}
            language="python"
            @content-change=${this.onContentChange}
            ${ref(this.widgetRef)}
          ></lyra-monaco-widget>
        </div>
        <div class="viz-pane">
          <div class="viz-header">
            ${!this.pyenvReady
              ? html`<span class="viz-status">Loading Python runtime…</span>`
              : html`
                  <span class="viz-status">
                    ${this.simData
                      ? `${this.simData.probesList.length} probe(s)`
                      : 'Ready'}
                  </span>
                  ${this.simDurationTarget > 0
                    ? html`
                        <wa-slider
                          class="progress-slider"
                          size="small"
                          .value=${this.running ? this.simProgress : this.viewTime}
                          .min=${0}
                          .max=${this.simDurationTarget}
                          step=${0.01}
                          .withTooltip=${true}
                          .valueFormatter=${this.durationFormatter}
                          @input=${(e: Event) => {
                            const el = e.target as { value?: number };
                            const v = el?.value ?? this.viewTime;
                            if (typeof v === 'number' && v >= 0) {
                              this.viewTime = Math.min(v, this.simDurationTarget);
                              if (this.running) this.running = false;
                            }
                          }}
                        ></wa-slider>
                      `
                    : ''}
                `}
          </div>
          <div class="viz-content">
            ${this.renderVizPanels()}
            ${this.runOutput
              ? html`<div class="output-area output-area-overlay"><pre class="output-content">${this.runOutput}</pre></div>`
              : !this.getModelSummary() && this.pyenvReady
                ? html`<div class="output-area"><span class="output-placeholder">Output will appear here after Run</span></div>`
                : ''}
          </div>
        </div>
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

    .split-layout {
      display: flex;
      flex: 1;
      min-height: 0;
      gap: 0;
    }

    .code-pane {
      flex: 1;
      min-width: 200px;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }

    .code-pane lyra-monaco-widget {
      display: block;
      flex: 1;
      min-height: 0;
      width: 100%;
    }

    .viz-pane {
      flex: 1;
      min-width: 200px;
      min-height: 0;
      display: flex;
      flex-direction: column;
      border-left: 1px solid var(--wa-color-surface-border);
      overflow: hidden;
    }

    .viz-header {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: var(--wa-space-s);
      padding: var(--wa-space-xs, 0.25rem) var(--wa-space-s, 0.5rem);
      background: var(--wa-color-surface-raised);
      color: var(--wa-color-text-normal);
      font-size: 0.875rem;
    }

    .viz-header .progress-slider {
      flex: 1;
      min-width: 80px;
    }

    .viz-status {
      opacity: 0.8;
    }

    .viz-content {
      flex: 1;
      min-height: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
    }

    .viz-content > .viz-grid {
      flex: 1;
      min-height: 0;
      align-self: stretch;
    }

    .viz-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--wa-space-m);
      padding: var(--wa-space-m);
      align-content: start;
    }

    .viz-panel {
      min-height: 120px;
      border: 1px solid var(--wa-color-surface-border);
      border-radius: var(--wa-border-radius-m, 4px);
      overflow: hidden;
    }

    .viz-panel-netgraph {
      grid-column: 1 / -1;
    }

    .output-area-overlay {
      grid-column: 1 / -1;
      max-height: 120px;
    }

    .output-area {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: var(--wa-space-m, 1rem);
      font-family: monospace;
      font-size: 0.8125rem;
    }

    .output-content {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .output-placeholder {
      opacity: 0.6;
      font-style: italic;
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
