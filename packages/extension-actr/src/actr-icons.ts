import { registerIconLibrary } from '@eclipse-docks/core/externals/webawesome';

const ICON_LIBRARY = 'actr';

type ActrIconName = 'run' | 'step-over' | 'stop';

const svg = (color: string, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" style="color: ${color}">${body}</svg>`;

const ICONS: Record<ActrIconName, string> = {
  run: svg(
    'var(--wa-color-green-50, #89d185)',
    '<path fill="currentColor" d="M4 2.5v11l9.5-5.5z"/>',
  ),
  'step-over': svg(
    'var(--wa-color-blue-50, #75beff)',
    '<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M2.5 9a5.5 5.5 0 0 1 10.5-2.3M13.5 2.75v4h-4"/>' +
      '<circle fill="currentColor" cx="8" cy="12.5" r="1.75"/>',
  ),
  stop: svg(
    'var(--wa-color-red-50, #f48771)',
    '<rect fill="currentColor" x="3" y="3" width="10" height="10" rx="1"/>',
  ),
};

registerIconLibrary(ICON_LIBRARY, {
  resolver: (name: string) =>
    `data:image/svg+xml,${encodeURIComponent(ICONS[name as ActrIconName] ?? '')}`,
});

export const actrIcon = (name: ActrIconName): string => `${ICON_LIBRARY} ${name}`;
