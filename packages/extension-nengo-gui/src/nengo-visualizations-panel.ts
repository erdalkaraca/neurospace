import {
  LyraPart,
  activeEditorSignal,
  contributionRegistry,
  PANEL_BOTTOM,
} from '@eclipse-lyra/core';
import { customElement, html, css, nothing, type TemplateResult } from '@eclipse-lyra/core/externals/lit';
import {
  nengoSimDataSignal,
  nengoAddedVisualizationsSignal,
  nengoRunRequestSignal,
  nengoStopRequestSignal,
  nengoViewTimeRequestSignal,
} from './nengo-model-signal';
import {
  NENGO_VIZ_SLOT,
  type NengoVizContext,
  type NengoVisualizationContribution,
} from './nengo-viz-api';
import './viz/nengo-value-plot';
import './viz/nengo-raster-plot';
import './viz/nengo-time-scrubber';

const NENGO_EDITOR_TAG = 'k-nengo-editor';

@customElement('nengo-visualizations-panel')
export class NengoVisualizationsPanel extends LyraPart {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }
    .panel-content {
      flex: 1;
      min-height: 0;
      overflow-x: hidden;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }
    .viz-grid {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--wa-space-m);
      padding: var(--wa-space-m);
      align-content: start;
    }
    .viz-panel {
      min-height: 120px;
      border: 1px solid var(--wa-color-surface-border);
      border-radius: var(--wa-border-radius-m);
      overflow: hidden;
    }
    .output-area {
      flex-shrink: 0;
      max-height: 120px;
      overflow: auto;
      padding: var(--wa-space-m);
      font-family: monospace;
      font-size: 0.8125rem;
      border-top: 1px solid var(--wa-color-surface-border);
    }
    .placeholder {
      padding: var(--wa-space-m);
      color: var(--wa-color-text-quiet);
      font-style: italic;
      font-size: 0.875rem;
    }
  `;

  protected override doBeforeUI(): void {
    this.watch(activeEditorSignal, () => this.handleActiveEditorChange());
    this.watch(nengoSimDataSignal, () => this.requestUpdate());
    this.watch(nengoAddedVisualizationsSignal, () => this.requestUpdate());
  }

  private handleActiveEditorChange(): void {
    const active = activeEditorSignal.get();
    const isNengo = active?.tagName?.toLowerCase() === NENGO_EDITOR_TAG;
    if (!isNengo) {
      nengoSimDataSignal.set({
        viewTime: 0,
        simDurationTarget: 0,
        running: false,
        simProgress: 0,
        canRun: false,
      });
    }
  }

  protected override renderToolbar(): TemplateResult | typeof nothing {
    return nothing;
  }

  protected override renderContent(): TemplateResult {
    const isNengo = activeEditorSignal.get()?.tagName?.toLowerCase() === NENGO_EDITOR_TAG;
    if (!isNengo) {
      return html`
        <div class="panel-content">
          <div class="placeholder">Open a .nengo.py file and run simulation to see visualizations</div>
        </div>
      `;
    }

    const data = nengoSimDataSignal.get();
    const simData = data?.simData;
    const runOutput = data?.runOutput;
    const viewTime = data?.viewTime ?? 0;
    const simDurationTarget = data?.simDurationTarget ?? 0;
    const running = data?.running ?? false;
    const simProgress = data?.simProgress ?? 0;
    const canRun = data?.canRun ?? false;

    const contributions = contributionRegistry.getContributions<NengoVisualizationContribution>(
      NENGO_VIZ_SLOT
    );

    const fullTrange = simData?.trange ?? [];
    const endIdx =
      fullTrange.length === 0
        ? -1
        : (() => {
            let i = fullTrange.length - 1;
            while (i >= 0 && (fullTrange[i] ?? 0) > viewTime) i--;
            return i;
          })();
    const trimCount = Math.max(0, endIdx + 1);
    const trange = fullTrange.slice(0, trimCount);

    const simProxy = {
      trange,
      getProbeData: (id: string) => {
        const raw = simData?.probes?.[id] ?? [];
        if (trimCount >= fullTrange.length || fullTrange.length === 0) return raw;
        const nLines = Math.floor(raw.length / fullTrange.length) || 1;
        return raw.slice(0, trimCount * nLines);
      },
      getSpikeData: undefined as ((id: string) => { times: number[]; neurons: number[] }) | undefined,
    };

    const probePanels =
      simData?.probesList?.map((probeId) => {
        const valueContrib = contributions.find((c) => c.name === 'value');
        if (!valueContrib?.component) return html``;
        const ctx: NengoVizContext = {
          simProxy,
          nengoObjectId: probeId,
          nengoObjectType: 'ensemble',
          label: simData.probeLabels?.[probeId] ?? probeId,
        };
        return html`
          <div class="viz-panel">
            ${valueContrib.component(ctx)}
          </div>
        `;
      }) ?? [];

    const added = nengoAddedVisualizationsSignal.get();
    const addedPanels = added.map((a) => {
      const valueContrib = contributions.find((c) => c.name === 'value');
      const rasterContrib = contributions.find((c) => c.name === 'raster');
      const contrib = a.vizType === 'raster' ? rasterContrib : valueContrib;
      if (!contrib?.component) return html``;
      const probeId = simData?.probesList?.find((pid) => simData.probeLabels?.[pid] === a.objectId);
      const ctx: NengoVizContext = {
        simProxy,
        nengoObjectId: probeId ?? a.objectId,
        nengoObjectType: a.objectType,
        label: a.objectId,
      };
      return html`
        <div class="viz-panel">
          ${contrib.component(ctx)}
        </div>
      `;
    });

    return html`
      <div class="panel-content">
        <nengo-time-scrubber
          .value=${running ? simProgress : viewTime}
          .max=${simDurationTarget || 1}
          .step=${0.01}
          .running=${running}
          .canRun=${canRun}
          .onInput=${(v: number) => nengoViewTimeRequestSignal.set(v)}
          .onReset=${() => nengoViewTimeRequestSignal.set(0)}
          .onPlay=${() => nengoRunRequestSignal.set(nengoRunRequestSignal.get() + 1)}
          .onStop=${() => nengoStopRequestSignal.set(nengoStopRequestSignal.get() + 1)}
        ></nengo-time-scrubber>
        <div class="viz-grid">
          ${probePanels}
          ${addedPanels}
        </div>
        ${runOutput
          ? html`<div class="output-area"><pre>${runOutput}</pre></div>`
          : !simData && isNengo
            ? html`<div class="output-area"><span class="placeholder">Output will appear here after Run</span></div>`
            : ''}
      </div>
    `;
  }
}

contributionRegistry.registerContribution(PANEL_BOTTOM, {
  name: 'nengo-visualizations',
  label: 'Visualizations',
  icon: 'chart-line',
  component: (id: string) =>
    html`<nengo-visualizations-panel id="${id}"></nengo-visualizations-panel>`,
});
