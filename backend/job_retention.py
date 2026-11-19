"""Retention for backend/jobs: bound disk use without deleting live work."""
from __future__ import annotations
from pathlib import Path
import shutil
import time

DEFAULT_MAX_JOBS = 32
DEFAULT_TTL_DAYS = 7.0


def prune_jobs(
    jobs_dir: Path,
    keep: int = DEFAULT_MAX_JOBS,
    max_age_days: float = DEFAULT_TTL_DAYS,
    exclude: set[str] | None = None,
) -> list[str]:
    """Delete old job directories; keep the newest `keep` and anything newer
    than `max_age_days`. Files (e.g. default-surface.vtp) and `exclude` names
    are never touched. Returns the deleted directory names."""
    if not jobs_dir.is_dir():
        return []

    keep = max(1, int(keep))
    skip = exclude or set()
    ttl = max_age_days * 86400 if max_age_days > 0 else None
    now = time.time()

    entries: list[tuple[float, Path]] = []
    for path in jobs_dir.iterdir():
        if not path.is_dir() or path.name in skip:
            continue
        try:
            entries.append((path.stat().st_mtime, path))
        except OSError:
            continue

    entries.sort(key=lambda item: item[0], reverse=True)

    removed: list[str] = []
    for index, (mtime, path) in enumerate(entries):
        too_many = index >= keep
        too_old = ttl is not None and (now - mtime) > ttl
        if not (too_many or too_old):
            continue
        try:
            shutil.rmtree(path)
            removed.append(path.name)
        except OSError:
            continue

    return removed
