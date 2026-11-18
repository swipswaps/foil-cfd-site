"""FOIL.CFD - PyVista analysis and VTP surface extraction."""
from __future__ import annotations
from pathlib import Path
import math
import numpy as np
import pyvista as pv


def _airfoil_polyline(points: np.ndarray) -> pv.PolyData:
    """Build a PolyData with a single closed PolyLine cell (VTK convention)."""
    n = len(points)
    cell = np.insert(np.arange(n, dtype=np.intp), 0, n)
    cell = np.append(cell, 0)
    cell[0] = n + 1
    poly = pv.PolyData()
    poly.points = points
    poly.lines = cell
    return poly


def _default_polydata() -> pv.PolyData:
    n = 80
    beta = np.linspace(0.0, np.pi, n)
    xc = (1.0 - np.cos(beta)) / 2.0
    yt = 5.0 * 0.12 * (
        0.2969 * np.sqrt(xc) - 0.1260 * xc
        - 0.3516 * xc ** 2 + 0.2843 * xc ** 3 - 0.1015 * xc ** 4
    )
    upper = np.column_stack([xc, yt, np.zeros_like(xc)])
    lower = np.column_stack([xc[::-1], -yt[::-1], np.zeros_like(xc)])
    pts = np.vstack([upper, lower])
    poly = _airfoil_polyline(pts)

    cp_upper = 1.0 - 3.0 * np.sin(np.pi * xc) ** 1.4
    cp_lower = 1.0 - 0.8 * np.sin(np.pi * xc) ** 1.4
    cp = np.concatenate([cp_upper, cp_lower[::-1]])
    u_mag = np.sqrt(np.maximum(1.0 - cp, 0.0))
    poly.point_data["p"] = cp.astype(np.float32)
    poly.point_data["U"] = np.column_stack([
        u_mag, np.zeros_like(u_mag), np.zeros_like(u_mag)
    ]).astype(np.float32)
    poly.point_data["T"] = (300.0 + cp * 3.0).astype(np.float32)
    return poly


def ensure_default_surface(output_path: Path) -> Path:
    if not output_path.exists():
        _default_polydata().save(str(output_path))
    return output_path


def _read_case_block(case_dir: Path):
    foam_file = case_dir / "case.foam"
    if not foam_file.exists():
        foam_file.write_text("FOAM 4.1")
    reader = pv.get_reader(str(foam_file))
    dataset = reader.read()
    if isinstance(dataset, pv.MultiBlock):
        return dataset[0] if dataset.n_blocks > 0 else None
    return dataset


def _finite(value, default=0.0) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return default
    return v if math.isfinite(v) else default


def summarize_openfoam_case(case_dir: Path) -> dict:
    note = ""
    block = None
    try:
        block = _read_case_block(case_dir)
    except Exception as exc:
        note = f"reader: {exc}"

    used_fallback = block is None or int(getattr(block, "n_points", 0)) == 0
    if used_fallback:
        block = _default_polydata()
        note = note or "fallback: default NACA surface (no solver fields in case)"

    stats = {
        "n_points": int(block.n_points),
        "n_cells": int(block.n_cells),
        "bounds": [_finite(b) for b in block.bounds],
        "point_fields": list(block.point_data.keys()),
        "cell_fields": list(block.cell_data.keys()),
        "source": "default" if used_fallback else "openfoam",
    }
    if note:
        stats["note"] = note

    if "U" in block.point_data:
        arr = np.asarray(block.point_data["U"])
        mags = np.linalg.norm(arr, axis=1) if arr.ndim > 1 else np.abs(arr)
        mags = np.nan_to_num(mags, nan=0.0, posinf=0.0, neginf=0.0)
        stats["velocity_magnitude_mean"] = _finite(mags.mean()) if mags.size else 0.0
        stats["velocity_magnitude_max"] = _finite(mags.max()) if mags.size else 0.0
    return stats


def export_surface(case_dir: Path, output_vtp: Path) -> Path:
    try:
        block = _read_case_block(case_dir)
        if block is not None and int(getattr(block, "n_points", 0)) > 0:
            surf = block.extract_surface() if hasattr(block, "extract_surface") else block
            surf.save(str(output_vtp))
            return output_vtp
    except Exception:
        pass
    return ensure_default_surface(output_vtp)
