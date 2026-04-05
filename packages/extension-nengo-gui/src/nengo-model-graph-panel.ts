import {
  LyraPart,
  activeEditorSignal,
  contributionRegistry,
  SIDEBAR_AUXILIARY,
  icon,
} from '@eclipse-lyra/core';
import {
  customElement,
  state,
  html,
  css,
  nothing,
  type TemplateResult,
} from '@eclipse-lyra/core/externals/lit';
import {
  KNengoEditor,
  NENGO_COMPANION_UPDATE,
  NENGO_EDITOR_ID,
  getActiveNengoEditor,
} from './k-nengo-editor';
import './viz/nengo-netgraph';

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

  private _companionEditor: KNengoEditor | null = null;
  private readonly _onCompanionUpdate = () => this.requestUpdate();

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
    const ed = getActiveNengoEditor();
    if (ed === this._companionEditor) return;
    this.detachCompanionListener();
    this._companionEditor = ed;
    ed?.addEventListener(NENGO_COMPANION_UPDATE, this._onCompanionUpdate);
  }

  private detachCompanionListener(): void {
    this._companionEditor?.removeEventListener(NENGO_COMPANION_UPDATE, this._onCompanionUpdate);
    this._companionEditor = null;
  }

  private handleNodeContextMenu(evt: {
    nodeId: string;
    label: string;
    isEnsemble: boolean;
    x: number;
    y: number;
  }): void {
    this.contextMenuNode = evt;
    this.requestUpdate();
    queueMicrotask(() => {
      const menu = this.renderRoot.querySelector('lyra-contextmenu') as {
        show: (pos: { x: number; y: number }) => void;
      } | null;
      menu?.show({ x: evt.x, y: evt.y });
    });
  }

  private addVisualization(vizType: string): void {
    const node = this.contextMenuNode;
    if (!node) return;
    const editor = getActiveNengoEditor();
    if (!editor) return;
    const objectType = node.isEnsemble ? 'ensemble' : 'node';
    editor.addCompanionVisualization({ objectId: node.nodeId, objectType, vizType });
    this.contextMenuNode = undefined;
  }

  protected override renderContextMenu(): TemplateResult | typeof nothing {
    const node = this.contextMenuNode;
    if (!node) return nothing;
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

  protected override renderContent(): TemplateResult {
    const editor = getActiveNengoEditor();
    const summary = editor?.getModelSummary();
    const loading = editor?.isModelExtractLoading ?? false;

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
    if (editor && loading) {
      return html`
        <div class="panel-content">
          <div class="placeholder placeholder-loading">
            <wa-spinner></wa-spinner>
            <span>Determining model structure…</span>
          </div>
        </div>
      `;
    }
    if (editor && !summary) {
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
  coupledEditors: [NENGO_EDITOR_ID],
  component: (id: string) =>
    html`<nengo-model-graph-panel id="${id}"></nengo-model-graph-panel>`,
});
