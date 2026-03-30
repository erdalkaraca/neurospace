import { registerCatalog } from '@eclipse-lyra/extension-catalog/api';

import introUrl from '../templates/01-intro.nengo.py?url';
import commChannelUrl from '../templates/02-communication-channel.nengo.py?url';
import additionUrl from '../templates/03-addition.nengo.py?url';
import oscillatorUrl from '../templates/04-oscillator.nengo.py?url';

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
        { label: 'Introduction', icon: 'arrow-right', state: { url: introUrl, filename: '01-intro.nengo.py' } },
        {
          label: 'Communication channel',
          icon: 'right-left',
          state: { url: commChannelUrl, filename: '02-communication-channel.nengo.py' },
        },
        { label: 'Addition', icon: 'plus', state: { url: additionUrl, filename: '03-addition.nengo.py' } },
        { label: 'Oscillator', icon: 'wave-square', state: { url: oscillatorUrl, filename: '04-oscillator.nengo.py' } },
      ],
    },
  ],
});
