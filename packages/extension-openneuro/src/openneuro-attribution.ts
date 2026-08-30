import { registerLicenseAttribution } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';

registerLicenseAttribution({
  name: 'attribution.openneuro',
  label: 'OpenNeuro',
  component: () => html`
    <p>
      Dataset browsing and download uses the
      <a href="https://openneuro.org/" target="_blank" rel="noopener noreferrer">OpenNeuro</a>
      platform and its public APIs. OpenNeuro is an open data archive for neuroimaging datasets.
    </p>
  `,
});
