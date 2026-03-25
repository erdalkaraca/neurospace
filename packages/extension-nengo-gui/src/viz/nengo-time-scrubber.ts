import {
  customElement,
  property,
  LitElement,
  css,
  html,
  type TemplateResult,
} from '@eclipse-lyra/core/externals/lit';
import { icon } from '@eclipse-lyra/core';

const DEFAULT_VISIBLE_RANGE = 10;

@customElement('nengo-time-scrubber')
export class NengoTimeScrubber extends LitElement {
  @property({ type: Number }) value = 0;

  @property({ type: Number }) max = 1;

  @property({ type: Number }) step = 0.01;

  @property({ type: Boolean }) running = false;

  @property({ type: Boolean }) canRun = false;

  @property({ attribute: false }) onInput?: (value: number) => void;

  @property({ attribute: false }) onReset?: () => void;

  @property({ attribute: false }) onPlay?: () => void;

  @property({ attribute: false }) onStop?: () => void;

  private _dragging = false;

  private get _visibleRange(): number {
    return this.max <= DEFAULT_VISIBLE_RANGE ? this.max || 1 : DEFAULT_VISIBLE_RANGE;
  }

  private get _viewStart(): number {
    const visible = this._visibleRange;
    const maxStart = Math.max(0, this.max - visible);
    if (maxStart <= 0) return 0;
    const idealStart = this.value - visible * 0.2;
    return Math.max(0, Math.min(maxStart, idealStart));
  }

  private get _viewEnd(): number {
    return this._viewStart + this._visibleRange;
  }

  private _valueFromEvent(e: MouseEvent | TouchEvent): number {
    const track = this.renderRoot.querySelector('.scrubber-track');
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return this._viewStart + pct * this._visibleRange;
  }

  private _handlePointerDown = (e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    this._dragging = true;
    const v = this._valueFromEvent(e);
    this.onInput?.(v);
    const up = () => {
      this._dragging = false;
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchend', up);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('touchmove', move);
    };
    const move = (ev: MouseEvent | TouchEvent) => {
      if (!this._dragging) return;
      this.onInput?.(this._valueFromEvent(ev));
    };
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    window.addEventListener('mousemove', move);
    window.addEventListener('touchmove', move, { passive: true });
  };

  private _formatTime(v: number): string {
    return v.toFixed(3);
  }

  private _tickValues(): number[] {
    const step = this._visibleRange <= 2 ? 0.5 : this._visibleRange <= 5 ? 1 : 2;
    const out: number[] = [];
    const start = Math.floor(this._viewStart / step) * step;
    for (let t = start; t <= this._viewEnd + 0.01; t += step) {
      if (t >= this._viewStart - 0.001) out.push(t);
    }
    return out.length ? out : [this._viewStart];
  }

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--wa-space-m);
      width: 100%;
      min-width: 0;
      flex-shrink: 0;
      padding: var(--wa-space-xs) var(--wa-space-s);
      background: var(--wa-color-surface-raised);
      border-bottom: 1px solid var(--wa-color-surface-border);
    }
    .scrubber-left {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: var(--wa-space-s);
    }
    .scrubber-play-stop {
      padding: var(--wa-space-2xs);
      color: var(--wa-color-text-quiet);
      background: transparent;
      border: none;
      border-radius: var(--wa-border-radius-s);
      cursor: pointer;
    }
    .scrubber-play-stop:hover:not(:disabled) {
      color: var(--wa-color-text-normal);
      background: var(--wa-color-surface-overlay);
    }
    .scrubber-play-stop:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
    .scrubber-time {
      font-size: 0.75rem;
      color: var(--wa-color-text-normal);
      font-variant-numeric: tabular-nums;
      min-width: 4.5em;
    }
    .scrubber-reset {
      padding: var(--wa-space-2xs);
      color: var(--wa-color-text-quiet);
      background: transparent;
      border: none;
      border-radius: var(--wa-border-radius-s);
      cursor: pointer;
    }
    .scrubber-reset:hover {
      color: var(--wa-color-text-normal);
      background: var(--wa-color-surface-overlay);
    }
    .scrubber-center {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--wa-space-2xs);
      overflow: hidden;
    }
    .scrubber-track-wrap {
      position: relative;
      height: 20px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .scrubber-track {
      position: absolute;
      inset: 0;
      border: 1px solid var(--wa-color-surface-border);
      border-radius: var(--wa-border-radius-s);
      background: var(--wa-color-surface-default);
    }
    .scrubber-fill {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      border-radius: var(--wa-border-radius-s) 0 0 var(--wa-border-radius-s);
      background: color-mix(in oklab, var(--wa-color-brand-fill-quiet) 35%, var(--wa-color-surface-default));
      pointer-events: none;
    }
    .scrubber-ticks {
      position: relative;
      height: 14px;
      flex-shrink: 0;
      font-size: 0.625rem;
      color: var(--wa-color-text-quiet);
      font-variant-numeric: tabular-nums;
    }
    .scrubber-tick {
      position: absolute;
      transform: translateX(-50%);
      white-space: nowrap;
    }
  `;

  render(): TemplateResult {
    const visible = this._visibleRange;
    const fillPct = visible > 0 ? Math.max(0, Math.min(100, ((this.value - this._viewStart) / visible) * 100)) : 0;
    const ticks = this._tickValues();

    return html`
      <div class="scrubber-left">
        <button
          type="button"
          class="scrubber-play-stop"
          title=${this.running ? 'Stop' : 'Run'}
          ?disabled=${!this.canRun}
          @click=${() => (this.running ? this.onStop?.() : this.onPlay?.())}
        >
          ${icon(this.running ? 'stop' : 'play', { label: this.running ? 'Stop' : 'Run' })}
        </button>
        <span class="scrubber-time">Time ${this._formatTime(this.value)}</span>
        <button
          type="button"
          class="scrubber-reset"
          title="Reset to start"
          @click=${() => this.onReset?.()}
        >
          ${icon('backward-step', { label: 'Reset to start' })}
        </button>
      </div>
      <div class="scrubber-center">
        <div
          class="scrubber-track-wrap"
          @mousedown=${this._handlePointerDown}
          @touchstart=${this._handlePointerDown}
        >
          <div class="scrubber-track" style="touch-action: none;"></div>
          <div class="scrubber-fill" style="width: ${fillPct}%;"></div>
        </div>
        <div class="scrubber-ticks">
          ${ticks.map(
            (t) =>
              html`<span
                class="scrubber-tick"
                style="left: ${visible > 0 ? ((t - this._viewStart) / visible) * 100 : 0}%"
                >${t.toFixed(1)}</span
              >`
          )}
        </div>
      </div>
    `;
  }
}
