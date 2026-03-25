import {
  LyraPart,
  activeEditorSignal,
  contributionRegistry,
  SIDEBAR_AUXILIARY,
  icon,
} from '@eclipse-lyra/core';
import { customElement, state, html, css, nothing } from '@eclipse-lyra/core/externals/lit';
import {
  nengoModelSummarySignal,
  nengoModelLoadingSignal,
  nengoAddedVisualizationsSignal,
  nengoModelSyncRequestSignal,
} from './nengo-model-signal';
import {
  NENGO_VIZ_SLOT,
  type NengoVisualizationContribution,
} from './nengo-viz-api';
import './viz/nengo-netgraph';

const NENGO_EDITOR_TAG = 'k-nengo-editor';

interface ContextMenuNode {
  nodeId: string;
  label: string;
  isEnsemble: boolean;
  x: number;
  y: number;
}

@customElement('nengo-model-graph-panel')
export class NengoModelGraphPanel extends LyraPart {
  @state() private contextMenuNode?: ContextMenuNode;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
    .panel-content {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
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
    this.requestSyncIfNengoActive();
  }

  private handleActiveEditorChange(): void {
    const active = activeEditorSignal.get();
    const isNengo = active?.tagName?.toLowerCase() === NENGO_EDITOR_TAG;
    if (isNengo) {
      this.requestSyncIfNengoActive();
      return;
    }
    if (active != null) {
      nengoModelSummarySignal.set(undefined);
      nengoModelLoadingSignal.set(false);
      nengoAddedVisualizationsSignal.set([]);
    }
  }

  private requestSyncIfNengoActive(): void {
    const active = activeEditorSignal.get();
    if (active?.tagName?.toLowerCase() === NENGO_EDITOR_TAG) {
      nengoModelSyncRequestSignal.set(nengoModelSyncRequestSignal.get() + 1);
    }
  }

  private handleNodeContextMenu(evt: { nodeId: string; label: string; isEnsemble: boolean; x: number; y: number }): void {
    this.contextMenuNode = evt;
    this.requestUpdate();
    queueMicrotask(() => {
      const menu = this.renderRoot.querySelector('lyra-contextmenu') as { show: (pos: { x: number; y: number }) => void } | null;
      menu?.show({ x: evt.x, y: evt.y });
    });
  }

  private addVisualization(vizType: string): void {
    const node = this.contextMenuNode;
    if (!node) return;
    const objectType = node.isEnsemble ? 'ensemble' : 'node';
    const current = nengoAddedVisualizationsSignal.get();
    if (current.some((a) => a.objectId === node.nodeId && a.vizType === vizType)) return;
    nengoAddedVisualizationsSignal.set([...current, { objectId: node.nodeId, objectType, vizType }]);
    this.contextMenuNode = undefined;
  }

  protected override renderContextMenu(): unknown {
    const node = this.contextMenuNode;
    if (!node) return nothing;
    const contributions = contributionRegistry.getContributions<NengoVisualizationContribution>(NENGO_VIZ_SLOT);
    const items: { name: string; label: string; icon?: string; types: string[] }[] = [
      { name: 'value', label: 'Value plot', icon: 'chart-line', types: ['ensemble', 'node'] },
      { name: 'raster', label: 'Raster plot', icon: 'braille', types: ['ensemble'] },
    ];
    const objectType = node.isEnsemble ? 'ensemble' : 'node';
    const applicable = items.filter((i) => i.types.includes(objectType));
    return html`
      <div style="padding: var(--wa-space-2xs); font-size: 0.75rem; color: var(--wa-color-text-quiet);">
        Add visualization on ${node.label}
      </div>
      <wa-divider></wa-divider>
      ${applicable.map(
        (item) => html`
          <wa-dropdown-item @click=${() => this.addVisualization(item.name)}>
            ${item.icon ? icon(item.icon, { slot: 'start' }) : ''}
            ${item.label}
          </wa-dropdown-item>
        `
      )}
    `;
  }

  protected override renderContent(): unknown {
    const summary = nengoModelSummarySignal.get();
    const loading = nengoModelLoadingSignal.get();
    const isNengo = activeEditorSignal.get()?.tagName?.toLowerCase() === NENGO_EDITOR_TAG;

    if (summary) {
      return html`
        <div class="panel-content">
          <nengo-netgraph
            .modelSummary=${summary}
            .onNodeContextMenu=${(e: ContextMenuNode) => this.handleNodeContextMenu(e)}
          ></nengo-netgraph>
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
