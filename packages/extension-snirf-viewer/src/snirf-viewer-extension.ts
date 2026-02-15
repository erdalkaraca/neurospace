import { KPart } from '@kispace-io/core';
import {
  customElement,
  property,
  state,
  css,
  html,
  nothing,
} from '@kispace-io/core/externals/lit';
import { EditorInput, editorRegistry, File } from '@kispace-io/core';
import { loadSnirf } from './snirf-loader.js';
import type { SnirfData, SnirfDataBlock } from './types.js';
import './snirf-time-series.js';
import './snirf-probe-layout.js';

const isSnirfFile = (file: File): boolean =>
  file.getName().toLowerCase().endsWith('.snirf');

editorRegistry.registerEditorInputHandler({
  canHandle: (input): input is File =>
    input instanceof File && isSnirfFile(input),
  handle: async (input: File) => {
    const editorInput = {
      title: input.getName(),
      data: input,
      key: input.getWorkspacePath(),
      editorId: 'snirf-viewer',
      icon: 'waveform',
      noOverflow: false,
      state: {},
    } as EditorInput;
    editorInput.widgetFactory = () =>
      html`<k-snirf-viewer id="snirf-viewer" .input=${editorInput}></k-snirf-viewer>`;
    return editorInput;
  },
  ranking: 1000,
});

@customElement('k-snirf-viewer')
export class KSnirfViewer extends KPart {
  @property({ attribute: false })
  public input?: EditorInput;

  @state()
  private error?: string;

  @state()
  private loading = true;

  @state()
  private data?: SnirfData;

  @state()
  private selectedBlock = 0;

  @state()
  private timeViewStart: number | null = null;

  @state()
  private timeViewEnd: number | null = null;

  @state()
  private timeIndex = 0;

  public isEditor = true;

  protected doClose() {
    this.input = undefined;
    this.data = undefined;
    this.error = undefined;
  }

  protected async doInitUI() {
    await this.loadFile();
  }

