import { registerLicenseAttribution } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';

registerLicenseAttribution({
  name: 'attribution.jsfive',
  label: 'jsfive',
  component: () => html`
    <p>
      SNIRF and HDF5 reading uses
      <a href="https://github.com/usnistgov/jsfive" target="_blank" rel="noopener noreferrer">jsfive</a>
      from the U.S. National Institute of Standards and Technology.
    </p>
  `,
});
