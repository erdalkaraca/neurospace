import {
  customElement,
  property,
  LitElement,
  css,
  html,
} from '@eclipse-lyra/core/externals/lit';
import type { NengoVizContext } from '../nengo-viz-api';

@customElement('nengo-value-plot')
export class NengoValuePlot extends LitElement {
  @property({ attribute: false })
  context?: NengoVizContext;

  private renderChart() {
    const ctx = this.context;
    if (!ctx?.simProxy?.trange?.length) {
      return html`<span class="placeholder">No data</span>`;
    }

    const trange = ctx.simProxy.trange;
    const data = ctx.simProxy.getProbeData(ctx.nengoObjectId);
    if (!data?.length || !trange.length) return html`<span class="placeholder">No probe data</span>`;

    const nLines = Math.floor(data.length / trange.length) || 1;
    const w = this.clientWidth || 200;
    const h = this.clientHeight || 120;
    const pad = { t: 8, r: 8, b: 20, l: 36 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    const tMin = trange[0] ?? 0;
    const tMax = trange[trange.length - 1] ?? 1;
    const tSpan = tMax - tMin || 1;

    const flatMin = Math.min(...data);
    const flatMax = Math.max(...data);
    const vSpan = flatMax - flatMin || 1;
    const vMin = flatMin - vSpan * 0.05;
    const vMax = flatMax + vSpan * 0.05;
    const vRange = vMax - vMin || 1;

    const toX = (t: number) => pad.l + ((t - tMin) / tSpan) * plotW;
    const toY = (v: number) => pad.t + plotH - ((v - vMin) / vRange) * plotH;

    const plotColors = [
      'var(--wa-color-blue-50)',
      'var(--wa-color-cyan-50)',
      'var(--wa-color-green-50)',
      'var(--wa-color-orange-50)',
      'var(--wa-color-red-50)',
      'var(--wa-color-brand-fill-loud)',
    ];
    const paths: string[] = [];

    for (let line = 0; line < nLines; line++) {
      const points: string[] = [];
      for (let i = 0; i < trange.length; i++) {
        const v = data[i * nLines + line];
        points.push(`${toX(trange[i])},${toY(v)}`);
      }
      paths.push(points.join(' '));
    }

    return html`
      <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <g class="axes">
          <line x1=${pad.l} y1=${pad.t} x2=${pad.l} y2=${pad.t + plotH} stroke="currentColor" opacity="0.3" />
          <line x1=${pad.l} y1=${pad.t + plotH} x2=${pad.l + plotW} y2=${pad.t + plotH} stroke="currentColor" opacity="0.3" />
        </g>
        ${paths.map(
          (pts, i) => html`
            <polyline
              fill="none"
              stroke=${plotColors[i % plotColors.length]}
              stroke-width="1.5"
              points=${pts}
            />
          `
        )}
      </svg>
    `;
  }

  render() {
    const label = this.context?.label ?? 'Value';
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
