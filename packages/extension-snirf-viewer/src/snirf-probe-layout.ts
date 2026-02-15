import {
  customElement,
  property,
  LitElement,
  css,
  html,
  nothing,
} from '@kispace-io/core/externals/lit';
import type { SnirfDataBlock, SnirfProbe } from './types.js';
import {
  resolveToken,
  valueToColor,
  getRowValueRange,
  getGlobalValueRange,
} from './snirf-utils.js';

const SIZE = 350;

@customElement('snirf-probe-layout')
export class SnirfProbeLayout extends LitElement {
  @property({ attribute: false })
  block: SnirfDataBlock | null = null;

  @property({ attribute: false })
  probe: SnirfProbe | undefined;

  @property({ type: Number })
  timeIndex = 0;

  private resolve = (token: string, fallback: string) =>
    resolveToken(token, fallback);

  private valueToColor = (v: number, vMin: number, vMax: number) =>
    valueToColor(v, vMin, vMax, this.resolve);

  private getChannelCountAndRowAtTime(): { nChannels: number; rowAtTime: number[] } | null {
    const block = this.block;
    if (!block?.dataTimeSeries?.length) return null;

    const data = block.dataTimeSeries;
    const nRows = data.length;
    const nCols = data[0]?.length ?? 0;
    const mlLen = block.measurementList?.length ?? 0;

    if (nRows === 0 && nCols === 0 && mlLen === 0) return null;

    const isRowMajor = nRows >= nCols || (nCols === 0 && mlLen > 0);
    const nChannels = isRowMajor
      ? Math.max(nCols, mlLen)
      : Math.max(nRows, mlLen);
    if (nChannels === 0) return null;

    const timeDim = isRowMajor ? nRows : nCols;
    const timeIdx = Math.min(Math.max(0, this.timeIndex), timeDim - 1);
    const rowAtTime = isRowMajor
      ? (data[timeIdx] ?? []).slice(0, nChannels)
      : data.map((row) => Number(row[timeIdx] ?? 0)).slice(0, nChannels);

    return { nChannels, rowAtTime };
  }

  private drawCanvas(canvas: HTMLCanvasElement | null): void {
    if (!canvas || !this.block) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bgFill = this.resolve('--wa-color-surface-raised', '#1e1e1e');
    const strokeColor = this.resolve('--wa-color-neutral-border-quiet', 'rgba(128,128,128,0.5)');
    const sourceFill = this.resolve('--wa-color-cyan-50', '#00bcd4');
    const detectorFill = this.resolve('--wa-color-green-50', '#4caf50');

    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx.fillStyle = bgFill;
    ctx.fillRect(0, 0, SIZE, SIZE);

    const hasProbeGeometry =
      (this.probe?.sourcePos2D?.length ?? 0) > 0 ||
      (this.probe?.sourcePos3D?.length ?? 0) > 0 ||
      (this.probe?.detectorPos2D?.length ?? 0) > 0 ||
      (this.probe?.detectorPos3D?.length ?? 0) > 0;

    if (!hasProbeGeometry) {
      this.drawChannelGrid(ctx, strokeColor);
      return;
    }

    this.drawProbeGeometry(ctx, sourceFill, detectorFill, strokeColor);
  }

