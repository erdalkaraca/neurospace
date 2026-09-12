/** Guest stdout lines produced by the mailbox supervisor (not ACT-R model output). */
const MAILBOX_LOG_LINE =
  /^\s*(?:\[mailbox\b|mailbox\[|mailbox:|mailbox poll error|ACT-R mailbox\[|ACT-R process \w+ ready|console mirror unavailable)/i;

export function shouldShowMailboxLogs(): boolean {
  return import.meta.env.DEV === true;
}

export function isMailboxLogLine(line: string): boolean {
  return MAILBOX_LOG_LINE.test(line);
}

/**
 * Drop internal mailbox/supervisor log lines unless running a Vite dev build.
 * Keeps a carry buffer so split chunks are not misclassified mid-line.
 */
export function createMailboxLogFilter(): (chunk: string) => string {
  let carry = '';
  return (chunk: string) => {
    if (shouldShowMailboxLogs()) return chunk;
    if (!chunk) return '';

    const text = carry + chunk;
    const endsWithNl = /[\r\n]$/.test(text);
    const parts = text.split(/\r?\n/);
    carry = endsWithNl ? '' : (parts.pop() ?? '');

    const kept = parts.filter((line) => !isMailboxLogLine(line));
    if (kept.length === 0) return '';
    return `${kept.join('\n')}\n`;
  };
}
