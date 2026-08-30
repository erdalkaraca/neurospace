import {
  DocksPart,
  activeEditorSignal,
  contributionRegistry,
  SIDEBAR_AUXILIARY,
} from '@eclipse-docks/core';
import {
  customElement,
  html,
  css,
  nothing,
  type TemplateResult,
} from '@eclipse-docks/core/externals/lit';

import {
  ACTR_COMPANION_UPDATE,
  ACTR_EDITOR_ID,
  getActiveActrEditor,
} from './ns-actr-editor';
import { formatActrTextTrace } from './actr-trace-format';

@customElement('actr-text-trace-panel')
export class ActrTextTracePanel extends DocksPart {
  private _companionEditor: ReturnType<typeof getActiveActrEditor> = null;
  private readonly _onCompanionUpdate = () => this.requestUpdate();

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .panel-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .status {
      flex-shrink: 0;
      padding: 0.35rem var(--wa-space-m, 0.75rem);
      font-size: 0.8125rem;
      color: var(--wa-color-text-quiet, #aaa);
      border-bottom: 1px solid var(--wa-color-surface-border, #333);
    }

    .trace {
      flex: 1;
      min-height: 0;
      margin: 0;
      padding: var(--wa-space-m, 0.75rem);
      overflow: auto;
      overflow-x: auto;
      white-space: pre;
      word-break: normal;
      tab-size: 4;
      font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-variant-numeric: tabular-nums;
      color: var(--wa-color-text-normal, #ddd);
    }

    .placeholder {
      padding: var(--wa-space-m, 0.75rem);
      color: var(--wa-color-text-quiet, #aaa);
      font-style: italic;
      font-size: 0.875rem;
    }
  `;

  protected override doBeforeUI(): void {
    this.watch(activeEditorSignal, () => {
      this.syncCompanionListener();
      this.requestUpdate();
    });
    this.syncCompanionListener();
  }

  override disconnectedCallback(): void {
    this.detachCompanionListener();
    super.disconnectedCallback();
  }

  private syncCompanionListener(): void {
    const ed = getActiveActrEditor();
    if (ed === this._companionEditor) return;
    this.detachCompanionListener();
    this._companionEditor = ed;
    ed?.addEventListener(ACTR_COMPANION_UPDATE, this._onCompanionUpdate);
  }

  private detachCompanionListener(): void {
    this._companionEditor?.removeEventListener(ACTR_COMPANION_UPDATE, this._onCompanionUpdate);
    this._companionEditor = null;
  }

  protected override renderToolbar(): TemplateResult | typeof nothing {
    return nothing;
  }

  protected override renderContent(): TemplateResult {
    const editor = getActiveActrEditor();
    if (!editor) {
      return html`
        <div class="panel-content">
          <div class="placeholder">Open an ACT-R model (.lisp) to see the text trace</div>
        </div>
      `;
    }

    const snapshot = editor.getCompanionTraceSnapshot();
    const status = snapshot.status || (snapshot.running ? 'Running…' : 'Ready');
    const trace = formatActrTextTrace(snapshot.textTrace);

    return html`
      <div class="panel-content">
        <div class="status">${status}</div>
        ${trace
          ? html`<pre class="trace">${trace}</pre>`
          : html`<div class="placeholder">
              Click Run in the editor toolbar to load this model into ACT-R. First boot can take several minutes.
            </div>`}
      </div>
    `;
  }
}

contributionRegistry.registerContribution(SIDEBAR_AUXILIARY, {
  name: 'actr-text-trace',
  label: 'Text Trace',
  icon: 'align-left',
  coupledEditors: [ACTR_EDITOR_ID],
  component: (id: string) =>
    html`<actr-text-trace-panel id="${id}"></actr-text-trace-panel>`,
});

declare global {
  interface HTMLElementTagNameMap {
    'actr-text-trace-panel': ActrTextTracePanel;
  }
}
