import { registerCatalog } from '@eclipse-lyra/extension-catalog/api';

import introUrl from '../templates/01-intro.nengo.py?url&no-inline';
import commChannelUrl from '../templates/02-communication-channel.nengo.py?url&no-inline';
import additionUrl from '../templates/03-addition.nengo.py?url&no-inline';
import oscillatorUrl from '../templates/04-oscillator.nengo.py?url&no-inline';

const toAbsoluteUrl = (path: string) =>
  typeof globalThis !== 'undefined' && (globalThis as any).location
    ? new URL(path, (globalThis as any).location.origin).href
    : path;

registerCatalog({
  label: 'Nengo',
  icon: 'brain',
  contributionId: 'nengo.models',
  items: [
    {
      label: 'Basic',
      icon: 'circle-play',
      contributionId: 'nengo.models.basic',
      items: [
        { label: 'Introduction', icon: 'arrow-right', state: { url: toAbsoluteUrl(introUrl) } },
        { label: 'Communication channel', icon: 'right-left', state: { url: toAbsoluteUrl(commChannelUrl) } },
        { label: 'Addition', icon: 'plus', state: { url: toAbsoluteUrl(additionUrl) } },
        { label: 'Oscillator', icon: 'wave-square', state: { url: toAbsoluteUrl(oscillatorUrl) } },
      ],
    },
  ],
});
