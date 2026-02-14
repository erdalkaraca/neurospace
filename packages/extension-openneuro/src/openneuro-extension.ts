import {
  registerAll,
  contributionRegistry,
  workspaceService,
  taskService,
  promptDialog,
  toastError,
  toastInfo,
  infoDialog,
  i18n,
  File,
  Directory,
} from '@kispace-io/core';
import {
  collectFilesRecursive,
  fetchLatestSnapshotTag,
  buildS3Url,
  fetchFile,
  listWorkspaceFilesRecursive,
} from './openneuro-api.js';

const t = i18n('extensions');

function normalizeDatasetId(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  const id = raw.trim().toLowerCase();
  return id.length > 0 ? id : null;
}

registerAll({
  command: {
    id: 'openneuro_download',
    name: 'Download from OpenNeuro',
    description: 'Download an OpenNeuro dataset to the workspace',
    parameters: [{ name: 'datasetId', description: 'Dataset ID (e.g. ds000001)', required: false }],
  },
  handler: {
    execute: async (context) => {
      const workspace = await workspaceService.getWorkspace();
      if (!workspace) {
        toastError('No workspace connected');
        return;
      }
      let datasetId = normalizeDatasetId(context.params?.datasetId);
      if (!datasetId) {
        const raw = await promptDialog(t('ENTER_DATASET_ID'), 'ds000001');
        datasetId = normalizeDatasetId(raw);
      }
      if (!datasetId) return;

      await taskService.runAsync(`Download OpenNeuro ${datasetId}`, async (pm) => {
        pm.message = t('FETCHING_FILE_LIST');
        const tag = await fetchLatestSnapshotTag(datasetId!);
        const files = await collectFilesRecursive(datasetId!, tag);
        if (files.length === 0) {
          toastError(`No files found for ${datasetId}`);
          return;
        }
        pm.totalSteps = files.length;
        pm.currentStep = 0;

        for (let i = 0; i < files.length; i++) {
          const { path: relPath } = files[i];
          pm.message = relPath;
          pm.currentStep = i;

          const url = buildS3Url(datasetId!, relPath);
          const targetPath = `${datasetId}/${relPath}`;

          try {
            const res = await fetchFile(url);
            const targetFile = (await workspace.getResource(targetPath, {
              create: true,
            })) as File;
            const body = res.body;
            if (body && typeof (body as any).pipeTo === 'function') {
              await targetFile.saveContents(body);
            } else {
              const blob = await res.blob();
              await targetFile.saveContents(blob);
            }
          } catch (err) {
            toastError(`Download failed: ${relPath} - ${err instanceof Error ? err.message : String(err)}`);
            throw err;
          }
        }

        pm.currentStep = files.length;
        toastInfo(`Downloaded ${files.length} files to ${datasetId}`);
      });
    },
  },
});

contributionRegistry.registerContribution('filebrowser.create', {
  command: 'openneuro_download',
  label: t('CREATE_OPENNEURO_DATASET'),
  icon: 'database',
});

registerAll({
  command: {
    id: 'openneuro_validate',
    name: 'Validate OpenNeuro dataset',
    description: 'Validate workspace files against OpenNeuro (size check)',
    parameters: [
      { name: 'datasetId', description: 'Dataset ID', required: false },
      { name: 'path', description: 'Workspace path to dataset folder', required: false },
    ],
  },
  handler: {
    execute: async (context) => {
      const workspace = await workspaceService.getWorkspace();
      if (!workspace) {
        toastError('No workspace connected');
        return;
      }
      let datasetId = normalizeDatasetId(context.params?.datasetId);
      if (!datasetId) {
        const raw = await promptDialog(t('ENTER_DATASET_ID'), 'ds000001');
        datasetId = normalizeDatasetId(raw);
      }
      if (!datasetId) return;

      const pathParam = context.params?.path as string | undefined;
      const basePath = pathParam?.trim() || datasetId;

      let targetDir: Directory;
      try {
        const resource = await workspace.getResource(basePath);
        if (!resource || !(resource instanceof Directory)) {
          toastError(`Path ${basePath} is not a directory`);
          return;
        }
        targetDir = resource as Directory;
      } catch {
        toastError(`Path ${basePath} not found`);
        return;
      }

      await taskService.runAsync(`Validate OpenNeuro ${datasetId}`, async (pm) => {
        pm.message = t('FETCHING_FILE_LIST');
        const tag = await fetchLatestSnapshotTag(datasetId!);
        const expectedFiles = await collectFilesRecursive(datasetId!, tag);
        const expectedMap = new Map(expectedFiles.map((f) => [f.path, f.size]));

        pm.message = t('VALIDATING');
        const workspaceFiles = await listWorkspaceFilesRecursive(targetDir, '');
        pm.totalSteps = workspaceFiles.length;
        pm.currentStep = 0;

        let ok = 0;
        let mismatch = 0;
        let missing = expectedMap.size;

        for (let i = 0; i < workspaceFiles.length; i++) {
          const { path: relPath, file } = workspaceFiles[i];
          pm.message = relPath;
          pm.currentStep = i;

          const expectedSize = expectedMap.get(relPath);
          if (expectedSize === undefined) continue;
          missing--;

          const actualSize = await file.size();
          if (actualSize === expectedSize) {
            ok++;
          } else {
            mismatch++;
          }
        }

        pm.currentStep = workspaceFiles.length;
        const msg =
          mismatch > 0 || missing > 0
            ? t('VALIDATE_SUMMARY', {
                ok: String(ok),
                mismatch: String(mismatch),
                missing: String(missing),
              })
            : t('VALIDATE_OK', { ok: String(ok) });
        await infoDialog('Validation Complete', msg);
      });
    },
  },
});
