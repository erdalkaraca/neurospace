import micropip

await micropip.install("ancpbids>=0.4.10")

import ancpbids  # noqa: F401 — triggers load_plugins_from_entrypoints()
from ancpbids.plugin import DatasetPlugin, FileHandlerPlugin, ValidationPlugin, get_plugins

if not get_plugins(DatasetPlugin):
    raise RuntimeError("ancpBIDS dataset plugins failed to register")

if not get_plugins(ValidationPlugin):
    raise RuntimeError("ancpBIDS validation plugins failed to register")

if not get_plugins(FileHandlerPlugin):
    raise RuntimeError("ancpBIDS file handler plugins failed to register")
