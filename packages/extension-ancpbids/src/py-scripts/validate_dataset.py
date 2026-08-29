def _normalize_options(options):
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
        "location": location.replace("\\", "/"),
        "message": message.get("message") or "",
    }
    return payload


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
