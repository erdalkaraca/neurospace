import envNoThreads from './py-scripts/env-no-threads.py?raw';
import fcntlStub from './py-scripts/fcntl-stub.py?raw';
import docksVfs from './py-scripts/docks_vfs.py?raw';
import installAncpbids from './py-scripts/install-ancpbids.py?raw';
import validateDataset from './py-scripts/validate_dataset.py?raw';
import loadDataset from './py-scripts/load_dataset.py?raw';

export const ENV_NO_THREADS = envNoThreads;
export const FCNTL_STUB = fcntlStub;
export const DOCKS_VFS = docksVfs;
export const INSTALL_ANCPBIDS = installAncpbids;
export const VALIDATE_DATASET = validateDataset;
export const LOAD_DATASET = loadDataset;