  private drawChannelGrid(
    ctx: CanvasRenderingContext2D,
    strokeColor: string
  ): void {
    const info = this.getChannelCountAndRowAtTime();
    if (!info) return;

    const { nChannels, rowAtTime } = info;
    const { vMin, vMax } = getGlobalValueRange(this.block);
    const cols = Math.ceil(Math.sqrt(nChannels));
    const rows = Math.ceil(nChannels / cols);
    const cellW = SIZE / cols;
    const cellH = SIZE / rows;
    const r = Math.min(cellW, cellH) * 0.35;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(SIZE / 2, SIZE / 2, 140, 170, 0, 0, 2 * Math.PI);
    ctx.stroke();

    const safeVal = (v: unknown) => typeof v === 'number' && isFinite(v);
    const fallbackFill = this.resolve('--wa-color-neutral-50', 'rgba(180,180,180,0.8)');

    for (let chIdx = 0; chIdx < nChannels; chIdx++) {
      const col = chIdx % cols;
      const row = Math.floor(chIdx / cols);
      const cx = cellW * (col + 0.5);
      const cy = cellH * (row + 0.5);
      const val = rowAtTime[chIdx];
      const fill =
        safeVal(val) && vMin !== Infinity && vMax !== -Infinity
          ? this.valueToColor(val as number, vMin, vMax)
          : fallbackFill;

      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  private drawProbeGeometry(
    ctx: CanvasRenderingContext2D,
    sourceFill: string,
    detectorFill: string,
    strokeColor: string
  ): void {
    const block = this.block;
    const probe = this.probe;
    if (!block || !probe) return;

    let pos2D: number[][] | undefined = probe?.sourcePos2D ?? probe?.sourcePos3D;
    let det2D: number[][] | undefined = probe?.detectorPos2D ?? probe?.detectorPos3D;
    let derivedLayout = false;
    const srcIdxToPos = new Map<number, number[]>();
    const detIdxToPos = new Map<number, number[]>();

    if ((!pos2D?.length && !det2D?.length) && block?.measurementList?.length) {
      derivedLayout = true;
      const srcIds = [...new Set(block.measurementList.map((m) => m.sourceIndex))].sort(
        (a, b) => a - b
      );
      const detIds = [...new Set(block.measurementList.map((m) => m.detectorIndex))].sort(
        (a, b) => a - b
      );
      const nSrc = Math.max(srcIds.length, 1);
      const nDet = Math.max(detIds.length, 1);
      const r = 80;
      const cx = SIZE / 2;
      const cy = SIZE / 2;
      pos2D = srcIds.map((sid, i) => {
        const a = (i / nSrc) * 2 * Math.PI - Math.PI / 2;
        const pt = [cx + r * Math.cos(a), cy + r * Math.sin(a)] as number[];
        srcIdxToPos.set(sid, pt);
        return pt;
      });
      det2D = detIds.map((did, i) => {
        const a = (i / nDet) * 2 * Math.PI - Math.PI / 2 + Math.PI / 4;
        const pt = [cx + r * 0.7 * Math.cos(a), cy + r * 0.7 * Math.sin(a)] as number[];
        detIdxToPos.set(did, pt);
        return pt;
      });
    }

    if (!pos2D?.length || !det2D?.length) {
      this.drawChannelGrid(ctx, strokeColor);
      return;
    }

    const sources = pos2D;
    const detectors = det2D;
    const half = SIZE / 2;

    const project = (x: number, y: number) => {
      if (derivedLayout) return { x, y };
      const allX = [
        ...sources.map((p) => p[0]),
        ...detectors.map((p) => p[0]),
      ].filter((v) => typeof v === 'number');
      const allY = [
        ...sources.map((p) => p[1]),
        ...detectors.map((p) => p[1]),
      ].filter((v) => typeof v === 'number');
      if (allX.length === 0 || allY.length === 0) return { x: half, y: half };
      const minX = Math.min(...allX);
      const maxX = Math.max(...allX);
      const minY = Math.min(...allY);
      const maxY = Math.max(...allY);
      const rawRange = Math.max(maxX - minX, maxY - minY, 1e-10);
      const range = rawRange * 1.2;
      const scale = 150 / range;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      return {
        x: half + (x - cx) * scale,
        y: half - (y - cy) * scale,
      };
    };

    const info = this.getChannelCountAndRowAtTime();
    if (!info) return;
    const { rowAtTime } = info;
    const { vMin, vMax } = getGlobalValueRange(block);
    const vSpan = Math.max(vMax - vMin, 1e-10);

    const list = block?.measurementList ?? [];
    const channelLines = list.slice(0, 80).map((m, chIdx) => {
      const src =
        (derivedLayout ? srcIdxToPos.get(m.sourceIndex) : sources[m.sourceIndex - 1]) ??
        sources[0];
      const det =
        (derivedLayout ? detIdxToPos.get(m.detectorIndex) : detectors[m.detectorIndex - 1]) ??
        detectors[0];
      const p1 = project(src[0], src[1]);
      const p2 = project(det[0], det[1]);
      const val = rowAtTime[chIdx];
      const stroke =
        typeof val === 'number' && isFinite(val)
          ? this.valueToColor(val, vMin, vMax)
          : strokeColor;
      const norm = typeof val === 'number' && isFinite(val)
        ? (val - vMin) / vSpan
        : 0.5;
      const lineWidth = 1 + norm * 3;
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke, lineWidth, midX, midY, norm };
    });

    ctx.fillStyle = sourceFill;
    for (const p of sources) {
      const pt = project(p[0] ?? 0, p[1] ?? 0);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.fillStyle = detectorFill;
    for (const p of detectors) {
      const pt = project(p[0] ?? 0, p[1] ?? 0);
      ctx.fillRect(pt.x - 5, pt.y - 5, 10, 10);
    }

    ctx.lineCap = 'round';
    for (const l of channelLines) {
      ctx.strokeStyle = l.stroke;
      ctx.lineWidth = l.lineWidth;
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    }

    for (const l of channelLines) {
      const r = 3 + l.norm * 5;
      ctx.fillStyle = l.stroke;
      ctx.beginPath();
      ctx.arc(l.midX, l.midY, r, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  private renderProbeLegend() {
    return html`
      <div class="probe-legend">
        <span>low</span>
        <div
          class="probe-legend-bar"
          style="background: linear-gradient(to right, var(--wa-color-blue-50), var(--wa-color-neutral-50), var(--wa-color-red-50));"
        ></div>
        <span>high</span>
      </div>
    `;
  }

  override updated(changedProperties: Map<string, unknown>) {
    super.updated?.(changedProperties);
    const canvas = this.shadowRoot?.querySelector<HTMLCanvasElement>('.probe-canvas') ?? null;
    this.drawCanvas(canvas);
  }

  override render() {
    if (!this.block) return nothing;

    const hasProbeGeometry =
      (this.probe?.sourcePos2D?.length ?? 0) > 0 ||
      (this.probe?.sourcePos3D?.length ?? 0) > 0 ||
      (this.probe?.detectorPos2D?.length ?? 0) > 0 ||
      (this.probe?.detectorPos3D?.length ?? 0) > 0;

    const hasFallback = this.getChannelCountAndRowAtTime() !== null;

    if (!hasProbeGeometry && !hasFallback) {
      return html`<div class="probe-placeholder">No probe geometry</div>`;
    }

    return html`
      <div class="probe-canvas-container">
        <canvas class="probe-canvas" width=${SIZE} height=${SIZE}></canvas>
      </div>
      ${this.renderProbeLegend()}
    `;
  }

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 200px;
    }

    .probe-canvas-container {
      width: ${SIZE}px;
      height: ${SIZE}px;
      flex-shrink: 0;
    }

    .probe-canvas {
      display: block;
      width: ${SIZE}px;
      height: ${SIZE}px;
      border-radius: 4px;
    }

    .probe-legend {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: var(--wa-color-text-quiet);
    }

    .probe-legend-bar {
      flex: 1;
      height: 8px;
      border-radius: 4px;
    }

    .probe-placeholder {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--wa-color-text-quiet);
      font-size: 0.875rem;
    }
  `;
}
