export const ACTR_CHEERPX_IMAGE_DIR = 'actr-cheerpx';
export const ACTR_CHEERPX_IMAGE_BASENAME = 'actr-cheerpx.ext2';

/** Strip trailing slash; root base `/` becomes ``. */
export function normalizeViteBase(base: string): string {
  if (!base || base === '/') return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

/** URL prefix for chunk requests, e.g. `/neurospace/actr-cheerpx/`. */
export function actrCheerpXUrlPrefix(viteBase = '/'): string {
  const root = normalizeViteBase(viteBase);
  return `${root}/${ACTR_CHEERPX_IMAGE_DIR}/`;
}

/** Base URL passed to CheerpX GitHubDevice.create (no `.meta` suffix). */
export function actrCheerpXImageBase(viteBase = '/'): string {
  const root = normalizeViteBase(viteBase);
  return `${root}/${ACTR_CHEERPX_IMAGE_DIR}/${ACTR_CHEERPX_IMAGE_BASENAME}`;
}
