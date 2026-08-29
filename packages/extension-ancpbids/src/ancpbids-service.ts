import { Directory, publish, taskService } from '@eclipse-docks/core';
import { PyEnv } from '@eclipse-docks/extension-python-runtime/api';
import type { DataView } from '@eclipse-docks/extension-dataviewer/api';
import { TOPIC_DATAVIEW_PUBLISH } from '@eclipse-docks/extension-dataviewer/api';

import {
  DOCKS_VFS,
  ENV_NO_THREADS,
  FCNTL_STUB,
  INSTALL_ANCPBIDS,
  LOAD_DATASET,
  VALIDATE_DATASET,
} from './ancpbids-python-init';
import { logTiming, timed } from './ancpbids-timing';
import { collectDatasetPaths } from './workspace-path-collector';
import {
  ancpbidsMessagesToTabularData,
  type AncpbidsValidationOutput,
} from './validation-results';

export interface AncpbidsDatasetOptions {
  infer_artifact_datatype?: boolean;
  ignore?: boolean | string[];
  lazy_loading?: boolean;
  ignore_pickle_file?: boolean;
}

export interface AncpbidsLoadSummary {
  name: string;
  schema_version: string;
  subjects: number;
  files: number;
  artifacts: number;
  entities: Record<string, unknown>;
}

export interface AncpbidsProgress {
  message?: string;
}

export type AncpbidsProgressReporter = (update: AncpbidsProgress) => void;

interface PyExecResult<T = unknown> {
  result: T;
  console?: string[];
}

async function runAncpbidsAsync<T>(
  pyenv: PyEnv,
  globalKey: string,
  functionName: string,
  args: { base_dir: string; paths: string[]; options: AncpbidsDatasetOptions },
): Promise<T> {
  return timed(`python ${functionName}`, async () => {
    await pyenv.setGlobal(globalKey, args);
    const response = (await pyenv.execCode(`
__args = ${globalKey}.to_py()
await ${functionName}(__args['base_dir'], __args['paths'], __args.get('options'))
`)) as PyExecResult<T>;
    return response.result;
  });
}

export class AncpbidsService {
  private pyEnv?: PyEnv;
  private pyEnvReady?: Promise<PyEnv>;
  private pyEnvOperation: Promise<unknown> = Promise.resolve();

  /** Drop cached runtime (e.g. after a failed run or for tests). */
  public resetPyEnv(): void {
    this.pyEnv?.close();
    this.pyEnv = undefined;
    this.pyEnvReady = undefined;
  }

  private ensurePyEnvLogging(pyenv: PyEnv): void {
    pyenv.setStdoutCallback((text) => {
      const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
      for (const line of lines) console.log(line);
    });
    pyenv.setStderrCallback((text) => {
      const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
      for (const line of lines) console.error(line);
    });
  }

  private async bootstrapPyEnv(reportProgress?: AncpbidsProgressReporter): Promise<PyEnv> {
    const bootstrapStarted = performance.now();
    console.log('[ancpBIDS] bootstrapping PyEnv...');

    const pyenv = new PyEnv();
    this.ensurePyEnvLogging(pyenv);

    reportProgress?.({ message: 'Starting Python runtime...' });
    await timed('pyenv.init', () => pyenv.init());
    await timed('pyenv ENV_NO_THREADS', () => pyenv.execCode(ENV_NO_THREADS));
    await timed('pyenv loadPackages(micropip)', () => pyenv.loadPackages(['micropip']));
    await timed('pyenv FCNTL_STUB', () => pyenv.execCode(FCNTL_STUB));

    reportProgress?.({ message: 'Installing ancpBIDS...' });
    await timed('pyenv DOCKS_VFS', () => pyenv.execCode(DOCKS_VFS));
    await timed('pyenv INSTALL_ANCPBIDS', () => pyenv.execCode(INSTALL_ANCPBIDS));
    await timed('pyenv VALIDATE_DATASET script', () => pyenv.execCode(VALIDATE_DATASET));
    await timed('pyenv LOAD_DATASET script', () => pyenv.execCode(LOAD_DATASET));

    logTiming('bootstrapPyEnv total', Math.round(performance.now() - bootstrapStarted));
    return pyenv;
  }

