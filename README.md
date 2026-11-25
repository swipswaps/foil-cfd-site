# FOIL.CFD — browser CFD/3D workbench + local OpenFOAM backend

Live: https://swipswaps.github.io/foil-cfd-site/ — a React + Vite site (three.js +
VTK.js + Plotly) that renders a 3D foil, a Cp polar chart and a hydro workbench in
the browser, and can optionally talk to a **local** FastAPI + OpenFOAM backend for
real solves. It runs as a static site with no backend, and upgrades itself to a
live solver when one is reachable.

## How we got here

The site was a static GitHub Pages demo (bundled sample dataset, charts only). The
work to make it a real solver-backed tool, in the order it happened:

1. **Local Network Access (LNA).** A public HTTPS page may not silently fetch a
   loopback backend. Added `targetAddressSpace` on backend fetches, an explicit
   **Connect local backend** action, and a consent timeout, so a public page can
   (with permission) reach `127.0.0.1:8002`.
2. **Backend route order + analysis fallback.** Registered
   `/api/jobs/default/surface.vtp` before `/api/jobs/{job_id}`, and made
   `/analysis` never 500.
3. **Solver enablement.** The OpenFOAM image came up but the solver path was
   broken; four independent root causes were found from the job logs and fixed:
   - the image was missing `job_retention.py` (import crash) and used a pip flag
     apt's pip rejects -> `COPY job_retention.py` and `python3 -m pip`;
   - the base image's `ENTRYPOINT ["/openfoam/run"]` died **before uvicorn**
     (`/openfoam/run: 2: /usr/bin/python3: Syntax error ...`) -> `ENTRYPOINT []`
     and `CMD ["/bin/bash","-c","if [ -f /openfoam/profile.rc ]; then .
     /openfoam/profile.rc ''; fi; exec /usr/bin/python3 -m uvicorn ..."]`
     (clearing the wrapper; `--app-dir` alone could never help);
   - the bundled `system/blockMeshDict` was v1012 syntax -> `convertToMeters` ->
     `scale`, and removed the stray `;` after the `blocks` `hex ... grading`
     entry (list entries are newline-separated);
   - `system/fvSchemes/divSchemes` lacked the kEpsilon stress term
     `div((nuEff*dev2(T(grad(U))))) Gauss linear;`.
   Result: `/api/health` reports `solver_available=true` and `/api/solve` runs a
   real `simpleFoam` solve (job -> completed -> analysis `source=openfoam` -> VTP).
4. **Stale-chunk self-heal.** Hashed lazy chunks change every deploy while
   GitHub Pages serves `index.html` with `cache-control: max-age=600`, so a
   client holding an old `index`/`main` could lazy-import a chunk a newer deploy
   removed ("Failed to fetch dynamically imported module"). Added an inline
   `vite:preloadError` + `unhandledrejection` handler that reloads once,
   cache-busted (`?v=<ts>`), loop-guarded by `sessionStorage`.
5. **E2E coverage.** Static, offline, advanced (online) and a per-component suite,
   wired into CI (advanced step runs online with a backend; static step runs
   offline without one).

## Where we are now

- **Static mode (default).** Works with no backend: an explicit "Static demo ·
  sample wing" pill, the bundled demo dataset drives the charts, the 3D lab
  renders, and a **Connect local backend** action is offered. The operator
  command to self-host lives in a collapsed "Self-host the solver" disclosure,
  not in the primary status.
- **Online mode.** With a local backend the pill becomes "Live solver ready" (or
  "Live solver connected · preview mode" when the CFD solver is absent) and the
  lab header shows "Solver ready". The sidebar exposes the solve control with an
  honest note ("Bundled 2D channel case · simpleFoam · about 30 seconds"), a
  three-step progress indicator, elapsed seconds, a copyable job ID, best-effort
  cancel, and retry. A job goes to `/api/solve`, is polled with bounded retries,
  and its analysis plus `surface.vtp` are shown. The Field menu is discovered
  from the dataset (so a solved case offers `k`, `epsilon`, and `nut`, and drops
  `T` when it is absent), and a completed job drives the Cp chart and `Cn` from
  the solved surface pressure instead of the synthetic preview curve. The lab
  view (field, NACA code, speed, flow toggle, rotations, and job id) is mirrored
  into the URL, and **Copy link** reproduces it in another tab.
