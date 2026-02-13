import { customElement, property, state } from 'lit/decorators.js';
import { KPart } from '@kispace-io/core';
import { css, html, nothing } from 'lit';
import { EditorInput, editorRegistry, File } from '@kispace-io/core';
import { Niivue } from '@niivue/niivue';

interface NeuroViewerPreferences {
  orientationTextVisible: boolean;
  cornerOrientationText: boolean;
}

const DEFAULT_PREFERENCES: NeuroViewerPreferences = {
  orientationTextVisible: true,
  cornerOrientationText: false,
};

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

  private nv?: Niivue;

  public isEditor = true;

  protected doClose() {
    if (this.nv) {
      this.nv.cleanup();
      this.nv = undefined;
    }
    this.input = undefined;
    this.error = undefined;
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

  protected renderToolbar() {
    if (!this.nv || this.loading || this.error) return nothing;
    return html`
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
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
