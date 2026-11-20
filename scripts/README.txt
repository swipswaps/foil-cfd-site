FOIL.CFD scripts
================

Maintained tools
----------------
bootstrap_gh_pages.sh
    Idempotent GitHub Pages bootstrap: creates the repo if missing, enables
    Pages (build_type=workflow), pushes main, watches the run, polls the URL.

test_cfd_tools.sh
    Backend API smoke test. Usage: bash scripts/test_cfd_tools.sh [base-url]
    Default base: http://127.0.0.1:8002. Exits non-zero on any failed check.
    Normalizes curl's 000 and allows 30 s for the cold PyVista import.

make_demo_vtp.py
    Generates public/demo/surface.vtp (static 3D wing, 246 pts / 320 polys)
    for the backend-less CFD lab. Stdlib only; reproducible.

One-shot repairs (not maintained here)
--------------------------------------
Repair and migration scripts that depend on machine-local inputs (for example
a /tmp source report with a fixed checksum) are deliberately kept out of
scripts/. They are archived under .repair-backups/ (git-ignored) so they cannot
be mistaken for reproducible tooling or re-run against a newer tree.

If a repair is needed again, promote a cleaned, self-locating version into
scripts/ with idempotent preconditions, a backup, a rollback, and a named
verification step.