  private getPyEnv(reportProgress?: AncpbidsProgressReporter): Promise<PyEnv> {
    if (this.pyEnv) {
      console.log('[ancpBIDS] reusing warm PyEnv');
      reportProgress?.({ message: 'Using Python runtime...' });
      return Promise.resolve(this.pyEnv);
    }
    if (!this.pyEnvReady) {
      this.pyEnvReady = this.bootstrapPyEnv(reportProgress)
        .then((env) => {
          this.pyEnv = env;
          return env;
        })
        .catch((err) => {
          this.pyEnvReady = undefined;
          throw err;
        });
    }
    return this.pyEnvReady;
  }

  private runWithPyEnv<T>(
    reportProgress: AncpbidsProgressReporter | undefined,
    fn: (pyenv: PyEnv) => Promise<T>,
  ): Promise<T> {
    const run = async () => {
      const runStarted = performance.now();
      const pyenv = await timed('getPyEnv', () => this.getPyEnv(reportProgress));
      try {
        const result = await fn(pyenv);
        logTiming('runWithPyEnv total', Math.round(performance.now() - runStarted));
        return result;
      } catch (err) {
        console.error('[ancpBIDS] run failed, resetting PyEnv');
        this.resetPyEnv();
        throw err;
      }
    };
    const op = this.pyEnvOperation.then(run, run);
    this.pyEnvOperation = op.then(
      () => undefined,
      () => undefined,
    );
    return op;
  }

  public async validateDataset(
    datasetRoot: Directory,
    options?: AncpbidsDatasetOptions,
    reportProgress?: AncpbidsProgressReporter,
  ): Promise<AncpbidsValidationOutput> {
    return this.runWithPyEnv(reportProgress, async (pyenv) => {
      console.log(`[ancpBIDS] validateDataset start root=${datasetRoot.getName()}`);
      reportProgress?.({ message: 'Collecting dataset paths...' });
      const paths = await collectDatasetPaths(datasetRoot);
      const baseDir = datasetRoot.getWorkspacePath();

      reportProgress?.({ message: 'Loading and validating dataset...' });
      return runAncpbidsAsync<AncpbidsValidationOutput>(
        pyenv,
        '__ancpbids_validate_args',
        '__ancpbids_validate_dataset',
        { base_dir: baseDir, paths, options: options ?? {} },
      );
    });
  }

  public async loadDatasetSummary(
    datasetRoot: Directory,
    options?: AncpbidsDatasetOptions,
    reportProgress?: AncpbidsProgressReporter,
  ): Promise<AncpbidsLoadSummary> {
    return this.runWithPyEnv(reportProgress, async (pyenv) => {
      console.log(`[ancpBIDS] loadDatasetSummary start root=${datasetRoot.getName()}`);
      reportProgress?.({ message: 'Collecting dataset paths...' });
      const paths = await collectDatasetPaths(datasetRoot);
      const baseDir = datasetRoot.getWorkspacePath();

      reportProgress?.({ message: 'Loading dataset...' });
      return runAncpbidsAsync<AncpbidsLoadSummary>(
        pyenv,
        '__ancpbids_load_args',
        '__ancpbids_load_dataset',
        { base_dir: baseDir, paths, options: options ?? {} },
      );
    });
  }

  public async runValidation(datasetRoot: Directory, opts?: { source?: string; title?: string }) {
    return await taskService.runAsync('Validate BIDS dataset (ancpBIDS)', async (pm) => {
      const result = await this.validateDataset(datasetRoot, undefined, (update) => {
        if (update.message !== undefined) pm.message = update.message;
      });

      const datasetName = datasetRoot.getName() || 'dataset';
      const { summary } = result;
      const statsSuffix = ` (total ${summary.total} · errors ${summary.errors} · warnings ${summary.warnings})`;
      const view: DataView = {
        title: opts?.title ?? `${datasetName}${statsSuffix}`,
        source: opts?.source ?? 'ancpBIDS',
        data: ancpbidsMessagesToTabularData(result.messages),
      };
      publish(TOPIC_DATAVIEW_PUBLISH, view);
      return result;
    });
  }
}

export const ancpbidsService = new AncpbidsService();
