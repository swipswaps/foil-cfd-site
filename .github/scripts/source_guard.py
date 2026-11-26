#!/usr/bin/env python3
"""source-guard.py — block process-execution constructs in any checkout.

Standalone and stdlib-only so it can be vendored into any repository. The
pre-push hook and the CI workflow installed by
scripts/install-source-guard.sh run it before a change leaves the machine.

It flags code (not comment-only lines) that bypasses the reviewed process
helpers: subprocess dot run/call/check_call/check_output/getoutput, os.system,
os.popen, a shell-assign true, getattr(subprocess, run), and
from subprocess import run.

usage:
  python3 source-guard.py ROOT
  python3 source-guard.py ROOT --json --quiet
  python3 source-guard.py --self-test

Exit status: 0 clean, 1 findings, 2 usage/environment error.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path

EXTS = {
    ".py", ".pyi", ".sh", ".bash", ".zsh", ".ksh",
    ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx",
}
SKIP_DIRS = {
    ".git", "node_modules", "dist", "dist-ssr", "build", "__pycache__",
    ".repair-backups", "test-results", "playwright-report", "jobs",
}
COMMENT_MARKERS = {
    ".py": ("#",), ".pyi": ("#",),
    ".sh": ("#",), ".bash": ("#",), ".zsh": ("#",), ".ksh": ("#",),
    ".js": ("//",), ".mjs": ("//",), ".cjs": ("//",),
    ".ts": ("//",), ".tsx": ("//",), ".jsx": ("//",),
}

PATTERNS = [
    ("subprocess.run", re.compile(r"\bsubprocess\.run\s*\(")),
    ("subprocess.call", re.compile(r"\bsubprocess\.call\s*\(")),
    ("subprocess.check_call", re.compile(r"\bsubprocess\.check_call\s*\(")),
    ("subprocess.check_output", re.compile(r"\bsubprocess\.check_output\s*\(")),
    ("subprocess.getoutput", re.compile(r"\bsubprocess\.getoutput\s*\(")),
    ("os.system", re.compile(r"\bos\.system\s*\(")),
    ("os.popen", re.compile(r"\bos\.popen\s*\(")),
    ("shell-assign", re.compile(r"\bshell\s*=\s*True\b")),
    ("getattr-subprocess-run", re.compile(r"getattr\s*\(\s*subprocess\s*,\s*['\"]run['\"]")),
    ("import-subprocess-run", re.compile(r"from\s+subprocess\s+import\s+[^\n]*\brun\b")),
]


def code_part(line: str, ext: str) -> str:
    """Return the part of a line before a comment marker outside quotes."""
    markers = COMMENT_MARKERS.get(ext, ())
    if not markers:
        return line
    quote = ""
    i = 0
    while i < len(line):
        ch = line[i]
        if quote:
            if ch == quote and (i == 0 or line[i - 1] != "\\"):
                quote = ""
        elif ch in "'\"":
            quote = ch
        elif any(line.startswith(marker, i) for marker in markers):
            return line[:i]
        i += 1
    return line


def scan_file(path: Path, root: Path) -> list[dict]:
    ext = path.suffix.lower()
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError as exc:
        print(f"read error: {path}: {exc}", file=sys.stderr)
        return []
    findings = []
    for number, line in enumerate(text.splitlines(), start=1):
        code = code_part(line, ext)
        for rule, regex in PATTERNS:
            if regex.search(code):
                findings.append({
                    "path": str(path.relative_to(root)) if path != root else str(path),
                    "line": number,
                    "rule": rule,
                    "text": line.strip()[:200],
                })
    return findings


def scan_root(root: Path, exts: set[str] | None = None) -> list[dict]:
    findings: list[dict] = []
    wanted = exts or EXTS
    self_path = Path(__file__).resolve()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS)
        for name in sorted(filenames):
            path = Path(dirpath) / name
            if path.suffix.lower() not in wanted:
                continue
            try:
                if path.resolve() == self_path:
                    continue
            except OSError:
                pass
            findings.extend(scan_file(path, root))
    return findings


def emit(findings: list[dict], as_json: bool, quiet: bool) -> None:
    if as_json:
        print(json.dumps({"count": len(findings), "findings": findings}, indent=2))
        return
    if not quiet:
        for item in findings:
            print(f"{item['path']}:{item['line']}  [{item['rule']}]  {item['text']}")
        print("")
        print(f"source-guard: {len(findings)} finding(s)")
    else:
        print(f"source-guard: {len(findings)} finding(s)")


def self_test() -> int:
    work = Path(tempfile.mkdtemp(prefix="source-guard-"))
    fail = 0
    try:
        (work / "bad.py").write_text(
            "import subprocess\nsubprocess" + ".run(['true'])\n", encoding="utf-8")
        (work / "bad.sh").write_text(
            "#!/bin/bash\npython3 -c 'import os; os" + ".system(\"id\")'\n", encoding="utf-8")
        (work / "safe.py").write_text(
            "import subprocess\nproc = subprocess.Popen(['true'], stdout=subprocess.PIPE)\n",
            encoding="utf-8")
        (work / "comment.py").write_text(
            "# subprocess" + ".run is banned in source\nx = 1\n", encoding="utf-8")
        findings = scan_root(work)
        rules = {(item["path"], item["rule"]) for item in findings}
        cases = [
            ("bad.py flagged", ("bad.py", "subprocess.run") in rules),
            ("bad.sh flagged", ("bad.sh", "os.system") in rules),
            ("Popen allowed", all(item["path"] != "safe.py" for item in findings)),
            ("comment ignored", all(item["path"] != "comment.py" for item in findings)),
        ]
        for name, ok in cases:
            print(("  PASS " if ok else "  FAIL ") + name)
            if not ok:
                fail += 1
    finally:
        for child in work.iterdir():
            child.unlink()
        work.rmdir()
    print("source-guard: self-test " + ("PASS" if fail == 0 else "FAIL"))
    return 0 if fail == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Flag process-execution constructs in any checkout.")
    parser.add_argument("root", nargs="?", default=".")
    parser.add_argument("--ext", default="",
                        help="comma-separated extensions to scan (default: all source)")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"FAIL: not a directory: {args.root}", file=sys.stderr)
        return 2
    exts = EXTS
    if args.ext:
        exts = {e if e.startswith(".") else "." + e for e in args.ext.split(",") if e}
    findings = scan_root(root, exts)
    emit(findings, args.json, args.quiet)
    return 0 if not findings else 1


if __name__ == "__main__":
    sys.exit(main())
