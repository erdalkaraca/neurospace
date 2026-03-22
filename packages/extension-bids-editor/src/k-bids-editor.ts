import { LyraPart, EditorInput, File as LyraFile } from '@eclipse-lyra/core';
import { customElement, property, state, html, css, createRef, ref } from '@eclipse-lyra/core/externals/lit';

@customElement('k-bids-editor')
export class KBidsEditor extends LyraPart {
  @property({ attribute: false })
  public input?: EditorInput;

  @state()
  private loading = false;

  @state()
  private error?: string;

  @state()
  private initialContent?: string;

  @state()
  private uri?: string;

  private widgetRef = createRef<any>();

  public isEditor = true;

  protected async doInitUI() {
    this.loading = true;
    this.error = undefined;
    this.initialContent = undefined;
    this.uri = undefined;

    try {
      const data = this.input?.data;
      if (!(data instanceof LyraFile)) throw new Error('No file input available');
      const raw = await data.getContents();
      const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as ArrayBuffer);
      this.initialContent = text;
      this.uri = data.getWorkspacePath();
    } catch (err) {
      this.error = err instanceof Error ? err.message : String(err);
    } finally {
      this.loading = false;
    }
  }

  private onContentChange = () => {
    this.markDirty(true);
  };

  public override save() {
    const data = this.input?.data;
    if (!(data instanceof LyraFile)) return;
    const value = this.widgetRef.value?.getContent?.() ?? '';
    data.saveContents(value);
    this.markDirty(false);
  }

  protected override doClose(): void {
    this.widgetRef.value?.dispose?.();
  }

  protected renderContent() {
    if (this.error) {
      return html`<div class="state state-error">${this.error}</div>`;
    }
    if (this.loading) {
      return html`<div class="state state-loading"><wa-spinner></wa-spinner></div>`;
    }
    if (this.initialContent === undefined) {
      return html`<div class="monaco-editor-placeholder"></div>`;
    }
    return html`
      <lyra-monaco-widget
        .value=${this.initialContent}
        .uri=${this.uri}
        language="json"
        @content-change=${this.onContentChange}
        ${ref(this.widgetRef)}
      ></lyra-monaco-widget>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      position: relative;
      width: 100%;
      height: 100%;
    }
    .monaco-editor-placeholder {
      flex: 1;
      min-height: 0;
    }
    .state {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--wa-space-m, 1rem);
      box-sizing: border-box;
    }
    .state-error {
      color: var(--wa-color-danger-70, #b42318);
    }
  `;
}

