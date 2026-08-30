import { registerCatalog } from '@eclipse-docks/extension-catalog/api';

const ACTR7_TUTORIAL_ZIP_URL = 'https://act-r.psy.cmu.edu/actr7.x/units.zip';
const ACTR7_TUTORIAL_ZIP_FILENAME = 'units.zip';

registerCatalog({
  label: 'ACT-R',
  icon: 'brain',
  contributionId: 'actr.tutorial',
  items: [
    {
      label: 'Tutorial archive',
      icon: 'file-zipper',
      contributionId: 'actr.tutorial.archive',
      items: [
        {
          label: 'ACT-R 7 tutorial (zip)',
          icon: 'file-arrow-down',
          state: {
            url: ACTR7_TUTORIAL_ZIP_URL,
            filename: ACTR7_TUTORIAL_ZIP_FILENAME,
            openInNewTab: true,
          },
        },
      ],
    },
  ],
});
