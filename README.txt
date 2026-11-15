FOIL.CFD
========

CFD, CAD, and 3D tools for engineering research.


OVERVIEW
--------

FOIL.CFD is a portfolio and lab notebook for computational fluid dynamics,
computer-aided design, and real-time 3D simulation work. The site itself
doubles as a demonstration: the hero animation is a live React Three Fiber
scene rendering a cambered NACA 16-series airfoil with a particle flow field.

Stack: Vite, React, TypeScript, React Three Fiber, Three.js.


LOCAL DEVELOPMENT
-----------------

    npm install
    npm run dev

Vite serves at http://localhost:5173/. On first load, the app probes
http://127.0.0.1:8000/api/health. If the backend is up, the status pill
turns green. If not, the site runs in static mode — same experience as
the GitHub Pages deploy.

To run the optional backend locally:

    docker compose up --build -d

The backend is a minimal FastAPI service exposing /api/health. It exists
to demonstrate the online/offline detection pattern, not to do real CFD
solves. Swap in your solver behind the same endpoint and the front end
will pick it up automatically.


DEPLOYMENT
----------

Production builds deploy to GitHub Pages via GitHub Actions.

    ./scripts/bootstrap_gh_pages.sh

The script is idempotent. It creates the repository if missing, enables
Pages with build_type=workflow, pushes to main, watches the deploy run,
polls the Pages URL until HTTP 200, and opens it.

Manual equivalent:

    git push origin main
    gh run watch


LICENSE
-------

MIT
