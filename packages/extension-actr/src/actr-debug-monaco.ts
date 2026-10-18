import type { editor as MonacoEditor } from 'monaco-editor';

import {
  findProductionHighlightRange,
  highlightSideForView,
  hoverText,
  type DebugView,
} from './actr-debug-model';

type CodeEditor = MonacoEditor.IStandaloneCodeEditor;

const HIGHLIGHT_CLASS = 'actr-debug-production';
const TOOLTIP_CLASS = 'actr-debug-tooltip';

const HIGHLIGHT_CSS = `
  .${HIGHLIGHT_CLASS} {
    background-color: rgba(201, 162, 39, 0.28);
    border-radius: 2px;
  }
`;

const TOOLTIP_CSS = `
  .${TOOLTIP_CLASS} {
    position: fixed;
    inset: auto;
    margin: 0;
    width: max-content;
    max-width: 24rem;
    padding: 4px 8px;
    background: #252526;
    color: #f3f3f3;
    border: 1px solid #454545;
    border-radius: 4px;
    font: 12px/1.45 ui-monospace, monospace;
    white-space: pre-wrap;
    pointer-events: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  }
`;

const sessions = new Map<string, DebugView>();
const decorations = new WeakMap<CodeEditor, MonacoEditor.IEditorDecorationsCollection>();
const tooltips = new WeakMap<CodeEditor, HTMLDivElement>();

export function setActrDebugSession(uri: string, view: DebugView): void {
  sessions.set(uri, view);
}

export function clearActrDebugSession(uri: string): void {
  sessions.delete(uri);
}

export function applyProductionHighlight(editor: CodeEditor, view: DebugView | null): void {
  const editorRoot = editor.getDomNode()?.getRootNode();
  ensureStyle(editorRoot instanceof ShadowRoot ? editorRoot : document.head, HIGHLIGHT_CLASS, HIGHLIGHT_CSS);
  ensureHover(editor);
  hideTooltip(tooltips.get(editor));

  const collection = decorationsFor(editor);
  const model = editor.getModel();
  const production = view?.production ?? null;
  const side = view ? highlightSideForView(view) : null;
  const found =
    model && production && side
      ? findProductionHighlightRange(model.getValue(), production, side)
      : null;
  if (!model || !found) {
    collection.set([]);
    return;
  }
  const start = model.getPositionAt(found.start);
  const end = model.getPositionAt(found.end);
  const range = {
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column,
  };
  collection.set([
    {
      range,
      options: {
        inlineClassName: HIGHLIGHT_CLASS,
        overviewRuler: { color: '#c9a227', position: 2 },
      },
    },
  ]);
  editor.revealRangeInCenterIfOutsideViewport(range);
}

export function clearProductionHighlight(editor: CodeEditor): void {
  decorations.get(editor)?.set([]);
  decorations.delete(editor);
  hideTooltip(tooltips.get(editor));
}

function decorationsFor(editor: CodeEditor): MonacoEditor.IEditorDecorationsCollection {
  const existing = decorations.get(editor);
  if (existing) return existing;
  const collection = editor.createDecorationsCollection();
  decorations.set(editor, collection);
  return collection;
}

function ensureHover(editor: CodeEditor): void {
  if (tooltips.has(editor)) return;
  ensureStyle(document.head, TOOLTIP_CLASS, TOOLTIP_CSS);
  const tooltip = document.createElement('div');
  tooltip.className = TOOLTIP_CLASS;
  tooltip.popover = 'manual';
  document.body.appendChild(tooltip);
  tooltips.set(editor, tooltip);

  // Monaco's onMouseLeave fires on every move when the editor lives in a shadow root.
  const hide = () => hideTooltip(tooltip);
  const node = editor.getDomNode();
  node?.addEventListener('mouseleave', hide);
  editor.onMouseMove((event) => showHover(editor, tooltip, event));
  editor.onDidDispose(() => {
    node?.removeEventListener('mouseleave', hide);
    tooltip.remove();
    tooltips.delete(editor);
  });
}

function showHover(editor: CodeEditor, tooltip: HTMLDivElement, event: MonacoEditor.IEditorMouseEvent): void {
  const model = editor.getModel();
  const position = event.target.position;
  const view = model ? sessions.get(model.uri.toString()) : undefined;
  const text = model && position && view ? hoverText(model.getValue(), model.getOffsetAt(position), view) : null;
  if (!text) {
    hideTooltip(tooltip);
    return;
  }
  const { clientX, clientY } = event.event.browserEvent;
  placeTooltip(tooltip, text, clientX, clientY);
}

function placeTooltip(tooltip: HTMLDivElement, text: string, x: number, y: number): void {
  tooltip.textContent = text;
  if (!tooltip.matches(':popover-open')) tooltip.showPopover();
  const { offsetWidth: width, offsetHeight: height } = tooltip;
  const above = y - height - 8;
  const top = above < 8 ? y + 18 : above;
  const left = x + 12 + width > window.innerWidth - 8 ? Math.max(8, x - width - 12) : x + 12;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function hideTooltip(tooltip: HTMLDivElement | undefined): void {
  if (!tooltip?.matches(':popover-open')) return;
  tooltip.hidePopover();
}

function ensureStyle(parent: ParentNode, id: string, css: string): void {
  if (parent.querySelector(`#${id}`)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  parent.appendChild(style);
}