- **Bundled case is a 2D channel placeholder** (`backend/cases/naca0012/`), named
  for API compatibility but not a NACA airfoil mesh. It exists so the image can
  run a real, fast `simpleFoam` solve end to end.
- **CI.** `build` (npm ci, audit, lint, typecheck, build, JS budget check) -> `e2e`
  (starts the docker backend, runs advanced online + static offline + component
  specs) -> `deploy` (GitHub Pages, main only). The JS budget
  (`scripts/check-bundle-budget.mjs`, limits in `scripts/bundle-budget.json`)
  fails the build if the largest chunk, the lab's initial JavaScript, or total
  JavaScript grows past the recorded transfer budget.
- **Known limits.** Branch protection allows admin bypass (push logs "Bypassed
  rule violations"), so `e2e` is not a hard gate; the backend runs on the host and
  is not deployed by Pages; the live site is the static build.

## Exactly how to use

### A. Just view the site (static, no backend)
Open <https://swipswaps.github.io/foil-cfd-site/>. If you loaded it during a
deploy and see "App failed to load", hard reload once (Ctrl+Shift+R); after the
self-heal fix this is handled automatically.

### B. Run the local backend (with the real solver)
```bash
docker compose -f docker-compose.openfoam.yml up -d --build backend
curl -sS http://127.0.0.1:8002/api/health
# -> {"status":"online","solver_available":true,...}
```
Then reload the site and click **Connect local backend** (grant the local-network
prompt). Light backend without the solver: `docker compose up -d --build backend`
(health online, `solver_available:false`).

### C. Frontend dev
```bash
npm ci
npm run dev                       # http://localhost:5173/
# production preview:
VITE_BACKEND_URL=http://127.0.0.1:8002 npm run build
npx vite preview --port 4173 --strictPort --host 127.0.0.1
```

### D. Tests (Playwright)

Offline / static + components (no backend needed):
```bash
npm ci && npm run build
npx vite preview --port 4175 --strictPort --host 127.0.0.1 &
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4175/foil-cfd-site \
  npx playwright test tests/e2e/foil-static.spec.ts tests/e2e/foil-ux.spec.ts \
    tests/e2e/foil-offline.spec.ts tests/e2e/foil-components.spec.ts
```

Online (needs a running backend + a build that points at it):
```bash
docker compose -f docker-compose.openfoam.yml up -d --build backend
VITE_BACKEND_URL=http://127.0.0.1:8002 npm run build
npx vite preview --port 4173 --strictPort --host 127.0.0.1 &
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173/foil-cfd-site FOIL_API=http://127.0.0.1:8002 \
  npx playwright test tests/e2e/foil-advanced.spec.ts tests/e2e/foil-components.spec.ts
```
The online specs **skip** (not fail) when the page reports "Backend offline".

### E. Deploy
Push to `main`; CI builds, runs e2e, and deploys Pages.

## Troubleshooting (the exact failures we hit)

| Symptom | Cause | Fix |
|---|---|---|
| `/openfoam/run: 2: /usr/bin/python3: Syntax error ...` | base image ENTRYPOINT wrapper | `ENTRYPOINT []` + `bash -c` sourcing `/openfoam/profile.rc` |
| `Wrong token type - expected word ... ';'` at `blockMeshDict/blocks` | v1012 list syntax | `scale 1;`, remove `;` after the `hex ... grading` entry |
| `Entry 'div((nuEff*dev2(T(grad(U)))))' not found` | missing kEpsilon term | add `div((nuEff*dev2(T(grad(U))))) Gauss linear;` |
| `App failed to load: Failed to fetch dynamically imported module` | stale cached `index`/`main` | self-heals (reload once); otherwise hard reload |
| solve fails | case/solver output | read `backend/jobs/<job-id>/log.blockMesh` and `log.simpleFoam` |

## Repo layout
- `src/sections/` — Hero, CfdLab, HydroLab, ProjectShowcase, ReadmeSection
- `src/components/` — NavBar, Sidebar, BackendBadge, CpPolarChart, CfdVtkViewer, ...
- `src/hooks/useBackendProbe.ts` — online/offline detection (reads `VITE_BACKEND_URL`)
- `src/lib/backendFetch.ts` — LNA `targetAddressSpace` helper
- `backend/` — FastAPI app, `cfd_analysis.py`, `job_retention.py`, `cases/naca0012/`
- `docker-compose.openfoam.yml` — solver image (OpenFOAM 2312 + uvicorn)
- `tests/e2e/` — static, offline, advanced (online), components
