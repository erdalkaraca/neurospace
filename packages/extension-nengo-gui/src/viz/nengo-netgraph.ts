import {
  customElement,
  property,
  LitElement,
  css,
  html,
} from '@eclipse-lyra/core/externals/lit';
import type { NengoVizContext } from '../nengo-viz-api';
import cytoscape from 'cytoscape';

@customElement('nengo-netgraph')
export class NengoNetGraph extends LitElement {
  @property({ attribute: false })
  context?: NengoVizContext;

  @property({ attribute: false })
  modelSummary?: {
    ensembles: string[];
    nodes: string[];
    probes: string[];
    connections: { pre: string; post: string; kind: string }[];
  };

  @property({ attribute: false })
  onNodeContextMenu?: (evt: { nodeId: string; label: string; isEnsemble: boolean; x: number; y: number }) => void;

  private cy: cytoscape.Core | null = null;
  private resizeObserver?: ResizeObserver;
  private lastStructureKey = '';

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    this.cy?.destroy();
    this.cy = null;
  }

  private resolveVar(varExpr: string, fallback: string): string {
    const match = varExpr.match(/var\((--[\w-]+)\)/);
    const prop = match?.[1];
    if (!prop) return fallback;
    const val = getComputedStyle(this).getPropertyValue(prop).trim();
    return val || fallback;
  }

  private getCytoscapeStyle(): cytoscape.StylesheetJson {
    const surface = this.resolveVar('var(--wa-color-surface-raised)', '#e8e8e8');
    const border = this.resolveVar('var(--wa-color-surface-border)', '#cccccc');
    const text = this.resolveVar('var(--wa-color-text-normal)', '#333333');
    const line = this.resolveVar('var(--wa-color-text-quiet)', '#888888');
    return [
      {
        selector: 'node',
        style: {
          label: 'data(label)',
          color: text,
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '10px',
          'background-color': surface,
          'border-width': 1,
          'border-color': border,
          width: 60,
          height: 28,
        },
      },
      {
        selector: '.input-node',
        style: { shape: 'round-rectangle' as cytoscape.Css.NodeShape },
      },
      {
        selector: '.ensemble',
        style: { shape: 'ellipse' as cytoscape.Css.NodeShape, width: 50 },
      },
      {
        selector: 'edge',
        style: {
          'curve-style': 'bezier',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.6,
          width: 1.5,
          'line-color': line,
        },
      },
      {
        selector: 'edge.modulatory',
        style: { 'line-style': 'dashed', opacity: 0.8 },
      },
    ];
  }

  private ensureCy(): void {
    if (this.cy) return;
    const container = this.renderRoot.querySelector<HTMLElement>('.cy-container');
    if (!container) return;

    this.cy = cytoscape({
      container,
      style: this.getCytoscapeStyle(),
      elements: [],
      layout: { name: 'preset' },
      minZoom: 0.2,
      maxZoom: 3,
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.cy?.resize();
      this.cy?.fit(undefined, 20);
    });
    this.resizeObserver.observe(container);
  }

  override updated(changed: Map<string, unknown>): void {
    if (!changed.has('modelSummary')) return;
    this.ensureCy();
    this.syncGraph();
  }

  private syncGraph(): void {
    const summary = this.modelSummary;
    if (!summary || !this.cy) return;

    const nodes = Array.isArray(summary.nodes) ? summary.nodes : [];
    const ensembles = Array.isArray(summary.ensembles) ? summary.ensembles : [];
    const connections = Array.isArray(summary.connections) ? summary.connections : [];
    const structureKey = JSON.stringify({ nodes, ensembles, connections });
    if (structureKey === this.lastStructureKey) return;
    this.lastStructureKey = structureKey;

    const nodeIds = [...nodes, ...ensembles];
    const elements: cytoscape.ElementDefinition[] = nodeIds.map((id, i) => ({
      data: { id, label: id },
      classes: i < nodes.length ? 'input-node' : 'ensemble',
    }));

    const validConnections = connections.filter(
      (c) =>
        typeof c?.pre === 'string' &&
        typeof c?.post === 'string' &&
        nodeIds.includes(c.pre) &&
        nodeIds.includes(c.post)
    );

    validConnections.forEach((c, i) => {
      elements.push({
        data: {
          id: `e${i}`,
          source: c.pre,
          target: c.post,
          classes: c.kind === 'modulatory' ? 'modulatory' : '',
        },
      });
    });

    this.cy.elements().remove();
    this.cy.add(elements);
    this.cy.off('cxttap');
    this.cy.on('cxttap', 'node', (evt: cytoscape.EventObject) => {
      const node = evt.target;
      const id = node.data('id') as string;
      const label = (node.data('label') as string) ?? id;
      const isEnsemble = node.hasClass('ensemble');
      const pos = evt.originalEvent as MouseEvent;
      this.onNodeContextMenu?.({ nodeId: id, label, isEnsemble, x: pos.clientX, y: pos.clientY });
    });
    const padding = 20;
    const layoutOpts: cytoscape.LayoutOptions =
      nodeIds.length <= 1
        ? { name: 'preset', fit: true, padding }
        : {
            name: 'breadthfirst',
            directed: true,
            direction: 'downward',
            fit: true,
            padding,
            spacingFactor: 1.2,
          };
    this.cy.layout(layoutOpts).run();
    queueMicrotask(() => this.cy?.fit(undefined, padding));
  }

  render() {
    const summary = this.modelSummary;
    if (!summary) {
      return html`<span class="placeholder">Open a .nengo.py file to see the model graph</span>`;
    }

    const nodes = Array.isArray(summary.nodes) ? summary.nodes : [];
    const ensembles = Array.isArray(summary.ensembles) ? summary.ensembles : [];
    const nodeIds = [...nodes, ...ensembles];
    const hasGraphContent = nodeIds.length > 0;

    if (!hasGraphContent) {
      return html`<span class="placeholder">No ensembles or nodes in model</span>`;
    }

    return html`
      <div class="netgraph-container" @contextmenu=${(e: Event) => { e.preventDefault(); e.stopPropagation(); }}>
        <div class="cy-container"></div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 80px;
      overflow: hidden;
    }
    .netgraph-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .cy-container {
      position: relative;
      flex: 1;
      min-height: 200px;
      width: 100%;
    }
    .placeholder {
      font-style: italic;
      color: var(--wa-color-text-quiet);
      padding: var(--wa-space-m);
    }
  `;
}
