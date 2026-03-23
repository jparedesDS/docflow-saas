"""Service for synchronizing network folder contents with DocFlow."""

import os
from datetime import datetime, timezone

import structlog

from utils.json_store import read_json, write_json
from utils.config import PEDIDOS_BASE_PATH

logger = structlog.get_logger("docflow.folder_sync")

SYNC_STATE_FILE = os.path.join(os.path.dirname(__file__), "..", "folder_sync_state.json")

RELEVANT_EXTENSIONS = {
    ".pdf", ".dwg", ".dxf",
    ".doc", ".docx",
    ".xls", ".xlsx",
    ".ppt", ".pptx",
}

MAX_DEPTH = 3


class FolderSyncService:
    """Scans PEDIDOS_BASE_PATH for new/modified files and tracks sync state."""

    def scan_folder(self) -> dict:
        """
        Scan PEDIDOS_BASE_PATH, detect new/modified files.
        Compares against last scan state (JSON with paths + mtime).
        Returns: {new_files: [...], modified_files: [...], total_scanned: int, scan_time: str}
        """
        scan_time = datetime.now(timezone.utc).isoformat()

        if not os.path.isdir(PEDIDOS_BASE_PATH):
            logger.warning("folder_not_accessible", path=PEDIDOS_BASE_PATH)
            result = {
                "new_files": [],
                "modified_files": [],
                "total_scanned": 0,
                "scan_time": scan_time,
                "error": f"Carpeta no accesible: {PEDIDOS_BASE_PATH}",
            }
            self._append_history(result)
            return result

        # Load previous state
        state = read_json(SYNC_STATE_FILE, default={"files": {}, "history": []})
        previous_files = state.get("files", {})

        # Scan current files
        current_files = {}
        new_files = []
        modified_files = []
        total_scanned = 0

        try:
            for file_info in self._walk_folder(PEDIDOS_BASE_PATH, max_depth=MAX_DEPTH):
                total_scanned += 1
                file_path = file_info["path"]
                current_files[file_path] = {
                    "name": file_info["name"],
                    "size": file_info["size"],
                    "mtime": file_info["mtime"],
                    "extension": file_info["extension"],
                }

                prev = previous_files.get(file_path)
                if prev is None:
                    new_files.append(file_info)
                elif prev.get("mtime") != file_info["mtime"]:
                    modified_files.append(file_info)

        except PermissionError as exc:
            logger.warning("folder_permission_error", path=PEDIDOS_BASE_PATH, error=str(exc))
        except OSError as exc:
            logger.warning("folder_os_error", path=PEDIDOS_BASE_PATH, error=str(exc))

        # Save new state
        state["files"] = current_files
        state["last_scan"] = scan_time
        state["last_new_count"] = len(new_files)
        state["last_modified_count"] = len(modified_files)
        state["last_total"] = total_scanned

        result = {
            "new_files": new_files[:100],  # Limit response size
            "modified_files": modified_files[:100],
            "total_scanned": total_scanned,
            "scan_time": scan_time,
        }

        self._append_history(result, state)
        write_json(SYNC_STATE_FILE, state)

        logger.info(
            "folder_scan_complete",
            total_scanned=total_scanned,
            new_files=len(new_files),
            modified_files=len(modified_files),
        )

        return result

    def get_status(self) -> dict:
        """Current sync status: last scan, files detected, errors."""
        state = read_json(SYNC_STATE_FILE, default={})
        return {
            "last_scan": state.get("last_scan"),
            "total_files": state.get("last_total", 0),
            "last_new_count": state.get("last_new_count", 0),
            "last_modified_count": state.get("last_modified_count", 0),
            "base_path": PEDIDOS_BASE_PATH,
            "path_accessible": os.path.isdir(PEDIDOS_BASE_PATH),
            "linked_files": len(state.get("linked", {})),
        }

    def get_scan_history(self, limit: int = 10) -> list:
        """History of recent scans."""
        state = read_json(SYNC_STATE_FILE, default={"history": []})
        history = state.get("history", [])
        return history[-limit:][::-1]  # Most recent first

    def link_file_to_order(self, file_path: str, order_number: str) -> bool:
        """Link a detected file with an order number."""
        state = read_json(SYNC_STATE_FILE, default={"files": {}, "linked": {}})

        if file_path not in state.get("files", {}):
            logger.warning("link_file_not_found", file_path=file_path)
            return False

        linked = state.get("linked", {})
        linked[file_path] = {
            "order_number": order_number,
            "linked_at": datetime.now(timezone.utc).isoformat(),
        }
        state["linked"] = linked
        write_json(SYNC_STATE_FILE, state)

        logger.info("file_linked", file_path=file_path, order_number=order_number)
        return True

    def _walk_folder(self, base_path: str, max_depth: int = 3):
        """Recursively walk folder up to max_depth, yielding file info dicts."""
        base_depth = base_path.rstrip(os.sep).count(os.sep)

        for dirpath, dirnames, filenames in os.walk(base_path):
            current_depth = dirpath.rstrip(os.sep).count(os.sep) - base_depth
            if current_depth >= max_depth:
                dirnames.clear()  # Don't recurse deeper
                continue

            for filename in filenames:
                ext = os.path.splitext(filename)[1].lower()
                if ext not in RELEVANT_EXTENSIONS:
                    continue

                filepath = os.path.join(dirpath, filename)
                try:
                    stat = os.stat(filepath)
                    yield {
                        "path": filepath,
                        "name": filename,
                        "size": stat.st_size,
                        "mtime": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                        "extension": ext,
                        "relative_path": os.path.relpath(filepath, base_path),
                    }
                except (OSError, PermissionError):
                    continue

    def _append_history(self, result: dict, state: dict = None):
        """Append a scan result summary to history."""
        if state is None:
            state = read_json(SYNC_STATE_FILE, default={"history": []})

        history = state.get("history", [])
        history.append({
            "scan_time": result.get("scan_time"),
            "total_scanned": result.get("total_scanned", 0),
            "new_files": len(result.get("new_files", [])),
            "modified_files": len(result.get("modified_files", [])),
            "error": result.get("error"),
        })

        # Keep last 50 entries
        if len(history) > 50:
            history = history[-50:]

        state["history"] = history
