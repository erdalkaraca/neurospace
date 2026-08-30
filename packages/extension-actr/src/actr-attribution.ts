import { registerLicenseAttribution } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';

registerLicenseAttribution({
  name: 'attribution.act-r',
  label: 'ACT-R',
  component: () => html`
    <p>
      Tutorial content and models are from the
      <a href="https://act-r.psy.cmu.edu/software/" target="_blank" rel="noopener noreferrer"
        >ACT-R 7 software</a
      >
      distributed by the ACT-R Research Group, Carnegie Mellon University.
    </p>
  `,
});
