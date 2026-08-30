import { registerLicenseAttribution } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';

registerLicenseAttribution({
  name: 'attribution.nengo',
  label: 'Nengo',
  component: () => html`
    <p>
      This extension uses
      <a href="https://www.nengo.ai/" target="_blank" rel="noopener noreferrer">Nengo</a>,
      a neural simulation toolkit from Applied Brain Research and the Nengo community (MIT License).
      Model templates are adapted from the Nengo examples documentation.
    </p>
  `,
});
