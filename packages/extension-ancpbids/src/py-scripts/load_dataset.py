def _normalize_options(options):
    if not options:
        return {}
    if hasattr(options, "to_py"):
        return dict(options.to_py())
    return dict(options)


def _normalize_base_dir(base_dir):
    import posixpath

    return posixpath.normpath(str(base_dir or "").replace("\\", "/")).strip("/")


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
