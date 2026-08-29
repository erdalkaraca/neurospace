"""Workspace VFS bridge for ancpBIDS in Pyodide (uses Eclipse Docks ``docks`` module)."""
import posixpath

import docks
from pyodide.ffi import run_sync


class DocksVfs:
    """Workspace VFS: paths are ``base_dir/relative/segments`` (no ``os.path.abspath``)."""

    def __init__(self, base_dir: str = ""):
        base = (base_dir or "").replace("\\", "/").strip("/")
        self._base = "" if base in ("", ".") else base

    def _normalize(self, path: str) -> str:
        normalized = path.replace("\\", "/").strip()
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
