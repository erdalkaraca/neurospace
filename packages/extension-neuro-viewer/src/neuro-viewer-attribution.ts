import { registerLicenseAttribution } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';

registerLicenseAttribution({
  name: 'attribution.niivue',
  label: 'NiiVue',
  component: () => html`
    <p>
      Neuroimaging visualization uses
      <a href="https://github.com/niivue/niivue" target="_blank" rel="noopener noreferrer">NiiVue</a>
      for rendering NIfTI, DICOM, NRRD, MGH/MGZ, and related formats.
    </p>
  `,
});
