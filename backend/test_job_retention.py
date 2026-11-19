"""Unit tests for job_retention (stdlib only)."""
from __future__ import annotations
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from job_retention import prune_jobs


def make_jobs(root: Path, count: int, base_age: float = 10_000.0) -> None:
    for i in range(count):
        d = root / f"job{i}"
        d.mkdir()
        stamp = base_age + i
        os.utime(d, (stamp, stamp))


class RetentionTest(unittest.TestCase):
    def test_keeps_newest_and_preserves_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_jobs(root, 5)
            (root / "default-surface.vtp").write_text("vtk")
            removed = prune_jobs(root, keep=2, max_age_days=0)
            dirs = sorted(p.name for p in root.iterdir() if p.is_dir())
            self.assertEqual(dirs, ["job3", "job4"])
            self.assertEqual(sorted(removed), ["job0", "job1", "job2"])
            self.assertTrue((root / "default-surface.vtp").exists())

    def test_ttl_removes_old(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            old = root / "old"
            old.mkdir()
            stamp = time.time() - 10 * 86400
            os.utime(old, (stamp, stamp))
            fresh = root / "fresh"
            fresh.mkdir()
            removed = prune_jobs(root, keep=10, max_age_days=7)
            self.assertEqual(removed, ["old"])
            self.assertTrue(fresh.is_dir())

    def test_exclude_running(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            make_jobs(root, 5)
            removed = prune_jobs(root, keep=2, max_age_days=0, exclude={"job0"})
            dirs = sorted(p.name for p in root.iterdir() if p.is_dir())
            self.assertEqual(dirs, ["job0", "job3", "job4"])
            self.assertEqual(sorted(removed), ["job1", "job2"])

    def test_missing_dir_is_safe(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(prune_jobs(Path(tmp) / "nope"), [])


if __name__ == "__main__":
    unittest.main()
