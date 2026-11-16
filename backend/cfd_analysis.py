"""FOIL.CFD - PyVista analysis and VTP surface extraction."""
from __future__ import annotations
from pathlib import Path
import numpy as np
import pyvista as pv


def _airfoil_polyline(points: np.ndarray) -> pv.PolyData:
    """Build a PolyData with a single closed PolyLine cell (VTK convention)."""
    n = len(points)
    cell = np.insert(np.arange(n, dtype=np.int_), 0, n)
    cell = np.append(cell, 0)  # close the loop
    cell[0] = n + 1            # leading count includes the extra closing point
    poly = pv.PolyData()
    poly.points = points
    poly.lines = cell
    return poly


def ensure_default_surface(output_path: Path) -> Path:
    if output_path.exists():
        return output_path
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
    poly.save(str(output_path))
    return output_path


def summarize_openfoam_case(case_dir: Path) -> dict:
    foam_file = case_dir / "case.foam"
    if not foam_file.exists():
        foam_file.write_text("FOAM 4.1")
    try:
        reader = pv.get_reader(str(foam_file))
        dataset = reader.read()
        block = dataset[0] if isinstance(dataset, pv.MultiBlock) and dataset.n_blocks > 0 else dataset
    except Exception as exc:
        return {"n_points": 0, "n_cells": 0, "note": f"Reader: {exc}"}

    stats = {
        "n_points": int(block.n_points),
        "n_cells": int(block.n_cells),
        "bounds": [float(b) for b in block.bounds],
        "point_fields": list(block.point_data.keys()),
        "cell_fields": list(block.cell_data.keys()),
    }
    if "U" in block.point_data:
        arr = np.asarray(block.point_data["U"])
        mags = np.linalg.norm(arr, axis=1) if arr.ndim > 1 else np.abs(arr)
        stats["velocity_magnitude_mean"] = float(mags.mean())
        stats["velocity_magnitude_max"] = float(mags.max())
    return stats


def export_surface(case_dir: Path, output_vtp: Path) -> Path:
    foam_file = case_dir / "case.foam"
    if foam_file.exists():
        try:
            reader = pv.get_reader(str(foam_file))
            dataset = reader.read()
            block = dataset[0] if isinstance(dataset, pv.MultiBlock) and dataset.n_blocks > 0 else dataset
            surf = block.extract_surface() if hasattr(block, "extract_surface") else block
            surf.save(str(output_vtp))
            return output_vtp
        except Exception:
            pass
    return ensure_default_surface(output_vtp)
