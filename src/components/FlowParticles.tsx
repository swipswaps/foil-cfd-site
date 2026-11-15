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
    };
  }, [flowSphere]);

  const tmpP = useRef(new THREE.Vector3());
  const tmpV = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const geom = pointsRef.current?.geometry;
    if (!geom) return;
    const pos = geom.attributes.position.array as Float32Array;
    
    // Sub-stepping configuration to prevent numerical overshooting / particle separation
    const subSteps = 3;
    const frameDt = Math.min(delta, 0.05) * speed;
    const dt = frameDt / subSteps;

    const q = bodyQuaternion ?? IDENTITY;
    const qInv = q.clone().invert();
    const windWorld = new THREE.Vector3(...windVector);
    const U = windWorld.length() || 1;

    const chord = 2;
    const windLocal = windWorld.clone().applyQuaternion(qInv);
    const alphaLocal = Math.atan2(windLocal.y, windLocal.x);
    const gamma = Math.PI * U * chord * Math.sin(alphaLocal);
    const lambda = U * 0.15;
    const vMax = U * 2.5;

    const span = mode === 'volume' ? 4 : 0.2;
    const zMin = mode === 'volume' ? -2 : 0.9;
    const p = tmpP.current;
    const v = tmpV.current;

    for (let step = 0; step < subSteps; step++) {
      for (let i = 0; i < pos.length; i += 3) {
        const px = pos[i], py = pos[i + 1], pz = pos[i + 2];
        let vx: number, vy: number, vz: number;

        if (sphere) {
          p.set(px, py, pz).applyQuaternion(qInv);
          const lx = p.x - sphere.cx;
          const ly = p.y - sphere.cy;
          const lz = p.z - sphere.cz;
          const r2 = lx * lx + ly * ly + lz * lz;

          if (sphere.hasOBB) {
            const halfX = sphere.hx, halfY = sphere.hy, halfZ = sphere.hz;
            const outsideX = Math.max(Math.abs(lx) - halfX, 0);
            const outsideY = Math.max(Math.abs(ly) - halfY, 0);
            const outsideZ = Math.max(Math.abs(lz) - halfZ, 0);
            const outsideDist = Math.sqrt(
              outsideX * outsideX + outsideY * outsideY + outsideZ * outsideZ
            );

            if (outsideDist < 0.35) {
              const push = U * 2.0 * Math.max(0, 1 - outsideDist / 0.35);
              let nx = 0, ny = 0, nz = 0;
              if (outsideDist < 1e-6) {
                const pushX = halfX - Math.abs(lx);
                const pushY = halfY - Math.abs(ly);
                const pushZ = halfZ - Math.abs(lz);
                const minPush = Math.min(pushX, pushY, pushZ);
                if (minPush === pushX) nx = Math.sign(lx) || 1;
                else if (minPush === pushY) ny = Math.sign(ly) || 1;
                else nz = Math.sign(lz) || 1;
                p.set(nx * push, ny * push, nz * push).applyQuaternion(q);
                vx = windWorld.x + p.x;
                vy = windWorld.y + p.y;
                vz = windWorld.z + p.z;
                pos[i] += vx * dt;
                pos[i + 1] += vy * dt;
                pos[i + 2] += vz * dt;
                continue;
              }
              const r = Math.sqrt(r2) + 1e-6;
              nx = lx / r; ny = ly / r; nz = lz / r;
              p.set(nx * push, ny * push, nz * push).applyQuaternion(q);
              vx = windWorld.x + p.x;
              vy = windWorld.y + p.y;
              vz = windWorld.z + p.z;
            } else {
              vx = windWorld.x; vy = windWorld.y; vz = windWorld.z;
            }
          } else {
            if (r2 > sphere.R * sphere.R) {
              const r = Math.sqrt(r2);
              const nx = lx / r, ny = ly / r, nz = lz / r;
              const uDotN = windWorld.x * nx + windWorld.y * ny + windWorld.z * nz;
              const ratio = sphere.R / r;
              const s = ratio * ratio * ratio / 2;
              vx = windWorld.x + s * (windWorld.x - 3 * nx * uDotN);
              vy = windWorld.y + s * (windWorld.y - 3 * ny * uDotN);
              vz = windWorld.z + s * (windWorld.z - 3 * nz * uDotN);
            } else {
              const r = Math.sqrt(r2) + 1e-6;
              const push = U * 0.4;
              vx = windWorld.x + (lx / r) * push;
              vy = windWorld.y + (ly / r) * push;
              vz = windWorld.z + (lz / r) * push;
            }
          }
        } else {
          p.set(px, py, pz).applyQuaternion(qInv);
          const lx = p.x, ly = p.y, lz = p.z;

          let ux = windLocal.x, uy = windLocal.y, uz = windLocal.z;

          if (Math.abs(lx) < 1 && Math.abs(ly) < 0.15) {
            const pushY = 0.15 - Math.abs(ly);
            const pushX = 1 - Math.abs(lx);
            if (pushY < pushX) {
              uy += Math.sign(ly || 1) * U * 1.5;
            } else {
              ux += Math.sign(lx || 1) * U * 1.5;
            }
          }

          const dxV = lx + 0.5;
          const dyV = ly;
          const rV2 = dxV * dxV + dyV * dyV + 0.12;
          let uV = -gamma / (2 * Math.PI) * dyV / rV2;
          let vV = gamma / (2 * Math.PI) * dxV / rV2;
          const magV = uV * uV + vV * vV;
          if (magV > vMax * vMax) {
            const s = vMax / Math.sqrt(magV);
            uV *= s; vV *= s;
          }
          ux += uV; uy += vV;

          const rS2 = lx * lx + ly * ly + 0.12;
          let uS = lambda / (2 * Math.PI) * lx / rS2;
          let vS = lambda / (2 * Math.PI) * ly / rS2;
          const magS = uS * uS + vS * vS;
          if (magS > vMax * vMax) {
            const s = vMax / Math.sqrt(magS);
            uS *= s; vS *= s;
          }
          ux += uS; uy += vS;

          v.set(ux, uy, uz).applyQuaternion(q);
          vx = v.x; vy = v.y; vz = v.z;
        }

        pos[i] += vx * dt;
        pos[i + 1] += vy * dt;
        pos[i + 2] += vz * dt;

        const vmag2 = vx * vx + vy * vy + vz * vz;
        const outX = pos[i] > 5 || pos[i] < -5;
        const outY = pos[i + 1] > 2 || pos[i + 1] < -2;
        const outZ = pos[i + 2] > zMin + span || pos[i + 2] < zMin;
        const stuck = vmag2 < 0.005;
        if (outX || outY || outZ || stuck) {
          pos[i] = -5;
          pos[i + 1] = (Math.random() - 0.5) * 4;
          pos[i + 2] = zMin + Math.random() * span;
        }
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
