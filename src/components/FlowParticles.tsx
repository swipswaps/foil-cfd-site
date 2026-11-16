import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FlowSphere } from '../data/scene';

interface Props {
  flowSphere?: FlowSphere;
  bodyQuaternion?: THREE.Quaternion;
  mode?: 'planar' | 'volume';
  count?: number;
  speed?: number;
  windVector?: [number, number, number];
}

const IDENTITY = new THREE.Quaternion();

export function FlowParticles({
  flowSphere,
  bodyQuaternion,
  mode = 'planar',
  count = 2500,
  speed = 2.0,
  windVector = [1, 0, 0],
}: Props) {
  const pointsRef = useRef<THREE.Points>(null);

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

  // Per-particle streamline Y — the y-coordinate each particle would
  // have if there were no obstacle. Restoring force uses this.
  const streamlinesRef = useRef<Float32Array | null>(null);
  if (!streamlinesRef.current || streamlinesRef.current.length !== count) {
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) s[i] = initial[i * 3 + 1];
    streamlinesRef.current = s;
  }

  const sphere = useMemo(() => {
    if (!flowSphere) return null;
    return {
      cx: flowSphere.center.x,
      cy: flowSphere.center.y,
      cz: flowSphere.center.z,
      R: Math.max(flowSphere.radius, 0.3),
      hx: flowSphere.halfExtents?.x ?? 0,
      hy: flowSphere.halfExtents?.y ?? 0,
      hz: flowSphere.halfExtents?.z ?? 0,
      hasOBB: !!flowSphere.halfExtents,
      effHalfX: flowSphere.halfExtents
        ? Math.max(flowSphere.halfExtents.x, 0.3)
        : Math.max(flowSphere.radius, 0.3),
    };
  }, [flowSphere]);

  const tmpP = useRef(new THREE.Vector3());
  const tmpV = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const geom = pointsRef.current?.geometry;
    if (!geom) return;
    const pos = geom.attributes.position.array as Float32Array;
    const streamlines = streamlinesRef.current;
    if (!streamlines) return;

    const subSteps = 3;
    const dt = (Math.min(delta, 0.05) * speed) / subSteps;

    const q = bodyQuaternion ?? IDENTITY;
    const qInv = q.clone().invert();
    const windWorld = new THREE.Vector3(...windVector);
    const U = windWorld.length() || 1;

    const chord = 2;
    const windLocal = windWorld.clone().applyQuaternion(qInv);
    const alphaLocal = Math.atan2(windLocal.y, windLocal.x);
    const gamma = Math.PI * U * chord * Math.sin(alphaLocal);
    const vMax = U * 2.5;

    const span = mode === 'volume' ? 4 : 0.2;
    const zMin = mode === 'volume' ? -2 : 0.9;
    const p = tmpP.current;
    const v = tmpV.current;

    for (let step = 0; step < subSteps; step++) {
      for (let i = 0; i < pos.length; i += 3) {
        const idx = i / 3;
        const px = pos[i], py = pos[i + 1], pz = pos[i + 2];
        let vx = 0, vy = 0, vz = 0;

        if (sphere) {
          p.set(px, py, pz).applyQuaternion(qInv);
          const lx = p.x - sphere.cx;
          const ly = p.y - sphere.cy;
          const lz = p.z - sphere.cz;
          const r2 = lx * lx + ly * ly + lz * lz;

          if (sphere.hasOBB) {
            const outsideX = Math.max(Math.abs(lx) - sphere.hx, 0);
            const outsideY = Math.max(Math.abs(ly) - sphere.hy, 0);
            const outsideZ = Math.max(Math.abs(lz) - sphere.hz, 0);
            const od = Math.sqrt(outsideX * outsideX + outsideY * outsideY + outsideZ * outsideZ);

            if (od < 1e-6) {
              const pushX = sphere.hx - Math.abs(lx);
              const pushY = sphere.hy - Math.abs(ly);
              const pushZ = sphere.hz - Math.abs(lz);
              const minPush = Math.min(pushX, pushY, pushZ);
              let nx = 0, ny = 0, nz = 0;
              if (minPush === pushX) nx = Math.sign(lx) || 1;
              else if (minPush === pushY) ny = Math.sign(ly) || 1;
              else nz = Math.sign(lz) || 1;
              vx = windWorld.x + nx * U * 2;
              vy = windWorld.y + ny * U * 2;
              vz = windWorld.z + nz * U * 2;
            } else if (od < 0.4) {
              const push = U * 2.2 * (1 - od / 0.4);
              const r = Math.sqrt(r2) + 1e-6;
              vx = windWorld.x + (lx / r) * push;
              vy = windWorld.y + (ly / r) * push;
              vz = windWorld.z + (lz / r) * push;
            } else {
              vx = windWorld.x; vy = windWorld.y; vz = windWorld.z;
            }
          } else {
            if (r2 > sphere.R * sphere.R) {
              const r = Math.sqrt(r2);
              const nx = lx / r, ny = ly / r, nz = lz / r;
              const uDotN = windWorld.x * nx + windWorld.y * ny + windWorld.z * nz;
              const s = Math.pow(sphere.R / r, 3) / 2;
              vx = windWorld.x + s * (windWorld.x - 3 * nx * uDotN);
              vy = windWorld.y + s * (windWorld.y - 3 * ny * uDotN);
              vz = windWorld.z + s * (windWorld.z - 3 * nz * uDotN);
            } else {
              const r = Math.sqrt(r2) + 1e-6;
              vx = windWorld.x + (lx / r) * U * 0.5;
              vy = windWorld.y + (ly / r) * U * 0.5;
              vz = windWorld.z + (lz / r) * U * 0.5;
            }
          }

          // RESTORE toward streamline once past the object
          const downstream = px - sphere.cx - sphere.effHalfX;
          if (downstream > 0) {
            const k = Math.min(downstream / (sphere.effHalfX + 0.5) * 1.6, 3.0);
            vy += (streamlines[idx] - py) * k;
          }
        } else {
          p.set(px, py, pz).applyQuaternion(qInv);
          const lx = p.x, ly = p.y, lz = p.z;

          let ux = windLocal.x, uy = windLocal.y, uz = windLocal.z;

          if (lx > -1.1 && lx < 1.1 && Math.abs(ly) < 0.3) {
            const env = Math.max(0, 1 - (lx * lx) / 1.21);
            uy += Math.sign(ly || 1) * U * 0.6 * env;
          }

          const dxV = lx + 0.5;
          const dyV = ly;
          const rV2 = dxV * dxV + dyV * dyV + 0.15;
          const decay = lx > 0.5 ? Math.exp(-(lx - 0.5) / 0.6) : 1;
          let uV = -gamma / (2 * Math.PI) * dyV / rV2 * decay;
          let vV = gamma / (2 * Math.PI) * dxV / rV2 * decay;
          const magV = uV * uV + vV * vV;
          if (magV > vMax * vMax) {
            const s = vMax / Math.sqrt(magV);
            uV *= s; vV *= s;
          }
          ux += uV; uy += vV;

          // RESTORE toward streamline once past trailing edge
          if (lx > 0.5) {
            const k = Math.min((lx - 0.5) * 1.8, 2.8);
            uy += (streamlines[idx] - ly) * k;
          }

          v.set(ux, uy, uz).applyQuaternion(q);
          vx = v.x; vy = v.y; vz = v.z;
        }

        pos[i] += vx * dt;
        pos[i + 1] += vy * dt;
        pos[i + 2] += vz * dt;
      }
    }

    // Out-of-bounds reset (once per frame, after all substeps)
    for (let i = 0; i < pos.length; i += 3) {
      const idx = i / 3;
      const outX = pos[i] > 5 || pos[i] < -5;
      const outY = pos[i + 1] > 2 || pos[i + 1] < -2;
      const outZ = pos[i + 2] > zMin + span || pos[i + 2] < zMin;
      if (outX || outY || outZ) {
        const newY = (Math.random() - 0.5) * 4;
        pos[i] = -5;
        pos[i + 1] = newY;
        pos[i + 2] = zMin + Math.random() * span;
        streamlines[idx] = newY;
      }
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
      <pointsMaterial size={0.035} color="#FFFFFF" transparent opacity={0.85} />
    </points>
  );
}