  private async loadFile() {
    if (!this.input?.data || !(this.input.data instanceof File)) {
      this.error = 'No file to display';
      this.loading = false;
      return;
    }

    const file = this.input.data;
    try {
      const blob = (await file.getContents({ blob: true })) as Blob;
      const buffer = await blob.arrayBuffer();
      this.data = await loadSnirf(buffer);
      if (this.data?.nirs[0]?.data?.length) {
        this.timeIndex = 0;
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load SNIRF file';
    } finally {
      this.loading = false;
    }
  }

  private get currentBlock(): SnirfDataBlock | null {
    if (!this.data?.nirs[0]) return null;
    const blocks = this.data.nirs[0].data;
    return blocks[this.selectedBlock] ?? blocks[0] ?? null;
  }

  private zoomIn = () => {
    const block = this.currentBlock;
    if (!block?.time?.length) return;
    const tMin = Math.min(...block.time);
    const tMax = Math.max(...block.time);
    const viewStart = this.timeViewStart ?? tMin;
    const viewEnd = this.timeViewEnd ?? tMax;
    const center = (viewStart + viewEnd) / 2;
    const viewSpan = (viewEnd - viewStart) / 1.5;
    const half = viewSpan / 2;
    let newStart = center - half;
    let newEnd = center + half;
    if (newStart < tMin) {
      newStart = tMin;
      newEnd = tMin + viewSpan;
    } else if (newEnd > tMax) {
      newEnd = tMax;
      newStart = tMax - viewSpan;
    }
    this.timeViewStart = newStart;
    this.timeViewEnd = newEnd;
  };

  private zoomOut = () => {
    const block = this.currentBlock;
    if (!block?.time?.length) return;
    const tMin = Math.min(...block.time);
    const tMax = Math.max(...block.time);
    const fullSpan = tMax - tMin;
    const viewStart = this.timeViewStart ?? tMin;
    const viewEnd = this.timeViewEnd ?? tMax;
    const center = (viewStart + viewEnd) / 2;
    const viewSpan = Math.min((viewEnd - viewStart) * 1.5, fullSpan);
    const half = viewSpan / 2;
    let newStart = center - half;
    let newEnd = center + half;
    if (newStart < tMin) {
      newStart = tMin;
      newEnd = tMin + viewSpan;
    } else if (newEnd > tMax) {
      newEnd = tMax;
      newStart = tMax - viewSpan;
    }
    this.timeViewStart = newStart;
    this.timeViewEnd = newEnd;
  };

  private zoomReset = () => {
    this.timeViewStart = null;
    this.timeViewEnd = null;
  };

  protected renderToolbar() {
    if (!this.data || this.loading || this.error) return nothing;

    const block = this.currentBlock;
    const nSamples = block?.dataTimeSeries?.length ?? 0;

    return html`
      <div class="toolbar">
        ${this.data.nirs[0].data.length > 1
          ? html`
              <select
                @change=${(e: Event) => {
                  this.selectedBlock = parseInt(
                    (e.target as HTMLSelectElement).value,
                    10
                  );
                }}
              >
                ${this.data.nirs[0].data.map(
                  (_, i) =>
                    html`<option value=${i} ?selected=${i === this.selectedBlock}>
                      Data ${i + 1}
                    </option>`
                )}
              </select>
            `
          : null}
        ${nSamples > 1
          ? html`
              <div class="toolbar-zoom">
                <wa-button
                  type="button"
                  size="small"
                  appearance="outlined"
                  variant="neutral"
                  title="Zoom in"
                  @click=${this.zoomIn}
                >
                  <wa-icon name="magnifying-glass-plus" label="Zoom in"></wa-icon>
                </wa-button>
                <wa-button
                  type="button"
                  size="small"
                  appearance="outlined"
                  variant="neutral"
                  title="Zoom out"
                  @click=${this.zoomOut}
                >
                  <wa-icon name="magnifying-glass-minus" label="Zoom out"></wa-icon>
                </wa-button>
                <wa-button
                  type="button"
                  size="small"
                  appearance="outlined"
                  variant="neutral"
                  title="Reset zoom"
                  @click=${this.zoomReset}
                >
                  <wa-icon name="maximize" label="Reset zoom"></wa-icon>
                </wa-button>
              </div>
            `
          : null}
      </div>
   `;
  }

  protected render() {
    if (this.error) {
      return html`
        <div class="error-state">
          <wa-icon name="triangle-exclamation"></wa-icon>
          <span>${this.error}</span>
        </div>
      `;
    }

    if (this.loading) {
      return html`
        <div class="loading-state">
          <wa-spinner></wa-spinner>
          <span>Loading SNIRF file...</span>
        </div>
      `;
    }

    const block = this.currentBlock;
    if (!this.data || !block) {
      return html`
        <div class="error-state">
          <span>No data in SNIRF file</span>
        </div>
      `;
    }

    return html`
      <div class="viewer-layout">
        <div class="viewer-panels">
          <div class="panel chart-panel">
            <h3 class="panel-title">Time series</h3>
            <snirf-time-series
              .block=${block}
              .probe=${this.data.nirs[0]?.probe}
              .timeIndex=${this.timeIndex}
              .timeViewStart=${this.timeViewStart}
              .timeViewEnd=${this.timeViewEnd}
              @time-index-change=${(e: CustomEvent<number>) => {
                this.timeIndex = e.detail;
              }}
              @time-view-change=${(e: CustomEvent<{ start: number; end: number }>) => {
                this.timeViewStart = e.detail.start;
                this.timeViewEnd = e.detail.end;
              }}
            ></snirf-time-series>
          </div>
          <div class="panel probe-panel">
            <h3 class="panel-title">Probe layout</h3>
            <snirf-probe-layout
              .block=${block}
              .probe=${this.data.nirs[0]?.probe}
              .timeIndex=${this.timeIndex}
            ></snirf-probe-layout>
          </div>
        </div>
      </div>
    `;
  }

  updated(changedProperties: Map<string, unknown>) {
    super.updated?.(changedProperties);
    if (changedProperties.has('data') && this.data) {
      this.timeViewStart = null;
      this.timeViewEnd = null;
    }
    if (changedProperties.has('selectedBlock') && this.currentBlock) {
      this.timeIndex = 0;
      this.timeViewStart = null;
      this.timeViewEnd = null;
    }
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: var(--wa-color-surface-default);
    }

    .viewer-layout {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      min-height: 0;
      overflow: hidden;
    }

    .viewer-panels {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-rows: 1fr;
      gap: 1rem;
      min-height: 200px;
      overflow: auto;
    }

    .panel {
      background: var(--wa-color-surface-raised);
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .panel-title {
      margin: 0 0 0.5rem 0;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--wa-color-text-normal);
    }

    .chart-panel {
      min-width: 0;
    }

    .chart-panel snirf-time-series {
      flex: 1;
    }

    .probe-panel {
      width: 350px;
      min-width: 350px;
      flex-shrink: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
    }

    .probe-panel snirf-probe-layout {
      flex: 1 1 auto;
      min-height: 350px;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .toolbar-zoom {
      display: flex;
      gap: 0.25rem;
    }

    .error-state,
    .loading-state {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--wa-space-s);
      color: var(--wa-color-text-quiet);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'k-snirf-viewer': KSnirfViewer;
    'snirf-time-series': import('./snirf-time-series.js').SnirfTimeSeries;
    'snirf-probe-layout': import('./snirf-probe-layout.js').SnirfProbeLayout;
  }
}
