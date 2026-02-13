import type { SnirfDataBlock, SnirfProbe } from './types.js';

export function resolveToken(token: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  return v || fallback;
}

export function valueToColor(
  v: number,
  vMin: number,
  vMax: number,
  resolve: (token: string, fallback: string) => string
): string {
  const mid = (vMin + vMax) / 2;
  const span = Math.max(vMax - vMin, 1e-10);
  const t = (v - mid) / span;
  if (t <= -0.8) return resolve('--wa-color-blue-50', 'rgb(59,130,246)');
  if (t >= 0.8) return resolve('--wa-color-red-50', 'rgb(239,68,68)');
  const r = t <= 0 ? 0 : t >= 1 ? 255 : Math.round(255 * t);
  const b = t >= 0 ? 0 : t <= -1 ? 255 : Math.round(255 * -t);
  const g = t >= 0 ? Math.round(255 * (1 - t)) : Math.round(255 * (1 + t));
  return `rgb(${r},${g},${b})`;
}

export function getTimeTickStep(span: number): number {
  return span > 100 ? 50 : span > 20 ? 20 : span > 5 ? 5 : 1;
}

export function getRowValueRange(row: number[]): { vMin: number; vMax: number } {
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const v of row) {
    if (typeof v === 'number' && isFinite(v)) {
      vMin = Math.min(vMin, v);
      vMax = Math.max(vMax, v);
    }
  }
  return { vMin, vMax };
}

export function getGlobalValueRange(block: { dataTimeSeries: number[][] } | null): {
  vMin: number;
  vMax: number;
} {
  if (!block?.dataTimeSeries?.length) return { vMin: 0, vMax: 1 };
  let vMin = Infinity;
  let vMax = -Infinity;
  for (const row of block.dataTimeSeries) {
    for (const v of row) {
      if (typeof v === 'number' && isFinite(v)) {
        vMin = Math.min(vMin, v);
        vMax = Math.max(vMax, v);
      }
    }
  }
  if (vMin === Infinity) return { vMin: 0, vMax: 1 };
  return { vMin, vMax };
}

export function getChannelLabel(
  chIdx: number,
  block: SnirfDataBlock | null,
  probe: SnirfProbe | undefined
): string {
  const prefix = String(chIdx).padStart(3, '0');
  const m = block?.measurementList?.[chIdx];
  if (!m) return `${prefix}: ${chIdx}`;
  const srcRaw = probe?.sourceLabels?.[m.sourceIndex - 1];
  const detRaw = probe?.detectorLabels?.[m.detectorIndex - 1];
  const srcLabel = Array.isArray(srcRaw) ? srcRaw[0] : srcRaw;
  const detLabel = Array.isArray(detRaw) ? detRaw[0] : detRaw;
  const sdPart =
    typeof srcLabel === 'string' && typeof detLabel === 'string'
      ? `${srcLabel}_${detLabel}`
      : `S${m.sourceIndex}_D${m.detectorIndex}`;
  const wl = probe?.wavelengths?.[m.wavelengthIndex - 1];
  const label = typeof wl === 'number' ? `${sdPart} ${Math.round(wl)}` : sdPart;
  return `${prefix}: ${label}`;
}
