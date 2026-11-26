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

# Chrome Local Network Access: a public page reaching a loopback backend sends a
# preflight with Access-Control-Request-Private-Network; the server must answer
# with Access-Control-Allow-Private-Network: true or the fetch is blocked even
# after the user grants permission. Starlette CORSMiddleware does not emit it.
from starlette.middleware.base import BaseHTTPMiddleware


class PrivateNetworkAccess(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response


app.add_middleware(PrivateNetworkAccess)

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


def _run_tool(args: list[str], timeout: int) -> tuple[int, str, str]:
    proc = subprocess.Popen(
        args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        out, err = proc.communicate()
        return 124, (out or "") + f"\n[timed out after {timeout}s]\n", err or ""
    return proc.returncode, out or "", err or ""


def _run_solver(job_id: str, case_dir: Path) -> None:
    REGISTRY[job_id]["status"] = "running"
    log = []
    failure = ""
    try:
        if shutil.which("blockMesh"):
            rc, out, err = _run_tool(["blockMesh", "-case", str(case_dir)], 180)
            log.append(f"--- blockMesh (rc={rc}) ---\n{out}\n{err}")
            (case_dir / "log.blockMesh").write_text(log[-1])
            if rc != 0:
                failure = f"blockMesh exited with code {rc}"

        if not failure and shutil.which("simpleFoam"):
            rc, out, err = _run_tool(["simpleFoam", "-case", str(case_dir)], 900)
            log.append(f"--- simpleFoam (rc={rc}) ---\n{out}\n{err}")
            (case_dir / "log.simpleFoam").write_text(log[-1])
            if rc != 0:
                failure = f"simpleFoam exited with code {rc}"

        (case_dir / "case.foam").write_text("FOAM 4.1")

        if failure:
            REGISTRY[job_id]["status"] = "failed"
            REGISTRY[job_id]["error"] = failure
        else:
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
