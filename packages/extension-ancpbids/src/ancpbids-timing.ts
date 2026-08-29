const LOG_PREFIX = '[ancpBIDS]';

export function logTiming(phase: string, ms: number, detail?: string): void {
  const suffix = detail ? ` (${detail})` : '';
  console.log(`${LOG_PREFIX} ${phase}: ${ms}ms${suffix}`);
}

export async function timed<T>(
  phase: string,
  fn: () => Promise<T>,
  detail?: (result: T) => string,
): Promise<T> {
  const started = performance.now();
  const result = await fn();
  logTiming(phase, Math.round(performance.now() - started), detail?.(result));
  return result;
}

export function timedSync<T>(
  phase: string,
  fn: () => T,
  detail?: (result: T) => string,
): T {
  const started = performance.now();
  const result = fn();
  logTiming(phase, Math.round(performance.now() - started), detail?.(result));
  return result;
}
