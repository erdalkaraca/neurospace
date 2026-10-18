/** ACT-R text trace events start with simulation time, e.g. `0.250   PROCEDURAL`. */
const TRACE_EVENT_START = /(?<![\n\r])(?=\d+\.\d{3}\s)/g;

/**
 * Normalize CheerpX console capture into ACT-R Text Trace lines (one event per row,
 * each starting with the simulation timestamp).
 */
export function formatActrTextTrace(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(TRACE_EVENT_START, '\n')
    .replace(/^\n+/, '')
    .trimEnd();
}

/**
 * PRODUCTION-SELECTED / BUFFER-READ-ACTION only appear at :trace-detail high.
 * Append or rewrite an sgp form so step sessions always get those events in the
 * text trace (mailbox JSON evaluate cannot pass Lisp keywords reliably).
 */
export function withDebugTraceDetail(source: string): string {
  const trimmed = source.trimEnd();
  if (/\(\s*sgp\b[^)]*:trace-detail\s+high\b/i.test(trimmed)) return `${trimmed}\n`;
  if (/\(\s*sgp\b[^)]*:trace-detail\b/i.test(trimmed)) {
    return `${trimmed.replace(
      /(\(\s*sgp\b[^)]*:trace-detail\s+)([^\s)]+)/i,
      '$1high',
    )}\n`;
  }
  return `${trimmed}\n\n(sgp :trace-detail high)\n`;
}
