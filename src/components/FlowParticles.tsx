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

  // World-Y lane each particle started on.
  const laneYRef = useRef<Float32Array | null>(null);
  if (!laneYRef.current || laneYRef.current.length !== count) {
    const lanes = new Float32Array(count);
    for (let i = 0; i < count; i++) lanes[i] = initial[i * 3 + 1];
    laneYRef.current = lanes;
  }

  // World centre + half-extents of the body (from content.sphere, world coords).
  const body = useMemo(() => {
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
      halfChordWorld: flowSphere.halfExtents
        ? flowSphere.halfExtents.x
        : flowSphere.radius,
    };
  }, [flowSphere]);

  const tmpP = useRef(new THREE.Vector3());
  const tmpV = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const geom = pointsRef.current?.geometry;
    if (!geom) return;
    const pos = geom.attributes.position.array as Float32Array;
    const lanes = laneYRef.current;
    if (!lanes) return;

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
    const vCap = U * 3.5;

    const span = mode === 'volume' ? 4 : 0.2;
    const zMin = mode === 'volume' ? -2 : 0.9;
    const p = tmpP.current;
    const v = tmpV.current;

    for (let step = 0; step < subSteps; step++) {
      for (let i = 0; i < pos.length; i += 3) {
        const idx = i / 3;
        const wx = pos[i], wy = pos[i + 1], wz = pos[i + 2];
        let vx = 0, vy = 0, vz = 0;
        // For restore: track how "past" the body the particle is in world-x
        let pastWorldX = 0;

        if (body) {
          // Correct frame handling: subtract WORLD centre first, THEN rotate
          const dxw = wx - body.cx;
          const dyw = wy - body.cy;
          const dzw = wz - body.cz;
          p.set(dxw, dyw, dzw).applyQuaternion(qInv);
          const lx = p.x, ly = p.y, lz = p.z;
          const r2 = lx * lx + ly * ly + lz * lz;

          if (body.hasOBB) {
            const oX = Math.max(Math.abs(lx) - body.hx, 0);
            const oY = Math.max(Math.abs(ly) - body.hy, 0);
            const oZ = Math.max(Math.abs(lz) - body.hz, 0);
            const od = Math.sqrt(oX * oX + oY * oY + oZ * oZ);
            if (od < 1e-6) {
              const pX = body.hx - Math.abs(lx);
              const pY = body.hy - Math.abs(ly);
              const pZ = body.hz - Math.abs(lz);
              const minP = Math.min(pX, pY, pZ);
              let nx = 0, ny = 0, nz = 0;
              if (minP === pX) nx = Math.sign(lx) || 1;
              else if (minP === pY) ny = Math.sign(ly) || 1;
              else nz = Math.sign(lz) || 1;
              vx = windLocal.x + nx * U * 2;
              vy = windLocal.y + ny * U * 2;
              vz = windLocal.z + nz * U * 2;
            } else if (od < 0.4) {
              const push = U * 2.2 * (1 - od / 0.4);
              const r = Math.sqrt(r2) + 1e-6;
              vx = windLocal.x + (lx / r) * push;
              vy = windLocal.y + (ly / r) * push;
              vz = windLocal.z + (lz / r) * push;
            } else {
              vx = windLocal.x; vy = windLocal.y; vz = windLocal.z;
            }
          } else {
            if (r2 > body.R * body.R) {
              const r = Math.sqrt(r2);
              const nx = lx / r, ny = ly / r, nz = lz / r;
              const uDotN = windLocal.x * nx + windLocal.y * ny + windLocal.z * nz;
              const s = Math.pow(body.R / r, 3) / 2;
              vx = windLocal.x + s * (windLocal.x - 3 * nx * uDotN);
              vy = windLocal.y + s * (windLocal.y - 3 * ny * uDotN);
              vz = windLocal.z + s * (windLocal.z - 3 * nz * uDotN);
            } else {
              const r = Math.sqrt(r2) + 1e-6;
              vx = windLocal.x + (lx / r) * U * 0.5;
              vy = windLocal.y + (ly / r) * U * 0.5;
              vz = windLocal.z + (lz / r) * U * 0.5;
            }
          }

          pastWorldX = (wx - body.cx) - body.halfChordWorld;

          // Rotate local velocity to world
          v.set(vx, vy, vz).applyQuaternion(q);
          vx = v.x; vy = v.y; vz = v.z;
        } else {
          // Airfoil (object at origin)
          p.set(wx, wy, wz).applyQuaternion(qInv);
          const lx = p.x, ly = p.y;

          let ux = windLocal.x, uy = windLocal.y, uz = windLocal.z;

          if (lx > -1.1 && lx < 1.1 && Math.abs(ly) < 0.3) {
            const env = Math.max(0, 1 - (lx * lx) / 1.21);
            uy += Math.sign(ly || 1) * U * 0.6 * env;
          }

          const dxV = lx + 0.5;
          const dyV = ly;
          const rV2 = dxV * dxV + dyV * dyV + 0.15;
          const decay = lx > 0.5 ? Math.exp(-(lx - 0.5) / 0.6) : 1;
          let uV = (-gamma / (2 * Math.PI)) * dyV / rV2 * decay;
          let vV = (gamma / (2 * Math.PI)) * dxV / rV2 * decay;
          const magV = uV * uV + vV * vV;
          if (magV > vMax * vMax) {
            const s = vMax / Math.sqrt(magV);
            uV *= s; vV *= s;
          }
          ux += uV; uy += vV;

          pastWorldX = lx - 0.5;

          v.set(ux, uy, uz).applyQuaternion(q);
          vx = v.x; vy = v.y; vz = v.z;
        }

        // ------------------------- WORLD-SPACE RESTORE -------------------------
        // pos[i+1] is world-Y. lanes[idx] is the particle's world-Y lane.
        // The restoring force is applied in world-Y AFTER the quaternion rotate,
        // so a yawed/pitched body no longer sends particles the wrong way.
        if (pastWorldX > 0) {
          const ramp = Math.min(pastWorldX / 1.2, 3.0);
          const err = lanes[idx] - wy;
          // Dead-band to avoid micro-jitter near the lane
          if (Math.abs(err) > 0.02) {
            vy += err * ramp * U;
          }
        }

        // ---- Clamp total velocity so restoring never overshoots ----
        const vm2 = vx * vx + vy * vy + vz * vz;
        if (vm2 > vCap * vCap) {
          const s = vCap / Math.sqrt(vm2);
          vx *= s; vy *= s; vz *= s;
        }

        pos[i] += vx * dt;
        pos[i + 1] += vy * dt;
        pos[i + 2] += vz * dt;
      }
    }

    // Reset out-of-bounds (once per frame)
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
        lanes[idx] = newY;
      }
    }

    geom.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[initial, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.035} color="#FFFFFF" transparent opacity={0.85} />
    </points>
  );
}
