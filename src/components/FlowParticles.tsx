import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { FlowSphere } from '../data/scene';

interface Props {
  flowSphere?: FlowSphere;
  mode?: 'planar' | 'volume';
  count?: number;
}

export function FlowParticles({
  flowSphere,
  mode = 'planar',
  count = 2500,
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

  // Precompute sphere values once
  const sphere = useMemo(() => {
    if (!flowSphere) return null;
    return {
      cx: flowSphere.center.x,
      cy: flowSphere.center.y,
      cz: flowSphere.center.z,
      r: flowSphere.radius * 1.35,
    };
  }, [flowSphere]);

  useFrame((_, delta) => {
    const geom = pointsRef.current?.geometry;
    if (!geom) return;
    const pos = geom.attributes.position.array as Float32Array;
    const speed = Math.min(delta, 0.05) * 2.0;
    const span = mode === 'volume' ? 4 : 0.2;
    const zMin = mode === 'volume' ? -2 : 0.9;

    for (let i = 0; i < pos.length; i += 3) {
      pos[i] += speed;

      if (sphere) {
        const dx = pos[i] - sphere.cx;
        const dy = pos[i + 1] - sphere.cy;
        const dz = pos[i + 2] - sphere.cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < sphere.r * sphere.r) {
          const d = Math.sqrt(d2) || 1e-6;
          const push = ((sphere.r - d) / sphere.r) * speed * 5;
          pos[i] += (dx / d) * push;
          pos[i + 1] += (dy / d) * push;
          pos[i + 2] += (dz / d) * push;
        }
      } else {
        // Airfoil-style planar deflection
        const x = pos[i];
        const y = pos[i + 1];
        if (x > -1.2 && x < 1.2 && Math.abs(y) < 0.35) {
          pos[i + 1] += Math.sign(y || 1) * speed * 0.3;
        }
      }

      if (pos[i] > 5) {
        pos[i] = -5;
        pos[i + 1] = (Math.random() - 0.5) * 4;
        pos[i + 2] = zMin + Math.random() * span;
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
      <pointsMaterial size={0.03} color="#FFFFFF" transparent opacity={0.75} />
    </points>
  );
}
