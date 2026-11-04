import {
  LitElement,
  css,
  html,
  nothing,
  customElement,
  property,
  state,
  styleMap,
} from '@eclipse-docks/core/externals/lit';

/**
 * Floating experiment window, moved the same way as the HowTo panel:
 * drag the header, follow a dashed preview, and drop to commit the position.
 */
@customElement('ns-exp-window')
export class NsExpWindow extends LitElement {
  @property()
  label = 'Experiment';

  @property({ type: Number })
  width = 300;

  @property({ type: Number })
  height = 300;

  @state()
  private posX = 100;

  @state()
  private posY = 100;

  @state()
  private minimized = false;

  @state()
  private preview: { x: number; y: number } | null = null;

  private dragging = false;
  private grab = { x: 0, y: 0 };

  place(x: number, y: number): void {
    const next = clamp(x, y, this.panelSize());
    this.posX = next.x;
    this.posY = next.y;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('mousemove', this.onMove);
    document.addEventListener('mouseup', this.onUp);
  }

  override disconnectedCallback(): void {
    document.removeEventListener('mousemove', this.onMove);
    document.removeEventListener('mouseup', this.onUp);
    super.disconnectedCallback();
  }

  private panelSize(): { width: number; height: number } {
    const panel = this.renderRoot?.querySelector('.exp-window');
    if (panel instanceof HTMLElement && panel.offsetWidth > 0) {
      return { width: panel.offsetWidth, height: panel.offsetHeight };
    }
    return { width: Math.max(this.width, 220), height: this.height + 44 };
  }

  private onHeaderDown = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('.header-actions')) return;
    const panel = this.renderRoot.querySelector('.exp-window');
    if (!(panel instanceof HTMLElement)) return;
    const rect = panel.getBoundingClientRect();
    this.grab = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.dragging = true;
    this.preview = { x: this.posX, y: this.posY };
    this.parentElement?.append(this);
    event.preventDefault();
  };

  private onMove = (event: MouseEvent): void => {
    if (!this.dragging || !this.preview) return;
    const size = this.panelSize();
    const next = clamp(event.clientX - this.grab.x, event.clientY - this.grab.y, size);
    if (next.x === this.preview.x && next.y === this.preview.y) return;
    this.preview = next;
  };

  private onUp = (): void => {
    if (!this.dragging || !this.preview) return;
    this.dragging = false;
    this.posX = this.preview.x;
    this.posY = this.preview.y;
    this.preview = null;
  };

  private close = (): void => {
    this.dispatchEvent(new Event('exp-close', { bubbles: true }));
  };

  override render() {
    const frame = { left: `${this.posX}px`, top: `${this.posY}px` };
    const size = this.panelSize();
    return html`
      ${this.preview
        ? html`<div
            class="drag-preview"
            style=${styleMap({
              left: `${this.preview.x}px`,
              top: `${this.preview.y}px`,
              width: `${size.width}px`,
              height: `${size.height}px`,
            })}
          ></div>`
        : nothing}
      <div class="exp-window ${this.minimized ? 'minimized' : ''} ${this.preview ? 'dragging' : ''}" style=${styleMap(frame)}>
        <div class="panel-header" @mousedown=${this.onHeaderDown}>
          <div class="header-title"><span>${this.label}</span></div>
          <div class="header-actions" @mousedown=${(event: MouseEvent) => event.stopPropagation()}>
            <wa-button size="s" appearance="plain" title=${this.minimized ? 'Expand' : 'Minimize'} @click=${() => { this.minimized = !this.minimized; }}>
              <wa-icon name=${this.minimized ? 'chevron-up' : 'chevron-down'}></wa-icon>
            </wa-button>
            <wa-button size="s" appearance="plain" title="Close" @click=${this.close}>
              <wa-icon name="xmark"></wa-icon>
            </wa-button>
          </div>
        </div>
        <div class="stage" style=${styleMap({ width: `${this.width}px`, height: `${this.height}px` })}>
          <slot></slot>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      position: fixed;
      z-index: 10000;
      pointer-events: none;
    }

    .drag-preview {
      position: fixed;
      box-sizing: border-box;
      border: 3px dashed var(--wa-color-primary-50, #0066cc);
      background: var(--wa-color-primary-05, rgba(0, 102, 204, 0.05));
      border-radius: var(--wa-border-radius-medium, 8px);
      z-index: 10001;
      pointer-events: none;
      opacity: 0.8;
    }

    .exp-window {
      position: fixed;
      display: flex;
      flex-direction: column;
      min-width: 220px;
      overflow: hidden;
      box-sizing: border-box;
      pointer-events: all;
      background: var(--wa-color-surface-raised, var(--wa-color-neutral-05));
      border: var(--wa-border-width-s, 1px) solid var(--wa-color-neutral-border-loud, var(--wa-color-neutral-25));
      border-radius: var(--wa-border-radius-medium, 8px);
      box-shadow: var(--wa-shadow-large, 0 8px 24px rgba(0, 0, 0, 0.8));
    }

    :host-context(.wa-light) .exp-window {
      background: var(--wa-color-surface-raised, var(--wa-color-neutral-95));
      border-color: var(--wa-color-neutral-border-loud, var(--wa-color-neutral-75));
      box-shadow: var(--wa-shadow-large, 0 8px 24px rgba(0, 0, 0, 0.2));
    }

    .exp-window.dragging {
      opacity: 0.5;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--wa-spacing-small, 8px);
      padding: var(--wa-spacing-small, 8px) var(--wa-spacing-medium, 12px);
      background: var(--wa-color-surface-lowered, var(--wa-color-neutral-10));
      border-bottom: var(--wa-border-width-s, 1px) solid var(--wa-color-neutral-border-loud, var(--wa-color-neutral-25));
      cursor: move;
      user-select: none;
    }

    :host-context(.wa-light) .panel-header {
      background: var(--wa-color-surface-lowered, var(--wa-color-neutral-90));
      border-bottom-color: var(--wa-color-neutral-border-loud, var(--wa-color-neutral-75));
    }

    .header-title {
      min-width: 0;
      font-weight: 600;
      color: var(--wa-color-text-normal, var(--wa-color-neutral-90));
    }

    :host-context(.wa-light) .header-title {
      color: var(--wa-color-text-normal, var(--wa-color-neutral-10));
    }

    .header-title span {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .header-actions {
      display: flex;
      flex: none;
      gap: var(--wa-spacing-x-small, 4px);
    }

    .stage {
      position: relative;
      overflow: hidden;
      background: white;
    }

    .minimized .stage {
      display: none;
    }

    ::slotted(*) {
      position: relative;
      width: 100%;
      height: 100%;
    }
  `;
}

function clamp(x: number, y: number, size: { width: number; height: number }): { x: number; y: number } {
  const maxX = Math.max(0, window.innerWidth - size.width);
  const maxY = Math.max(0, window.innerHeight - size.height);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}
