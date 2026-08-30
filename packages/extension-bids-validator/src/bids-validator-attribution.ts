import { registerLicenseAttribution } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';

registerLicenseAttribution({
  name: 'attribution.bids-validator',
  label: 'BIDS Validator',
  component: () => html`
    <p>
      BIDS validation uses the
      <a href="https://github.com/bids-standard/bids-validator" target="_blank" rel="noopener noreferrer"
        >BIDS Validator</a
      >
      from the BIDS community (MIT License), published as
      <a href="https://jsr.io/@bids/validator" target="_blank" rel="noopener noreferrer">@bids/validator</a>
      on JSR. It checks compliance with the
      <a href="https://bids.neuroimaging.io/" target="_blank" rel="noopener noreferrer"
        >Brain Imaging Data Structure</a
      >
      standard.
    </p>
  `,
});
