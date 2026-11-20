"""Generate a static 3D wing VTP for the backend-less CFD lab demo.

Stdlib only; writes public/demo/surface.vtp (ASCII PolyData).
"""
from __future__ import annotations
import math
from pathlib import Path

CHORD_POINTS = 41
SPANS = (-1.4, 0.0, 1.4)


def naca4412(xc: float) -> tuple[float, float]:
    t = 0.12
    m, p = 0.04, 0.4
    yt = 5 * t * (
        0.2969 * math.sqrt(max(xc, 0.0))
        - 0.1260 * xc
        - 0.3516 * xc ** 2
        + 0.2843 * xc ** 3
        - 0.1015 * xc ** 4
    )
    if xc < p:
        yc = (m / p ** 2) * (2 * p * xc - xc ** 2)
    else:
        yc = (m / (1 - p) ** 2) * ((1 - 2 * p) + 2 * p * xc - xc ** 2)
    return yc, yt


def main() -> None:
    xs = [(1 - math.cos(math.pi * i / (CHORD_POINTS - 1))) / 2 for i in range(CHORD_POINTS)]

    points: list[tuple[float, float, float]] = []
    pvals: list[float] = []
    uvals: list[tuple[float, float, float]] = []
    tvals: list[float] = []

    for z in SPANS:
        for side in (0, 1):  # 0 = upper, 1 = lower
            for xc in xs:
                yc, yt = naca4412(xc)
                y = yc + yt if side == 0 else yc - yt
                points.append(((xc - 0.5) * 2.0, y * 4.0, z))
                cp = 1 - 3 * math.sin(math.pi * xc) ** 1.4 if side == 0 else 1 - 0.8 * math.sin(math.pi * xc) ** 1.4
                pvals.append(cp)
                u = math.sqrt(max(1 - cp, 0.0))
                uvals.append((u, 0.0, 0.0))
                tvals.append(300.0 + cp * 3.0)

    polys: list[tuple[int, int, int]] = []

    def idx(span: int, side: int, i: int) -> int:
        return (span * 2 + side) * CHORD_POINTS + i

    for s in range(len(SPANS) - 1):
        for side in (0, 1):
            for i in range(CHORD_POINTS - 1):
                a = idx(s, side, i)
                b = idx(s, side, i + 1)
                c = idx(s + 1, side, i + 1)
                d = idx(s + 1, side, i)
                if side == 0:
                    polys.append((a, d, c))
                    polys.append((a, c, b))
                else:
                    polys.append((a, b, c))
                    polys.append((a, c, d))

    def floats(values: list[float]) -> str:
        return " ".join(f"{v:.6g}" for v in values)

    def arr(name: str, values: str, components: int | None = None) -> str:
        comp = f' NumberOfComponents="{components}"' if components else ""
        return (
            f'        <DataArray type="Float32" Name="{name}"{comp} format="ascii">'
            f"{values}</DataArray>\n"
        )

    point_data = (
        '      <PointData Scalars="p">\n'
        + arr("p", floats(pvals))
        + arr("U", floats([c for tup in uvals for c in tup]), 3)
        + arr("T", floats(tvals))
        + "      </PointData>\n"
    )
    point_coords = " ".join(f"{x:.6g} {y:.6g} {z:.6g}" for x, y, z in points)
    conn = " ".join(str(i) for tri in polys for i in tri)
    offsets = " ".join(str(3 * (n + 1)) for n in range(len(polys)))

    xml = (
        '<?xml version="1.0"?>\n'
        '<VTKFile type="PolyData" version="0.1" byte_order="LittleEndian">\n'
        "  <PolyData>\n"
        f'    <Piece NumberOfPoints="{len(points)}" NumberOfVerts="0" '
        f'NumberOfLines="0" NumberOfStrips="0" NumberOfPolys="{len(polys)}">\n'
        + point_data
        + "      <Points>\n"
        + f'        <DataArray type="Float32" NumberOfComponents="3" format="ascii">{point_coords}</DataArray>\n'
        + "      </Points>\n"
        + "      <Polys>\n"
        + f'        <DataArray type="Int64" Name="connectivity" format="ascii">{conn}</DataArray>\n'
        + f'        <DataArray type="Int64" Name="offsets" format="ascii">{offsets}</DataArray>\n'
        + "      </Polys>\n"
        + "    </Piece>\n"
        + "  </PolyData>\n"
        + "</VTKFile>\n"
    )

    out = Path(__file__).resolve().parent.parent / "public" / "demo" / "surface.vtp"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(xml, encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size} bytes, {len(points)} points, {len(polys)} polys)")


if __name__ == "__main__":
    main()
