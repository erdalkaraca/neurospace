import type { TabularData } from '@eclipse-docks/extension-dataviewer/api';

export interface AncpbidsValidationMessage {
  severity: string;
  code: string;
  sub_code: string;
  location: string;
  message: string;
}

export interface AncpbidsValidationSummary {
  total: number;
  errors: number;
  warnings: number;
}

export interface AncpbidsValidationOutput {
  summary: AncpbidsValidationSummary;
  messages: AncpbidsValidationMessage[];
}

export function ancpbidsMessagesToTabularData(messages: AncpbidsValidationMessage[]): TabularData {
  const columns = ['severity', 'code', 'sub_code', 'location', 'message'];
  const severityRank: Record<string, number> = { error: 0, warn: 1, warning: 1, info: 2 };
  const sorted = [...messages].sort((a, b) => {
    const sa = (a.severity ?? 'warn').toLowerCase();
    const sb = (b.severity ?? 'warn').toLowerCase();
    const ra = severityRank[sa] ?? 99;
    const rb = severityRank[sb] ?? 99;
    if (ra !== rb) return ra - rb;
    const codeCompare = (a.code ?? '').localeCompare(b.code ?? '');
    if (codeCompare !== 0) return codeCompare;
    return (a.location ?? '').localeCompare(b.location ?? '');
  });
  const rows = sorted.map((message) => [
    message.severity ?? 'warn',
    message.code ?? '',
    message.sub_code ?? '',
    message.location ?? '',
    message.message ?? '',
  ]);
  return { columns, rows };
}
