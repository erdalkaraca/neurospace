import {
  customElement,
  property,
  LitElement,
  css,
  html,
} from '@eclipse-lyra/core/externals/lit';
import type { NengoVizContext } from '../nengo-viz-api';

@customElement('nengo-raster-plot')
export class NengoRasterPlot extends LitElement {
  @property({ attribute: false })
  context?: NengoVizContext;

  private renderChart() {
    const ctx = this.context;
    const spikeData = ctx?.simProxy?.getSpikeData?.(ctx.nengoObjectId);
    if (!spikeData?.times?.length) {
      return html`<span class="placeholder">No spike data</span>`;
    }

    const { times, neurons } = spikeData;
    const nNeurons = (neurons && Math.max(...neurons) + 1) || 1;
    const w = this.clientWidth || 200;
    const h = this.clientHeight || 120;
    const pad = { t: 8, r: 8, b: 20, l: 24 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const tSpan = tMax - tMin || 1;

    const toX = (t: number) => pad.l + ((t - tMin) / tSpan) * plotW;
    const toY = (n: number) =>
      pad.t + plotH - (n / Math.max(nNeurons - 1, 1)) * plotH;

    const circles = times
      .slice(0, 2000)
      .map((t, i) => {
        const x = toX(t);
        const y = toY(neurons[i] ?? 0);
        return html`<circle cx=${x} cy=${y} r="0.8" fill="currentColor" opacity="0.7" />`;
      });

    return html`
      <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <g class="axes">
          <line x1=${pad.l} y1=${pad.t} x2=${pad.l} y2=${pad.t + plotH} stroke="currentColor" opacity="0.3" />
          <line x1=${pad.l} y1=${pad.t + plotH} x2=${pad.l + plotW} y2=${pad.t + plotH} stroke="currentColor" opacity="0.3" />
        </g>
        <g class="spikes">${circles}</g>
      </svg>
    `;
  }

  render() {
    const label = this.context?.label ?? 'Raster';
    return html`
      <div class="plot-container">
        <div class="plot-title">${label}</div>
        <div class="plot-svg">${this.renderChart()}</div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      overflow: hidden;
    }
    .plot-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 80px;
    }
    .plot-title {
      font-size: 0.75rem;
      padding: var(--wa-space-xs) var(--wa-space-s);
      background: var(--wa-color-surface-raised);
      color: var(--wa-color-text-normal);
    }
    .plot-svg {
      flex: 1;
      min-height: 0;
    }
    .plot-svg svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .placeholder {
      font-style: italic;
      color: var(--wa-color-text-quiet);
      padding: var(--wa-space-m);
    }
  `;
}
