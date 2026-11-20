import * as THREE from 'three';
import type { SceneContent } from '../data/scene';

export interface CpPoint {
  x: number;
  cp: number;
}

export interface SceneLab {
  url: string;
  label: string;
  kind: 'naca' | 'model';
  cp?: { upper: CpPoint[]; lower: CpPoint[] };
  revoke: () => void;
}

const MAX_MODEL_TRIS = 60000;

function vtpXml(
  points: number[][],
  polys: number[][],
  p: number[],
  u: number[][],
  t: number[],
): string {
  const pointCoords = points.map(([x, y, z]) => `${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`).join(' ');
  const conn = polys.flat().join(' ');
  const offsets = polys.map((_, i) => (i + 1) * 3).join(' ');
  const flatU = u.flat().map((v) => v.toFixed(6)).join(' ');
  const pv = p.map((v) => v.toFixed(6)).join(' ');
  const tv = t.map((v) => v.toFixed(6)).join(' ');
  return `<?xml version="1.0"?>
<VTKFile type="PolyData" version="0.1" byte_order="LittleEndian">
  <PolyData>
    <Piece NumberOfPoints="${points.length}" NumberOfVerts="0" NumberOfLines="0" NumberOfStrips="0" NumberOfPolys="${polys.length}">
      <PointData Scalars="p">
        <DataArray type="Float32" Name="p" format="ascii">${pv}</DataArray>
        <DataArray type="Float32" Name="U" NumberOfComponents="3" format="ascii">${flatU}</DataArray>
        <DataArray type="Float32" Name="T" format="ascii">${tv}</DataArray>
      </PointData>
      <Points>
        <DataArray type="Float32" NumberOfComponents="3" format="ascii">${pointCoords}</DataArray>
      </Points>
      <Polys>
        <DataArray type="Int64" Name="connectivity" format="ascii">${conn}</DataArray>
        <DataArray type="Int64" Name="offsets" format="ascii">${offsets}</DataArray>
      </Polys>
    </Piece>
  </PolyData>
</VTKFile>
`;
}

function nacaSection(code: string) {
  const m = parseInt(code[0], 10) / 100;
  const p = parseInt(code[1], 10) / 10;
  const t = parseInt(code.slice(2), 10) / 100;
  const n = 41;
  const xs = Array.from({ length: n }, (_, i) => (1 - Math.cos((Math.PI * i) / (n - 1))) / 2);
  const upper: number[] = [];
  const lower: number[] = [];
  for (const xc of xs) {
    const yt =
      5 * t *
      (0.2969 * Math.sqrt(xc) -
        0.1260 * xc -
        0.3516 * xc ** 2 +
        0.2843 * xc ** 3 -
        0.1015 * xc ** 4);
    let yc = 0;
    if (m > 0 && p > 0 && p < 1) {
      yc =
        xc <= p
          ? (m / (p * p)) * (2 * p * xc - xc * xc)
          : (m / ((1 - p) ** 2)) * ((1 - 2 * p) + 2 * p * xc - xc * xc);
    }
    upper.push(yc + yt);
    lower.push(yc - yt);
  }
  const cpUpper = xs.map((xc) => ({ x: xc, cp: 1 - 3 * Math.sin(Math.PI * xc) ** 1.4 }));
  const cpLower = xs.map((xc) => ({ x: xc, cp: 1 - 0.8 * Math.sin(Math.PI * xc) ** 1.4 }));
  return { xs, upper, lower, cp: { upper: cpUpper, lower: cpLower } };
}

function buildNaca(code: string): SceneLab {
  const { xs, upper, lower, cp } = nacaSection(code);
  const spans = [-1.4, 0, 1.4];
  const points: number[][] = [];
  const pv: number[] = [];
  const uv: number[][] = [];
  const tv: number[] = [];
  for (const z of spans) {
    for (const side of [0, 1]) {
      for (let i = 0; i < xs.length; i++) {
        const xc = xs[i];
        const y = side === 0 ? upper[i] : lower[i];
        points.push([(xc - 0.5) * 2, y * 4, z]);
        const cpv = side === 0 ? cp.upper[i].cp : cp.lower[i].cp;
        pv.push(cpv);
        const u = Math.sqrt(Math.max(1 - cpv, 0));
        uv.push([u, 0, 0]);
        tv.push(300 + cpv * 3);
      }
    }
  }
  const n = xs.length;
  const idx = (s: number, side: number, i: number) => (s * 2 + side) * n + i;
  const polys: number[][] = [];
  for (let s = 0; s < spans.length - 1; s++) {
    for (const side of [0, 1]) {
      for (let i = 0; i < n - 1; i++) {
        const a = idx(s, side, i);
        const b = idx(s, side, i + 1);
        const c = idx(s + 1, side, i + 1);
        const d = idx(s + 1, side, i);
        if (side === 0) polys.push([a, d, c], [a, c, b]);
        else polys.push([a, b, c], [a, c, d]);
      }
    }
  }
  const blob = new Blob([vtpXml(points, polys, pv, uv, tv)], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  return { url, label: `NACA ${code}`, kind: 'naca', cp, revoke: () => URL.revokeObjectURL(url) };
}

function buildModel(object: THREE.Object3D, filename: string): SceneLab {
  object.updateWorldMatrix(true, true);
  const points: number[][] = [];
  const tris: number[][] = [];
  let triCount = 0;
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const geo = mesh.geometry as THREE.BufferGeometry | undefined;
    if (!mesh.isMesh || !geo) return;
    const pos = geo.getAttribute('position');
    if (!pos) return;
    const base = points.length;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      points.push([v.x, v.y, v.z]);
    }
    const index = geo.getIndex();
    const total = index ? index.count / 3 : pos.count / 3;
    const limit = Math.min(total, MAX_MODEL_TRIS - triCount);
    for (let i = 0; i < limit; i++) {
      const a = index ? index.getX(i * 3) : i * 3;
      const b = index ? index.getX(i * 3 + 1) : i * 3 + 1;
      const c = index ? index.getX(i * 3 + 2) : i * 3 + 2;
      tris.push([base + a, base + b, base + c]);
      triCount++;
    }
  });
  if (!points.length || !tris.length) {
    throw new Error('model has no triangle geometry');
  }
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = maxY - minY || 1;
  const pv = points.map(([, y]) => (y - minY) / span);
  const uv = pv.map((p) => [1 - p, 0, 0]);
  const tv = pv.map((p) => 300 + p * 20);
  const blob = new Blob([vtpXml(points, tris, pv, uv, tv)], { type: 'application/xml' });
  const capped = triCount >= MAX_MODEL_TRIS ? ' (subset)' : '';
  const url = URL.createObjectURL(blob);
  return { url, label: `${filename}${capped}`, kind: 'model', revoke: () => URL.revokeObjectURL(url) };
}

export function buildSceneLab(scene: SceneContent): SceneLab | null {
  if (scene.kind === 'naca' && /^\d{4}$/.test(scene.code)) return buildNaca(scene.code);
  if (scene.kind === 'model') return buildModel(scene.object, scene.filename);
  return null;
}
