/**
 * Pyodide compatibility patches and nengo setup.
 * Must run before any nengo import.
 */

import envNoThreads from './py-scripts/env-no-threads.py?raw';
import fcntlStub from './py-scripts/fcntl-stub.py?raw';
import installNengo from './py-scripts/install-nengo.py?raw';

export const ENV_NO_THREADS = envNoThreads;
export const FCNTL_STUB = fcntlStub;
export const INSTALL_NENGO = installNengo;
