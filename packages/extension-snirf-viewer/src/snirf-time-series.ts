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
  getTimeTickStep,
  getChannelLabel,
} from './snirf-utils.js';

export type TimeViewChangeEvent = CustomEvent<{ start: number; end: number }>;
export type TimeIndexChangeEvent = CustomEvent<number>;

@customElement('snirf-time-series')
export class SnirfTimeSeries extends LitElement {
  @property({ attribute: false })
  block: SnirfDataBlock | null = null;

  @property({ attribute: false })
  probe: SnirfProbe | undefined;

  @property({ type: Number })
  timeIndex = 0;

  @property({ attribute: false })
  timeViewStart: number | null = null;

  @property({ attribute: false })
  timeViewEnd: number | null = null;

  private readonly rowHeight = 28;
  private lastChartLayout: {
    pad: { l: number };
    plotW: number;
    vStart: number;
    tRange: number;
    time: number[];
  } | null = null;
  private resizeObserver?: ResizeObserver;
  private chartScheduled = false;
  private chartContainerObserved = false;

  private getTimeBounds(): { tMin: number; tMax: number } | null {
    if (!this.block?.time?.length) return null;
    const tMin = Math.min(...this.block.time);
    const tMax = Math.max(...this.block.time);
    return { tMin, tMax };
  }

  private getTimeViewState() {
    const b = this.getTimeBounds();
    if (!b) return null;
    const { tMin, tMax } = b;
    const fullSpan = tMax - tMin;
    const viewStart = this.timeViewStart ?? tMin;
    const viewEnd = this.timeViewEnd ?? tMax;
    const viewSpan = viewEnd - viewStart;
    return { tMin, tMax, fullSpan, viewStart, viewEnd, viewSpan };
  }

