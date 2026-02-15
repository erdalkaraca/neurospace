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
import { Niivue } from '@niivue/niivue';

interface NeuroViewerPreferences {
  orientationTextVisible: boolean;
  cornerOrientationText: boolean;
  boldColormap: string;
}

const DEFAULT_PREFERENCES: NeuroViewerPreferences = {
  orientationTextVisible: true,
  cornerOrientationText: false,
  boldColormap: 'hot',
};

const BOLD_COLORMAPS = [
  { value: 'warm', label: 'Warm (red–yellow)' },
  { value: 'hot', label: 'Hot' },
  { value: 'plasma', label: 'Plasma' },
  { value: 'viridis', label: 'Viridis' },
  { value: 'inferno', label: 'Inferno' },
  { value: 'gray', label: 'Gray' },
] as const;

const SUPPORTED_EXTENSIONS = [
  '.nii',
  '.nii.gz',
  '.dcm',
  '.nrrd',
  '.mgh',
  '.mgz',
  '.mif',
];

const isSupportedNeuroFile = (file: File): boolean => {
  const fileName = file.getName().toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
};

editorRegistry.registerEditorInputHandler({
  canHandle: (input): input is File =>
    input instanceof File && isSupportedNeuroFile(input),
  handle: async (input: File) => {
    const editorInput = {
      title: input.getName(),
      data: input,
      key: input.getWorkspacePath(),
      editorId: 'neuro-viewer',
      icon: 'brain',
      noOverflow: false,
      state: {},
    } as EditorInput;
    editorInput.widgetFactory = () =>
      html`<k-neuro-viewer id="neuro-viewer" .input=${editorInput}></k-neuro-viewer>`;
    return editorInput;
  },
  ranking: 1000,
});

@customElement('k-neuro-viewer')
export class KNeuroViewer extends KPart {
  @property({ attribute: false })
  public input?: EditorInput;

  @state()
  private error?: string;

  @state()
  private loading = true;

  @state()
  private orientationTextVisible = true;

  @state()
  private cornerOrientationText = false;

  @state()
  private frameIndex = 0;

  @state()
  private nFrames = 0;

  @state()
  private isPlaying = false;

  @state()
  private colormap = 'hot';

  private playInterval?: ReturnType<typeof setInterval>;

  private nv?: Niivue;

  public isEditor = true;

  protected doClose() {
    this.stopPlayback();
    if (this.nv) {
      this.nv.cleanup();
      this.nv = undefined;
    }
    this.input = undefined;
    this.error = undefined;
    this.nFrames = 0;
    this.frameIndex = 0;
  }

  private async loadPreferences(): Promise<NeuroViewerPreferences> {
    const stored = (await this.getDialogSetting()) as
      | Partial<NeuroViewerPreferences>
      | undefined;
    return { ...DEFAULT_PREFERENCES, ...stored };
  }

  private persistPreferences() {
    this.setDialogSetting({
      orientationTextVisible: this.orientationTextVisible,
      cornerOrientationText: this.cornerOrientationText,
      boldColormap: this.colormap,
    }).catch(() => {});
  }

  private setOrientationTextVisible(visible: boolean) {
    this.orientationTextVisible = visible;
    this.nv?.setIsOrientationTextVisible(visible);
    this.persistPreferences();
    this.updateToolbar();
  }

  private setCornerOrientationText(corner: boolean) {
    this.cornerOrientationText = corner;
    this.nv?.setCornerOrientationText(corner);
    this.persistPreferences();
    this.updateToolbar();
  }

  private setFrame(index: number) {
    const vol = this.nv?.volumes?.[0];
    if (!vol || this.nFrames <= 1) return;
    const clamped = Math.max(0, Math.min(this.nFrames - 1, index));
    this.frameIndex = clamped;
    this.nv?.setFrame4D(vol.id, clamped);
    this.updateToolbar();
  }

  private togglePlayback() {
    if (this.nFrames <= 1) return;
    if (this.isPlaying) {
      this.stopPlayback();
      return;
    }
    this.isPlaying = true;
    const fps = 2;
    this.playInterval = setInterval(() => {
      this.setFrame((this.frameIndex + 1) % this.nFrames);
    }, 1000 / fps);
    this.updateToolbar();
  }

