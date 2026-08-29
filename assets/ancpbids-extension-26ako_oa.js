import{d as e,n as t,t as n}from"./fs-access-Cjcg0_Me-BYL2BwWI.js";import{E as r,H as i,V as a,z as o}from"./dist-CE3uCmPT.js";import"./src-DA-mR6aT.js";import{t as s}from"./contributions-3pl8RjZl.js";import{n as c}from"./api-BHnM_fFQ.js";import{t as l}from"./pyservice-0zxWD96J-D5v219rV.js";import"./api-Cj-TK2S-.js";var u=`import os

os.environ['OMP_NUM_THREADS'] = '1'
os.environ['OPENBLAS_NUM_THREADS'] = '1'
os.environ['MKL_NUM_THREADS'] = '1'
`,d=`import sys
import types

try:
    import fcntl
except ImportError:
    fcntl = types.ModuleType('fcntl')
    fcntl.LOCK_EX = 0x1
    fcntl.LOCK_SH = 0x2
    fcntl.LOCK_NB = 0x4
    fcntl.LOCK_UN = 0x8
    fcntl.flock = lambda fd, flags: None
    sys.modules['fcntl'] = fcntl
`,f=`"""Workspace VFS bridge for ancpBIDS in Pyodide (uses Eclipse Docks \`\`docks\`\` module)."""
import posixpath

import docks
from pyodide.ffi import run_sync


class DocksVfs:
    """Workspace VFS: paths are \`\`base_dir/relative/segments\`\` (no \`\`os.path.abspath\`\`)."""

    def __init__(self, base_dir: str = ""):
        base = (base_dir or "").replace("\\\\", "/").strip("/")
        self._base = "" if base in ("", ".") else base

    def _normalize(self, path: str) -> str:
        normalized = path.replace("\\\\", "/").strip()
        while normalized.startswith("/"):
            normalized = normalized[1:]
        return posixpath.normpath(normalized) if normalized else normalized

    def _workspace_path(self, path: str) -> str:
        normalized = self._normalize(path)
        if not self._base:
            return normalized
        if normalized == self._base or normalized.startswith(self._base + "/"):
            return normalized
        return posixpath.normpath(posixpath.join(self._base, normalized))

    def _to_bool(self, payload) -> bool:
        value = self._coerce_python(payload)
        return bool(value)

    def is_dir(self, path: str) -> bool:
        return self._to_bool(run_sync(docks.is_dir(self._workspace_path(path))))

    def is_file(self, path: str) -> bool:
        return self._to_bool(run_sync(docks.is_file(self._workspace_path(path))))

    def exists(self, path: str) -> bool:
        return self._to_bool(run_sync(docks.exists(self._workspace_path(path))))

    def listdir(self, path: str) -> list[str]:
        entries = self._coerce_python(run_sync(docks.list_dir(self._workspace_path(path))))
        if entries is None:
            return []
        return [str(entry) for entry in entries]

    def _coerce_python(self, payload):
        if payload is None:
            return None
        if hasattr(payload, "to_py"):
            return payload.to_py()
        return payload

    def _coerce_bytes(self, payload) -> bytes:
        value = self._coerce_python(payload)
        if value is None:
            return b""
        if isinstance(value, (bytes, bytearray)):
            return bytes(value)
        if isinstance(value, str):
            return value.encode("utf-8")
        if isinstance(value, memoryview):
            return value.tobytes()
        try:
            return bytes(value)
        except TypeError:
            return str(value).encode("utf-8")

    def read_text(self, path: str, encoding: str = "utf-8") -> str:
        # Read as binary: the JS bridge may return ArrayBuffer for file contents and
        # String(arrayBuffer) is not valid UTF-8 text.
        return self.read_bytes(path).decode(encoding)

    def read_bytes(self, path: str) -> bytes:
        return self._coerce_bytes(
            run_sync(docks.read_file(self._workspace_path(path), binary=True))
        )

    def read_bytes_range(self, path: str, offset: int, length: int) -> bytes:
        if length <= 0:
            return b""
        read_range = getattr(docks, 'read_file_range', None)
        if callable(read_range):
            return self._coerce_bytes(
                run_sync(read_range(self._workspace_path(path), offset, length, True))
            )
        return self.read_bytes(path)[offset:offset + length]

    def write_text(self, path: str, content: str, encoding: str = "utf-8") -> None:
        run_sync(docks.write_file(self._workspace_path(path), content))

    def write_bytes(self, path: str, content: bytes) -> None:
        run_sync(docks.write_file(self._workspace_path(path), content))

    def getsize(self, path: str) -> int:
        return len(self.read_bytes(path))

    def makedirs(self, path: str) -> None:
        workspace_path = self._workspace_path(path)
        if self.exists(workspace_path):
            return
        parent = posixpath.dirname(workspace_path)
        if parent and parent not in ("", ".", "/") and not self.exists(parent):
            self.makedirs(parent)
        run_sync(docks.write_file(posixpath.join(workspace_path, ".keep"), ""))
`,p=`import micropip

await micropip.install("ancpbids>=0.4.10")

import ancpbids  # noqa: F401 — triggers load_plugins_from_entrypoints()
from ancpbids.plugin import DatasetPlugin, FileHandlerPlugin, ValidationPlugin, get_plugins

if not get_plugins(DatasetPlugin):
    raise RuntimeError("ancpBIDS dataset plugins failed to register")

if not get_plugins(ValidationPlugin):
    raise RuntimeError("ancpBIDS validation plugins failed to register")

if not get_plugins(FileHandlerPlugin):
    raise RuntimeError("ancpBIDS file handler plugins failed to register")
`,m=`def _normalize_options(options):
    if not options:
        return {}
    if hasattr(options, "to_py"):
        return dict(options.to_py())
    return dict(options)


def _serialize_message(message):
    from ancpbids.schema.values import relpath

    offender = message.get("offender")
    location = ""
    if offender is not None:
        try:
            location = relpath(offender)
        except Exception:
            location = str(offender)
    payload = {
        "severity": message.get("severity") or "warn",
        "code": message.get("code") or "",
        "sub_code": message.get("sub_code") or "",
        "location": location.replace("\\\\", "/"),
        "message": message.get("message") or "",
    }
    return payload


def _normalize_base_dir(base_dir):
    import posixpath

    return posixpath.normpath(str(base_dir or "").replace("\\\\", "/")).strip("/")


def _log_timing(phase, started, **details):
    import time

    elapsed_ms = round((time.perf_counter() - started) * 1000)
    suffix = ""
    if details:
        suffix = " (" + ", ".join(f"{key}={value}" for key, value in details.items()) + ")"
    print(f"[ancpBIDS] {phase}: {elapsed_ms}ms{suffix}", flush=True)


async def __ancpbids_validate_dataset(base_dir, paths, options=None):
    import time

    from ancpbids import DatasetOptions, load_dataset, validate_dataset

    total_started = time.perf_counter()
    opts = DatasetOptions(**_normalize_options(options))
    manifest = list(paths) if paths is not None else None
    base_dir = _normalize_base_dir(base_dir)

    print(
        f"[ancpBIDS] validate start base_dir={base_dir!r} manifest_paths={len(manifest or [])}",
        flush=True,
    )

    vfs_started = time.perf_counter()
    vfs = DocksVfs(base_dir)
    _log_timing("python create DocksVfs", vfs_started)

    load_started = time.perf_counter()
    dataset = load_dataset(
        base_dir,
        opts,
        vfs=vfs,
        paths=manifest,
    )
    _log_timing(
        "python load_dataset",
        load_started,
        subjects=len(getattr(dataset, "subjects", []) or []),
    )

    validate_started = time.perf_counter()
    report = validate_dataset(dataset)
    _log_timing(
        "python validate_dataset",
        validate_started,
        messages=len(getattr(report, "messages", []) or []),
    )

    serialize_started = time.perf_counter()
    messages = [_serialize_message(message) for message in report.messages]
    errors = sum(1 for message in messages if message["severity"] == "error")
    warnings = sum(1 for message in messages if message["severity"] in ("warn", "warning"))
    _log_timing("python serialize messages", serialize_started, messages=len(messages))

    _log_timing(
        "python validate total",
        total_started,
        errors=errors,
        warnings=warnings,
    )
    return {
        "summary": {
            "total": len(messages),
            "errors": errors,
            "warnings": warnings,
        },
        "messages": messages,
    }
`,h=`def _normalize_options(options):
    if not options:
        return {}
    if hasattr(options, "to_py"):
        return dict(options.to_py())
    return dict(options)


def _normalize_base_dir(base_dir):
    import posixpath

    return posixpath.normpath(str(base_dir or "").replace("\\\\", "/")).strip("/")


def _log_timing(phase, started, **details):
    import time

    elapsed_ms = round((time.perf_counter() - started) * 1000)
    suffix = ""
    if details:
        suffix = " (" + ", ".join(f"{key}={value}" for key, value in details.items()) + ")"
    print(f"[ancpBIDS] {phase}: {elapsed_ms}ms{suffix}", flush=True)


async def __ancpbids_load_dataset(base_dir, paths, options=None):
    import time

    from ancpbids import DatasetOptions, load_dataset

    total_started = time.perf_counter()
    opts = DatasetOptions(**_normalize_options(options))
    manifest = list(paths) if paths is not None else None
    base_dir = _normalize_base_dir(base_dir)

    print(
        f"[ancpBIDS] load start base_dir={base_dir!r} manifest_paths={len(manifest or [])}",
        flush=True,
    )

    vfs_started = time.perf_counter()
    vfs = DocksVfs(base_dir)
    _log_timing("python create DocksVfs", vfs_started)

    load_started = time.perf_counter()
    dataset = load_dataset(
        base_dir,
        opts,
        vfs=vfs,
        paths=manifest,
    )
    schema = dataset.get_schema()
    file_count = len(dataset.select(schema.File).objects())
    artifact_count = len(dataset.select(schema.Artifact).objects())
    entities = dataset.query_entities()
    _log_timing(
        "python load_dataset",
        load_started,
        subjects=len(dataset.subjects),
        files=file_count,
        artifacts=artifact_count,
    )

    _log_timing("python load total", total_started)
    return {
        "name": dataset.name,
        "schema_version": schema.VERSION,
        "subjects": len(dataset.subjects),
        "files": file_count,
        "artifacts": artifact_count,
        "entities": {
            key: sorted(values) if isinstance(values, (list, set, tuple)) else values
            for key, values in entities.items()
        },
    }
`,g=u,_=d,v=f,y=p,b=m,x=h,S=`[ancpBIDS]`;function C(e,t,n){let r=n?` (${n})`:``;console.log(`${S} ${e}: ${t}ms${r}`)}async function w(e,t,n){let r=performance.now(),i=await t();return C(e,Math.round(performance.now()-r),n?.(i)),i}async function T(e){let r=performance.now(),i=[],a=0,o=0,s=0,c=async(e,r)=>{s+=1;let l=performance.now(),u=await e.listChildren(!1),d=Math.round(performance.now()-l);if(d>=250){let t=r||e.getName()||`/`;console.log(`[ancpBIDS] slow listChildren: ${d}ms at ${t} (${u.length} entries)`)}for(let e of u){if(e instanceof n){a+=1;let t=r?`${r}/${e.getName()}`:e.getName();await c(e,t);continue}if(e instanceof t){o+=1;let t=r?`${r}/${e.getName()}`:e.getName();i.push(t)}}};return await c(e,``),C(`collectDatasetPaths`,Math.round(performance.now()-r),`${i.length} paths, ${a} dirs, ${o} files, ${s} listChildren calls`),i}function E(e){let t=[`severity`,`code`,`sub_code`,`location`,`message`],n={error:0,warn:1,warning:1,info:2};return{columns:t,rows:[...e].sort((e,t)=>{let r=(e.severity??`warn`).toLowerCase(),i=(t.severity??`warn`).toLowerCase(),a=n[r]??99,o=n[i]??99;if(a!==o)return a-o;let s=(e.code??``).localeCompare(t.code??``);return s===0?(e.location??``).localeCompare(t.location??``):s}).map(e=>[e.severity??`warn`,e.code??``,e.sub_code??``,e.location??``,e.message??``])}}async function D(e,t,n,r){return w(`python ${n}`,async()=>(await e.setGlobal(t,r),(await e.execCode(`
__args = ${t}.to_py()
await ${n}(__args['base_dir'], __args['paths'], __args.get('options'))
`)).result))}var O=new class{constructor(){this.pyEnvOperation=Promise.resolve()}resetPyEnv(){this.pyEnv?.close(),this.pyEnv=void 0,this.pyEnvReady=void 0}ensurePyEnvLogging(e){e.setStdoutCallback(e=>{let t=e.split(/\r?\n/).filter(e=>e.length>0);for(let e of t)console.log(e)}),e.setStderrCallback(e=>{let t=e.split(/\r?\n/).filter(e=>e.length>0);for(let e of t)console.error(e)})}async bootstrapPyEnv(e){let t=performance.now();console.log(`[ancpBIDS] bootstrapping PyEnv...`);let n=new l;return this.ensurePyEnvLogging(n),e?.({message:`Starting Python runtime...`}),await w(`pyenv.init`,()=>n.init()),await w(`pyenv ENV_NO_THREADS`,()=>n.execCode(g)),await w(`pyenv loadPackages(micropip)`,()=>n.loadPackages([`micropip`])),await w(`pyenv FCNTL_STUB`,()=>n.execCode(_)),e?.({message:`Installing ancpBIDS...`}),await w(`pyenv DOCKS_VFS`,()=>n.execCode(v)),await w(`pyenv INSTALL_ANCPBIDS`,()=>n.execCode(y)),await w(`pyenv VALIDATE_DATASET script`,()=>n.execCode(b)),await w(`pyenv LOAD_DATASET script`,()=>n.execCode(x)),C(`bootstrapPyEnv total`,Math.round(performance.now()-t)),n}getPyEnv(e){return this.pyEnv?(console.log(`[ancpBIDS] reusing warm PyEnv`),e?.({message:`Using Python runtime...`}),Promise.resolve(this.pyEnv)):(this.pyEnvReady||=this.bootstrapPyEnv(e).then(e=>(this.pyEnv=e,e)).catch(e=>{throw this.pyEnvReady=void 0,e}),this.pyEnvReady)}runWithPyEnv(e,t){let n=async()=>{let n=performance.now(),r=await w(`getPyEnv`,()=>this.getPyEnv(e));try{let e=await t(r);return C(`runWithPyEnv total`,Math.round(performance.now()-n)),e}catch(e){throw console.error(`[ancpBIDS] run failed, resetting PyEnv`),this.resetPyEnv(),e}},r=this.pyEnvOperation.then(n,n);return this.pyEnvOperation=r.then(()=>void 0,()=>void 0),r}async validateDataset(e,t,n){return this.runWithPyEnv(n,async r=>{console.log(`[ancpBIDS] validateDataset start root=${e.getName()}`),n?.({message:`Collecting dataset paths...`});let i=await T(e),a=e.getWorkspacePath();return n?.({message:`Loading and validating dataset...`}),D(r,`__ancpbids_validate_args`,`__ancpbids_validate_dataset`,{base_dir:a,paths:i,options:t??{}})})}async loadDatasetSummary(e,t,n){return this.runWithPyEnv(n,async r=>{console.log(`[ancpBIDS] loadDatasetSummary start root=${e.getName()}`),n?.({message:`Collecting dataset paths...`});let i=await T(e),a=e.getWorkspacePath();return n?.({message:`Loading dataset...`}),D(r,`__ancpbids_load_args`,`__ancpbids_load_dataset`,{base_dir:a,paths:i,options:t??{}})})}async runValidation(t,n){return await r.runAsync(`Validate BIDS dataset (ancpBIDS)`,async r=>{let i=await this.validateDataset(t,void 0,e=>{e.message!==void 0&&(r.message=e.message)}),a=t.getName()||`dataset`,{summary:o}=i,s=` (total ${o.total} · errors ${o.errors} · warnings ${o.warnings})`,l={title:n?.title??`${a}${s}`,source:n?.source??`ancpBIDS`,data:E(i.messages)};return e(c,l),i})}},k=e=>e.getName()===`dataset_description.json`;function A(e){let n=e?.input?.data;return!(n instanceof t)||!k(n)?null:n.getParent()}a({command:{id:`ancpbids.validate`,name:`Validate BIDS dataset (ancpBIDS)`,description:`Loads and validates a BIDS dataset with ancpBIDS via Pyodide.`},handler:{canExecute:e=>!!A(e.activeEditor),execute:async e=>{let t=A(e.activeEditor);if(t)try{await O.runValidation(t)}catch(e){let t=e instanceof Error?e.message:String(e);i(`ancpBIDS validation failed: ${t}`)}}}}),o.registerContribution(s,{label:`ancpBIDS`,icon:`clipboard-list`,command:`ancpbids.validate`,ranking:10});