  private timeToIndex(t: number): number {
    if (!this.block?.time?.length) return 0;
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < this.block.time.length; i++) {
      const d = Math.abs(this.block.time[i] - t);
      if (d < bestDiff) {
        bestDiff = d;
        best = i;
      }
    }
    return best;
  }

  private setTimeView(viewStart: number, viewEnd: number) {
    const b = this.getTimeBounds();
    if (!b) return;
    const { tMin, tMax } = b;
    const span = viewEnd - viewStart;
    const maxSpan = tMax - tMin;
    const minSpan = Math.max(maxSpan / 1000, 0.01);
    const clampedSpan = Math.min(Math.max(span, minSpan), maxSpan);
    const clampedStart = Math.max(tMin, Math.min(tMax - clampedSpan, viewStart));
    const clampedEnd = clampedStart + clampedSpan;
    this.dispatchEvent(
      new CustomEvent('time-view-change', {
        detail: { start: clampedStart, end: clampedEnd },
        bubbles: true,
      }) as TimeViewChangeEvent
    );
  }

  private clampAndSetTimeView(center: number, viewSpan: number) {
    const s = this.getTimeViewState();
    if (!s) return;
    const { tMin, tMax } = s;
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
    this.setTimeView(newStart, newEnd);
  }

  private handleChartWheel = (e: WheelEvent) => {
    const s = this.getTimeViewState();
    if (!s) return;
    const { fullSpan, viewStart, viewEnd, viewSpan } = s;
    const center = (viewStart + viewEnd) / 2;
    const zoomFactor = e.deltaY > 0 ? 1.2 : 1 / 1.2;
    const newSpan = Math.min(Math.max(viewSpan * zoomFactor, fullSpan / 1000), fullSpan);
    this.clampAndSetTimeView(center, newSpan);
    e.preventDefault();
  };

  private handleTimeScrollbarPointerDown = (e: PointerEvent) => {
    const track = (e.target as HTMLElement).closest('.time-scrollbar-track');
    if (!track) return;
    const s = this.getTimeViewState();
    if (!s) return;
    const { tMin, fullSpan, viewSpan } = s;
    const rect = track.getBoundingClientRect();
    const t = tMin + ((e.clientX - rect.left) / rect.width) * fullSpan;
    this.dispatchTimeIndexChange(this.timeToIndex(t));
    this.clampAndSetTimeView(t, viewSpan);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  private handleTimeScrollbarThumbPointerDown = (e: PointerEvent) => {
    e.stopPropagation();
    const thumb = e.target as HTMLElement;
    const track = thumb.closest('.time-scrollbar-track');
    const s = this.getTimeViewState();
    if (!track || !s) return;
    const { fullSpan, viewStart, viewSpan } = s;
    const startX = e.clientX;
    thumb.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => {
      const rect = track.getBoundingClientRect();
      const dt = ((ev.clientX - startX) / rect.width) * fullSpan;
      const newCenter = viewStart + dt + viewSpan / 2;
      this.clampAndSetTimeView(newCenter, viewSpan);
    };
    const up = () => {
      thumb.releasePointerCapture(e.pointerId);
      thumb.removeEventListener('pointermove', move);
      thumb.removeEventListener('pointerup', up);
      thumb.removeEventListener('pointercancel', up);
    };
    thumb.addEventListener('pointermove', move);
    thumb.addEventListener('pointerup', up);
    thumb.addEventListener('pointercancel', up);
  };

  private dispatchTimeIndexChange(index: number) {
    this.dispatchEvent(
      new CustomEvent('time-index-change', {
        detail: index,
        bubbles: true,
      }) as TimeIndexChangeEvent
    );
  }

  private handleChartPointerDown = (e: PointerEvent) => {
    const wrapper = (e.target as HTMLElement).closest('#chartWrapper');
    const canvas = wrapper?.querySelector('.time-series-canvas') as HTMLCanvasElement;
    if (!wrapper || !canvas || !this.lastChartLayout || !this.block?.time?.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const { pad, plotW, vStart, tRange } = this.lastChartLayout;
    const tMin = Math.min(...this.block.time);
    const tMax = Math.max(...this.block.time);

    const xToTime = (clientX: number) => {
      const rx = clientX - rect.left;
      return vStart + ((rx - pad.l) / plotW) * tRange;
    };
    const cursorT = this.block.time[this.timeIndex];
    const cursorX = pad.l + ((cursorT - vStart) / tRange) * plotW;
    const hitRadius = 12;
    const isNearCursor = Math.abs(x - cursorX) <= hitRadius;

    if (isNearCursor) {
      e.preventDefault();
      wrapper.setPointerCapture(e.pointerId);
      const move = (ev: Event) => {
        const t = Math.max(tMin, Math.min(tMax, xToTime((ev as PointerEvent).clientX)));
        this.dispatchTimeIndexChange(this.timeToIndex(t));
      };
      const up = () => {
        wrapper.releasePointerCapture(e.pointerId);
        wrapper.removeEventListener('pointermove', move);
        wrapper.removeEventListener('pointerup', up);
        wrapper.removeEventListener('pointercancel', up);
      };
      wrapper.addEventListener('pointermove', move as EventListener);
      wrapper.addEventListener('pointerup', up);
      wrapper.addEventListener('pointercancel', up);
    } else {
      const t = Math.max(tMin, Math.min(tMax, xToTime(e.clientX)));
      this.dispatchTimeIndexChange(this.timeToIndex(t));
    }
  };

  private drawTimeSeries(canvas: HTMLCanvasElement, w: number) {
    if (!this.block || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { dataTimeSeries, time } = this.block;
    const nChannels = dataTimeSeries[0]?.length ?? 0;
    if (nChannels === 0) return;
    const pad = { t: 28, r: 12, b: 24, l: 36 };
    const nSamples = dataTimeSeries.length;
    if (nSamples < 2) return;

    const tMin = Math.min(...time);
    const tMax = Math.max(...time);
    const tRangeFull = tMax - tMin || 1;
    const viewStart = this.timeViewStart ?? tMin;
    const viewEnd = this.timeViewEnd ?? tMax;
    const viewSpan = Math.max(viewEnd - viewStart, tRangeFull * 0.01);
    const vStart = Math.max(tMin, Math.min(tMax - viewSpan, viewStart));
    const vEnd = Math.min(tMax, vStart + viewSpan);
    const tRange = vEnd - vStart || 1;
    const rowH = this.rowHeight - 4;
    const rowGap = 4;
    const canvasHeight = pad.t + pad.b + nChannels * (rowH + rowGap);
    canvas.height = canvasHeight;
    const plotW = w - pad.l - pad.r;
    const plotHTotal = nChannels * (rowH + rowGap) - rowGap;

    ctx.fillStyle = resolveToken('--wa-color-surface-default', '#1a1a1a');
    ctx.fillRect(0, 0, w, canvasHeight);

    const traceColor = resolveToken('--wa-color-text-normal', '#1a1a1a');
    let globalVMin = Infinity;
    let globalVMax = -Infinity;
    for (let chIdx = 0; chIdx < nChannels; chIdx++) {
      for (let i = 0; i < nSamples; i++) {
        const v = dataTimeSeries[i][chIdx];
        if (typeof v === 'number' && isFinite(v)) {
          globalVMin = Math.min(globalVMin, v);
          globalVMax = Math.max(globalVMax, v);
        }
      }
    }
    const globalVRange = Math.max(globalVMax - globalVMin, 1e-10);
    const scaleVal = globalVRange * 0.1;
    const scaleLabel =
      scaleVal >= 1 || scaleVal <= 0.001 ? scaleVal.toExponential(1) : scaleVal.toFixed(3);

    const cursorT = time[this.timeIndex] ?? vStart;
    let cursorX: number;
    let cursorVisible = true;
    if (vStart <= cursorT && cursorT <= vEnd) {
      cursorX = pad.l + ((cursorT - vStart) / tRange) * plotW;
    } else if (cursorT < vStart) {
      cursorX = pad.l;
      cursorVisible = false;
    } else {
      cursorX = pad.l + plotW;
      cursorVisible = false;
    }

    for (let chIdx = 0; chIdx < nChannels; chIdx++) {
      const rowY = pad.t + chIdx * (rowH + rowGap);
      const plotH = rowH - 2;
      const isGroupEnd =
        chIdx < nChannels - 1 &&
        this.block.measurementList &&
        this.block.measurementList[chIdx] &&
        this.block.measurementList[chIdx + 1] &&
        (this.block.measurementList[chIdx].sourceIndex !==
          this.block.measurementList[chIdx + 1].sourceIndex ||
          this.block.measurementList[chIdx].detectorIndex !==
            this.block.measurementList[chIdx + 1].detectorIndex);

      let minVal = Infinity;
      let maxVal = -Infinity;
      for (let i = 0; i < nSamples; i++) {
        const v = dataTimeSeries[i][chIdx];
        if (typeof v === 'number' && isFinite(v)) {
          minVal = Math.min(minVal, v);
          maxVal = Math.max(maxVal, v);
        }
      }
      const vRange = maxVal - minVal || 1;
      const vMin = minVal - vRange * 0.05;
      const vMax = maxVal + vRange * 0.05;
      const vSpan = vMax - vMin;

      ctx.strokeStyle = resolveToken('--wa-color-neutral-border-quiet', 'rgba(128,128,128,0.25)');
      ctx.lineWidth = 1;
      ctx.strokeRect(pad.l, rowY, plotW, plotH);
      if (isGroupEnd) {
        ctx.strokeStyle = resolveToken('--wa-color-neutral-border-normal', 'rgba(128,128,128,0.5)');
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pad.l, rowY + plotH + 1);
        ctx.lineTo(pad.l + plotW, rowY + plotH + 1);
        ctx.stroke();
      }

      ctx.strokeStyle = traceColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let first = true;
      const addPoint = (t: number, v: number) => {
        const x = pad.l + ((t - vStart) / tRange) * plotW;
        const y = rowY + plotH - ((Number(v) - vMin) / vSpan) * plotH;
        if (first) {
          ctx.moveTo(x, y);
          first = false;
        } else {
          ctx.lineTo(x, y);
        }
      };
      for (let i = 0; i < nSamples; i++) {
        const t = time[i];
        if (t < vStart) {
          if (i + 1 < nSamples && time[i + 1] >= vStart) {
            const t1 = time[i + 1];
            const frac = (vStart - t) / (t1 - t);
            const v =
              Number(dataTimeSeries[i][chIdx]) +
              frac *
                (Number(dataTimeSeries[i + 1][chIdx]) - Number(dataTimeSeries[i][chIdx]));
            addPoint(vStart, v);
          }
          continue;
        }
        if (t > vEnd) {
          if (i > 0 && time[i - 1] <= vEnd) {
            const t0 = time[i - 1];
            const frac = (vEnd - t0) / (t - t0);
            const v =
              Number(dataTimeSeries[i - 1][chIdx]) +
              frac * (Number(dataTimeSeries[i][chIdx]) - Number(dataTimeSeries[i - 1][chIdx]));
            addPoint(vEnd, v);
          }
          break;
        }
        addPoint(t, dataTimeSeries[i][chIdx]);
      }
      ctx.stroke();
    }

    const cursorColor = resolveToken('--wa-color-cyan-50', '#00bcd4');
    ctx.strokeStyle = cursorVisible ? cursorColor : 'rgba(0,188,212,0.5)';
    ctx.lineWidth = cursorVisible ? 2 : 1;
    ctx.setLineDash(cursorVisible ? [] : [4, 4]);
    ctx.beginPath();
    ctx.moveTo(cursorX, pad.t);
    ctx.lineTo(cursorX, pad.t + plotHTotal);
    ctx.stroke();
    ctx.setLineDash([]);

    const axisY = pad.t + plotHTotal;
    const timeLabel = `${cursorT.toFixed(2)} s`;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const labelX = Math.max(pad.l + 30, Math.min(pad.l + plotW - 30, cursorX));
    ctx.fillStyle = cursorColor;
    ctx.fillText(timeLabel, labelX, axisY + 6);

    const scaleLineH = 24;
    const scaleY = pad.t + 4;
    ctx.strokeStyle = resolveToken('--wa-color-text-quiet', 'rgba(150,150,150,0.8)');
    ctx.fillStyle = resolveToken('--wa-color-text-quiet', 'rgba(150,150,150,0.8)');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad.l + 4, scaleY);
    ctx.lineTo(pad.l + 4, scaleY + scaleLineH);
    ctx.stroke();
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(scaleLabel, pad.l + 10, scaleY);

    this.lastChartLayout = { pad, plotW, vStart, tRange, time };
  }

  private renderTimeScrollbar() {
    const block = this.block;
    const time = block?.time;
    if (!time?.length || time.length < 2) return nothing;
    const s = this.getTimeViewState();
    if (!s) return nothing;
    const { tMin, tMax, fullSpan, viewStart, viewSpan } = s;
    const span = fullSpan || 1;
    const leftPct = ((viewStart - tMin) / span) * 100;
    const widthPct = (viewSpan / span) * 100;
    const cursorT = time[this.timeIndex] ?? viewStart + viewSpan / 2;
    const cursorPct = ((cursorT - tMin) / span) * 100;
    const tickStep = getTimeTickStep(span);
    const firstTick = Math.floor(tMin / tickStep) * tickStep;
    const ticks: number[] = [];
    for (let t = firstTick; t <= tMax; t += tickStep) {
      if (t >= tMin) ticks.push(t);
    }

    return html`
      <div class="time-axis-footer">
        <div class="time-axis-label">Time (s)</div>
        <div class="time-axis-ticks">
          ${ticks.map(
            (tick) => html`
              <span class="time-axis-tick" style="left: ${((tick - tMin) / span) * 100}%">
                ${tick}
              </span>
            `
          )}
        </div>
        <div class="time-scrollbar" @pointerdown=${this.handleTimeScrollbarPointerDown}>
          <div class="time-scrollbar-track">
            <div
              class="time-scrollbar-thumb"
              style="left: ${leftPct}%; width: ${widthPct}%"
              @pointerdown=${this.handleTimeScrollbarThumbPointerDown}
            ></div>
            <div
              class="time-scrollbar-cursor"
              style="left: ${cursorPct}%"
              title="${cursorT.toFixed(2)} s"
            ></div>
          </div>
        </div>
      </div>
    `;
  }

  private scheduleChartDraw() {
    if (this.chartScheduled) return;
    this.chartScheduled = true;
    requestAnimationFrame(() => {
      this.chartScheduled = false;
      const wrapper = this.renderRoot?.querySelector('#chartWrapper') as HTMLElement;
      const canvas = this.renderRoot?.querySelector('.time-series-canvas') as HTMLCanvasElement;
      if (canvas && wrapper) {
        const rect = wrapper.getBoundingClientRect();
        canvas.width = rect.width;
        this.drawTimeSeries(canvas, rect.width);
      }
    });
  }

  override connectedCallback() {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(() => this.scheduleChartDraw());
  }

  override disconnectedCallback() {
    this.resizeObserver?.disconnect();
    super.disconnectedCallback();
  }

  override updated(changedProperties: Map<string, unknown>) {
    super.updated?.(changedProperties);
    if (changedProperties.has('block') && !this.block) {
      this.chartContainerObserved = false;
    }
    if (
      changedProperties.has('block') ||
      changedProperties.has('timeIndex') ||
      changedProperties.has('timeViewStart') ||
      changedProperties.has('timeViewEnd')
    ) {
      this.scheduleChartDraw();
    }
    if (this.chartContainerObserved || !this.resizeObserver || !this.block) return;
    const container = this.renderRoot?.querySelector('#chartContainer');
    if (container) {
      this.resizeObserver.observe(container);
      this.chartContainerObserved = true;
    }
  }

  override render() {
    if (!this.block) return nothing;
    const nChannels = this.block.dataTimeSeries[0]?.length ?? 0;

    return html`
      <div class="chart-container" id="chartContainer">
        <div class="chart-scroll-area">
          <div class="chart-body">
            <div class="chart-labels">
              ${Array.from(
                { length: nChannels },
                (_, i) =>
                  html`
                    <div
                      class="chart-label"
                      style="height: ${this.rowHeight}px; line-height: ${this.rowHeight}px;"
                    >
                      ${getChannelLabel(i, this.block, this.probe)}
                    </div>
                  `
              )}
            </div>
            <div
              class="chart-wrapper"
              id="chartWrapper"
              @wheel=${this.handleChartWheel}
              @pointerdown=${this.handleChartPointerDown}
            >
              <canvas class="time-series-canvas"></canvas>
            </div>
          </div>
        </div>
        <div class="chart-time-footer">${this.renderTimeScrollbar()}</div>
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: flex;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }

    .chart-container {
      flex: 1;
      min-height: 200px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .chart-scroll-area {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: auto;
    }

    .chart-body {
      display: flex;
      min-width: min-content;
    }

    .chart-labels {
      flex-shrink: 0;
      min-width: 100px;
      padding-top: 28px;
      padding-right: 0;
      background: var(--wa-color-surface-default);
    }

    .chart-label {
      font-size: 11px;
      color: var(--wa-color-text-normal);
      text-align: right;
      white-space: nowrap;
    }

    .chart-wrapper {
      flex: 1;
      min-width: 0;
      cursor: pointer;
    }

    .chart-time-footer {
      flex-shrink: 0;
      padding-top: 4px;
      background: var(--wa-color-surface-default);
      border-top: 1px solid var(--wa-color-neutral-border-quiet);
    }

    .time-series-canvas {
      width: 100%;
      display: block;
      border-radius: 4px;
    }

    .time-axis-footer {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .time-axis-label {
      font-size: 11px;
      color: var(--wa-color-text-quiet);
      text-align: center;
    }

    .time-axis-ticks {
      position: relative;
      height: 14px;
      font-size: 10px;
      color: var(--wa-color-text-quiet);
    }

    .time-axis-tick {
      position: absolute;
      transform: translateX(-50%);
      white-space: nowrap;
    }

    .time-scrollbar {
      flex-shrink: 0;
      padding: 2px 0;
    }

    .time-scrollbar-track {
      height: 12px;
      background: var(--wa-color-surface-raised);
      border: 1px solid var(--wa-color-neutral-border-quiet);
      border-radius: 6px;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }

    .time-scrollbar-thumb {
      position: absolute;
      top: 0;
      bottom: 0;
      min-width: 20px;
      background: var(--wa-color-cyan-50);
      border-radius: 4px;
      cursor: grab;
      opacity: 0.7;
    }

    .time-scrollbar-thumb:hover {
      opacity: 1;
    }

    .time-scrollbar-thumb:active {
      cursor: grabbing;
    }

    .time-scrollbar-cursor {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 3px;
      margin-left: -1.5px;
      background: var(--wa-color-cyan-50, #00bcd4);
      pointer-events: none;
      z-index: 1;
    }
  `;
}
