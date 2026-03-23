import {
  LyraPart,
  activeEditorSignal,
  contributionRegistry,
  SIDEBAR_AUXILIARY,
} from '@eclipse-lyra/core';
import { customElement, html, css } from '@eclipse-lyra/core/externals/lit';
import { nengoModelSummarySignal, nengoModelLoadingSignal } from './nengo-model-signal';
import './viz/nengo-netgraph';

const NENGO_EDITOR_TAG = 'k-nengo-editor';

@customElement('nengo-model-graph-panel')
export class NengoModelGraphPanel extends LyraPart {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
    .panel-content {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
    .placeholder {
      padding: var(--wa-space-m);
      color: var(--wa-color-text-quiet);
      font-style: italic;
      font-size: 0.875rem;
    }
    .placeholder-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--wa-space-s);
    }
    .placeholder-loading wa-spinner {
      font-size: 1.5rem;
    }
  `;

  protected override doBeforeUI(): void {
    this.watch(activeEditorSignal, () => this.handleActiveEditorChange());
    this.watch(nengoModelSummarySignal, () => this.requestUpdate());
    this.watch(nengoModelLoadingSignal, () => this.requestUpdate());
  }

  private handleActiveEditorChange(): void {
    const active = activeEditorSignal.get();
    const isNengo = active?.tagName?.toLowerCase() === NENGO_EDITOR_TAG;
    if (!isNengo) {
      nengoModelSummarySignal.set(undefined);
      nengoModelLoadingSignal.set(false);
    }
  }

  protected override render(): unknown {
    const summary = nengoModelSummarySignal.get();
    const loading = nengoModelLoadingSignal.get();
    const isNengo = activeEditorSignal.get()?.tagName?.toLowerCase() === NENGO_EDITOR_TAG;

    if (summary) {
      return html`
        <div class="panel-content">
          <nengo-netgraph .modelSummary=${summary}></nengo-netgraph>
        </div>
      `;
    }
    if (isNengo && loading) {
      return html`
        <div class="panel-content">
          <div class="placeholder placeholder-loading">
            <wa-spinner></wa-spinner>
            <span>Determining model structure…</span>
          </div>
        </div>
      `;
    }
    if (isNengo && !summary) {
      return html`
        <div class="panel-content">
          <div class="placeholder">No ensembles or nodes in model</div>
        </div>
      `;
    }
    return html`
      <div class="panel-content">
        <div class="placeholder">Open a .nengo.py file to see the model graph</div>
      </div>
    `;
  }
}

contributionRegistry.registerContribution(SIDEBAR_AUXILIARY, {
  name: 'nengo-model-graph',
  label: 'Model Graph',
  icon: 'diagram-project',
  component: (id: string) =>
    html`<nengo-model-graph-panel id="${id}"></nengo-model-graph-panel>`,
});
