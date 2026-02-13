# Neurospace

> **Vision**: Neurospace is evolving toward an application focused on **neuromorphic cognitive modeling**—a unified platform for building, visualizing, and analyzing brain-inspired computational models.

Built on the [Appspace](https://github.com/kispace-io/core) framework, Neurospace currently provides an interactive neuroimaging viewer as its foundation. Over time, it will expand into tools for spiking neural networks, cognitive architectures, and simulation workflows that bridge neuroscience and AI.

## Current Capabilities

- **Neuroimaging viewer**: Displays NIfTI, DICOM, NRRD, and related formats via an editor integrated with the workspace file browser
- **Formats**: Volumes (NIfTI .nii/.nii.gz, DICOM .dcm, NRRD, MGH/MGZ, MRtrix MIF), powered by [NiiVue](https://github.com/niivue/niivue) (WebGL2, TypeScript)

## Roadmap

- Neuroimaging visualization (current)
- Neuromorphic model design and simulation
- Cognitive architecture integration
- Data-driven and theory-driven modeling workflows

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173, connect a workspace (folder with neuroimaging files), and open a `.nii.gz` or `.dcm` file from the file browser.

## Project Structure

- `packages/neurospace-app` – App entrypoint and shell
- `packages/extension-neuro-viewer` – Neuroimaging editor extension

## Dependencies

Uses [Appspace](https://github.com/kispace-io/core) packages from the npm registry (`@kispace-io/core`, `@kispace-io/extension-utils`, etc.).

## License

MIT. See [LICENSE](LICENSE) for details.
