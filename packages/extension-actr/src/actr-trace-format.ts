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
