import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FlowSphere, FlowDirection } from '../data/scene';

interface Props {
  flowSphere?: FlowSphere;
  direction: FlowDirection;
  mode?: 'planar' | 'volume';
  count?: number;
  speed?: number;
}

/**
 * Potential flow around a sphere (doublet solution).
 *
 *   u(r) = U − (R³ / 2r³) · ( U − 3 (n̂·U) n̂ )
 *
 * where n̂ = (r − center)/|r − center| and U is the free-stream vector.
 * The perturbation is tangential at r = R (|u| = 3U/2 sin θ on the surface)
 * and vanishes at the upstream stagnation point (u = 0). Divergence-free,
 * classical textbook solution.
 *
 * NOTE: exact for spheres. For an arbitrary uploaded mesh, we evaluate the
 * sphere field around the mesh's bounding sphere — a decorative approximation,
 * not a solution of the Navier-Stokes equations. For real analysis use the
 * CAD editor link in the sidebar.
 */
function potentialFlow(
  px: number, py: number, pz: number,
  cx: number, cy: number, cz: number,
  R: number,
  ux: number, uy: number, uz: number,
): [number, number, number] {
  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  const r2 = dx * dx + dy * dy + dz * dz;
  if (r2 < 1e-9) return [ux, uy, uz];

  const r = Math.sqrt(r2);
  const nx = dx / r, ny = dy / r, nz = dz / r;
  const uDotN = ux * nx + uy * ny + uz * nz;

  const ratio = R / r;
  const strength = (ratio * ratio * ratio) / 2;

  // Correct sign: perturbation is (U − 3(n̂·U) n̂), not the negation.
  const pxv = ux - 3 * nx * uDotN;
  const pyv = uy - 3 * ny * uDotN;
  const pzv = uz - 3 * nz * uDotN;

  return [
    ux + strength * pxv,
    uy + strength * pyv,
    uz + strength * pzv,
  ];
}

export function FlowParticles({
  flowSphere,
  direction,
  mode = 'planar',
  count = 2500,
  speed = 2.0,
}: Props) {
  const pointsRef = useRef<THREE.Points>(null);

  const flowVector = useMemo<[number, number, number]>(() => {
    switch (direction) {
      case '+x': return [1, 0, 0];
      case '-x': return [-1, 0, 0];
      case '+y': return [0, 1, 0];
      case '-y': return [0, -1, 0];
      case '+z': return [0, 0, 1];
      case '-z': return [0, 0, -1];
      case 'free':
      default: return [1, 0, 0];
    }
  }, [direction]);

  const initial = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const zMin = mode === 'volume' ? -2 : 0.9;
    const zSpan = mode === 'volume' ? 4 : 0.2;
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 10;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 4;
      arr[i * 3 + 2] = zMin + Math.random() * zSpan;
    }
    return arr;
  }, [count, mode]);

  const sphere = useMemo(() => {
    if (!flowSphere) return null;
    return {
      cx: flowSphere.center.x,
      cy: flowSphere.center.y,
      cz: flowSphere.center.z,
      R: Math.max(flowSphere.radius, 0.3),
    };
  }, [flowSphere]);

  useFrame((_, delta) => {
    const geom = pointsRef.current?.geometry;
    if (!geom) return;
    const pos = geom.attributes.position.array as Float32Array;
    const dt = Math.min(delta, 0.05) * speed;
    const [ux, uy, uz] = flowVector;
    const span = mode === 'volume' ? 4 : 0.2;
    const zMin = mode === 'volume' ? -2 : 0.9;

    for (let i = 0; i < pos.length; i += 3) {
      let vx: number, vy: number, vz: number;
      if (sphere) {
        [vx, vy, vz] = potentialFlow(
          pos[i], pos[i + 1], pos[i + 2],
          sphere.cx, sphere.cy, sphere.cz,
          sphere.R,
          ux, uy, uz
        );
      } else {
        // Airfoil: chord-aligned heuristic. No Navier-Stokes; just displaces
        // particles away from the section a bit so the geometry reads clearly.
        vx = ux;
        vy = uy;
        vz = uz;
        const x = pos[i];
        const y = pos[i + 1];
        if (x > -1.2 && x < 1.2 && Math.abs(y) < 0.35) {
          vy += Math.sign(y || 1) * 0.3;
        }
      }

      pos[i] += vx * dt;
      pos[i + 1] += vy * dt;
      pos[i + 2] += vz * dt;

      if (pos[i] > 5) pos[i] = -5;
      if (pos[i] < -5) pos[i] = 5;
      if (pos[i + 1] > 2) pos[i + 1] = -2;
      if (pos[i + 1] < -2) pos[i + 1] = 2;
      if (pos[i + 2] > zMin + span) pos[i + 2] = zMin;
      if (pos[i + 2] < zMin) pos[i + 2] = zMin + span;
    }
    geom.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={initial.length / 3}
          array={initial}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#FFFFFF" transparent opacity={0.75} />
    </points>
  );
}