  private stopPlayback() {
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = undefined;
    }
    this.isPlaying = false;
    this.updateToolbar();
  }

  private setColormap(name: string) {
    const vol = this.nv?.volumes?.[0];
    if (!vol || this.nFrames <= 1) return;
    this.colormap = name;
    this.nv?.setColormap(vol.id, name);
    this.persistPreferences();
    this.updateToolbar();
  }

  protected renderToolbar() {
    if (!this.nv || this.loading || this.error) return nothing;
    return html`
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
        ${this.nFrames > 1
          ? html`
              <span style="font-size: 0.875rem; color: var(--wa-color-text-quiet);">
                Frame
              </span>
              <input
                type="range"
                min="0"
                max=${this.nFrames - 1}
                value=${this.frameIndex}
                @input=${(e: Event) =>
                  this.setFrame(parseInt((e.target as HTMLInputElement).value, 10))}
                style="width: 120px; cursor: pointer;"
                title="Scrub through BOLD time series"
              />
              <span style="font-size: 0.75rem; color: var(--wa-color-text-quiet); min-width: 3em;">
                ${this.frameIndex + 1} / ${this.nFrames}
              </span>
              <wa-button
                type="button"
                size="small"
                appearance="outlined"
                variant="neutral"
                title="Previous frame"
                @click=${() => this.setFrame(this.frameIndex - 1)}
              >
                <wa-icon name="chevron-left" label="Previous"></wa-icon>
              </wa-button>
              <wa-button
                type="button"
                size="small"
                appearance="outlined"
                variant="neutral"
                title="Next frame"
                @click=${() => this.setFrame(this.frameIndex + 1)}
              >
                <wa-icon name="chevron-right" label="Next"></wa-icon>
              </wa-button>
              <wa-button
                type="button"
                size="small"
                appearance="${this.isPlaying ? 'filled' : 'outlined'}"
                variant="neutral"
                title="${this.isPlaying ? 'Pause' : 'Play'} BOLD animation"
                @click=${() => this.togglePlayback()}
              >
                <wa-icon
                  name="${this.isPlaying ? 'pause' : 'play'}"
                  label="${this.isPlaying ? 'Pause' : 'Play'}"
                ></wa-icon>
              </wa-button>
              <label style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 0.875rem; color: var(--wa-color-text-quiet);">
                  Colormap
                </span>
                <select
                  .value=${this.colormap}
                  @change=${(e: Event) =>
                    this.setColormap((e.target as HTMLSelectElement).value)}
                  style="font-size: 0.875rem; padding: 0.25rem 0.5rem; border-radius: 4px; background: var(--wa-color-surface-default); color: var(--wa-color-text-default);"
                >
                  ${BOLD_COLORMAPS.map(
                    (c) =>
                      html`<option value=${c.value} ?selected=${c.value === this.colormap}>${c.label}</option>`
                  )}
                </select>
              </label>
            `
          : null}
        <wa-checkbox
          size="small"
          ?checked=${this.orientationTextVisible}
          @change=${(e: Event) =>
            this.setOrientationTextVisible((e.target as unknown as { checked: boolean }).checked)}
          title="Show L/R, A/P orientation labels on slices"
        >
          Orientation labels
        </wa-checkbox>
        <wa-checkbox
          size="small"
          ?checked=${this.cornerOrientationText}
          @change=${(e: Event) =>
            this.setCornerOrientationText((e.target as unknown as { checked: boolean }).checked)}
          title="Place labels in corner instead of along axes"
        >
          Corner labels
        </wa-checkbox>
      </div>
    `;
  }

  protected async doInitUI() {
    const prefs = await this.loadPreferences();
    this.orientationTextVisible = prefs.orientationTextVisible;
    this.cornerOrientationText = prefs.cornerOrientationText;
    this.colormap =
      BOLD_COLORMAPS.some((c) => c.value === prefs.boldColormap) ? prefs.boldColormap : 'hot';
    await this.loadVolume();
  }

  private async loadVolume() {
    if (!this.input?.data || !(this.input.data instanceof File)) {
      this.error = 'No file to display';
      this.loading = false;
      return;
    }

    const file = this.input.data;
    await this.updateComplete;
    const canvas = this.renderRoot?.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      this.error = 'Canvas not ready';
      this.loading = false;
      return;
    }

    try {
      this.nv = new Niivue();
      await this.nv.attachToCanvas(canvas);

      const browserFile = (await file.getContents({ blob: true })) as globalThis.File;
      await this.nv.loadFromFile(browserFile);

      this.nv.setIsOrientationTextVisible(this.orientationTextVisible);
      this.nv.setCornerOrientationText(this.cornerOrientationText);

      const vol = this.nv.volumes?.[0];
      const nF = vol?.nFrame4D ?? 0;
      this.nFrames = nF > 1 ? nF : 0;
      this.frameIndex = 0;

      if (this.nFrames > 1 && vol) {
        this.nv.setColormap(vol.id, this.colormap);
        this.nv.opts.isColorbar = true;
        vol.colorbarVisible = true;
        this.nv.drawScene();
      }

      this.updateToolbar();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load volume';
    } finally {
      this.loading = false;
    }
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

    return html`
      <div class="viewer-container">
        ${this.loading
          ? html`
              <div class="loading-state">
                <wa-spinner></wa-spinner>
                <span>Loading volume...</span>
              </div>
            `
          : null}
        <canvas></canvas>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      position: relative;
      width: 100%;
      height: 100%;
      background: var(--wa-color-surface-default, #1a1a1a);
    }

    .viewer-container {
      flex: 1;
      width: 100%;
      height: 100%;
      position: relative;
    }

    .viewer-container canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    .error-state,
    .loading-state {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--wa-space-s);
      color: var(--wa-color-neutral-text-subtle);
    }

    .loading-state {
      background: var(--wa-color-surface-default, #1a1a1a);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'k-neuro-viewer': KNeuroViewer;
  }
}
