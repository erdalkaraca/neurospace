import { registerLicenseAttribution } from '@eclipse-docks/core';
import { html } from '@eclipse-docks/core/externals/lit';

registerLicenseAttribution({
  name: 'attribution.ancpbids',
  label: 'ancpBIDS',
  component: () => html`
    <p>
      BIDS validation and querying uses
      <a href="https://github.com/ANCPLabOldenburg/ancp-bids" target="_blank" rel="noopener noreferrer"
        >ancpBIDS</a
      >
      from the Applied Neurocognitive Psychology Lab, University of Oldenburg (MIT License). See the
      <a href="https://ancpbids.readthedocs.io/" target="_blank" rel="noopener noreferrer"
        >ancpBIDS documentation</a
      >
      for details.
    </p>
  `,
});
