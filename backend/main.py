"""FOIL.CFD OpenFOAM/PyVista backend."""
from __future__ import annotations
import os
import shutil
import subprocess
import threading
import uuid
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from job_retention import DEFAULT_MAX_JOBS, DEFAULT_TTL_DAYS, prune_jobs

app = FastAPI(title="FOIL.CFD OpenFOAM Backend", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:4173", "http://127.0.0.1:4173",
        "http://localhost:4174", "http://127.0.0.1:4174",
        "https://swipswaps.github.io",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

BASE = Path(__file__).resolve().parent
JOBS = BASE / "jobs"
CASES = BASE / "cases"
JOBS.mkdir(exist_ok=True)

REGISTRY: dict[str, dict] = {}


def _env_number(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return float(default)


def _prune_jobs() -> None:
    running = {
        jid for jid, meta in list(REGISTRY.items())
        if meta.get("status") in ("queued", "running")
    }
    removed = prune_jobs(
        JOBS,
        keep=int(_env_number("FOIL_MAX_JOBS", DEFAULT_MAX_JOBS)),
        max_age_days=_env_number("FOIL_JOB_TTL_DAYS", DEFAULT_TTL_DAYS),
        exclude=running,
    )
    for jid in removed:
        REGISTRY.pop(jid, None)
    for jid, meta in list(REGISTRY.items()):
        directory = meta.get("directory")
        if directory is not None and not directory.is_dir():
            REGISTRY.pop(jid, None)


_prune_jobs()


class SolveRequest(BaseModel):
    case_id: str = "naca0012"


@app.get("/api/health")
def health():
    return {
        "status": "online",
        "backend": "OpenFOAM/PyVista",
        "solver_available": shutil.which("simpleFoam") is not None,
        "blockMesh_available": shutil.which("blockMesh") is not None,
        "vtk_data_available": True,
    }


def _run_solver(job_id: str, case_dir: Path) -> None:
    REGISTRY[job_id]["status"] = "running"
    log = []
    try:
        if shutil.which("blockMesh"):
            r = subprocess.run(
                ["blockMesh", "-case", str(case_dir)],
                capture_output=True, text=True, timeout=180,
            )
            log.append(f"--- blockMesh (rc={r.returncode}) ---\n{r.stdout}\n{r.stderr}")
            (case_dir / "log.blockMesh").write_text(log[-1])

        if shutil.which("simpleFoam"):
            r = subprocess.run(
                ["simpleFoam", "-case", str(case_dir)],
                capture_output=True, text=True, timeout=900,
            )
            log.append(f"--- simpleFoam (rc={r.returncode}) ---\n{r.stdout}\n{r.stderr}")
            (case_dir / "log.simpleFoam").write_text(log[-1])

        if not shutil.which("simpleFoam"):
            (case_dir / "case.foam").write_text("FOAM 4.1")

        REGISTRY[job_id]["status"] = "completed"
    except Exception as exc:
        REGISTRY[job_id]["status"] = "failed"
        REGISTRY[job_id]["error"] = str(exc)
        (case_dir / "solver.log").write_text("\n".join(log) + f"\nERROR: {exc}")


@app.post("/api/solve")
def solve(req: SolveRequest):
    _prune_jobs()
    job_id = str(uuid.uuid4())
    job_dir = JOBS / job_id
    src = CASES / req.case_id
    if src.exists():
        shutil.copytree(src, job_dir)
    else:
        job_dir.mkdir(parents=True, exist_ok=True)
        (job_dir / "case.foam").write_text("FOAM 4.1")

    REGISTRY[job_id] = {"id": job_id, "status": "queued", "directory": job_dir}
    threading.Thread(target=_run_solver, args=(job_id, job_dir), daemon=True).start()
    return {"job_id": job_id, "status": "queued"}


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str):
    if job_id not in REGISTRY:
        raise HTTPException(404, "Job not found")
    j = REGISTRY[job_id]
    return {"job_id": j["id"], "status": j["status"], "error": j.get("error")}


@app.get("/api/jobs/{job_id}/analysis")
def job_analysis(job_id: str):
    if job_id not in REGISTRY:
        raise HTTPException(404, "Job not found")
    j = REGISTRY[job_id]
    if j["status"] != "completed":
        raise HTTPException(409, "Job not completed")
    from cfd_analysis import summarize_openfoam_case
    return summarize_openfoam_case(j["directory"])


@app.get("/api/jobs/default/surface.vtp")
def default_surface():
    from cfd_analysis import ensure_default_surface
    vtp = ensure_default_surface(JOBS / "default-surface.vtp")
    return FileResponse(vtp, media_type="application/octet-stream", filename="surface.vtp")


@app.get("/api/jobs/{job_id}/surface.vtp")
def job_surface(job_id: str):
    if job_id not in REGISTRY:
        raise HTTPException(404, "Job not found")
    vtp = REGISTRY[job_id]["directory"] / "surface.vtp"
    from cfd_analysis import export_surface
    export_surface(REGISTRY[job_id]["directory"], vtp)
    return FileResponse(vtp, media_type="application/octet-stream", filename="surface.vtp")
