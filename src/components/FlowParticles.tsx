import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function FlowParticles() {
  const pointsRef = useRef<THREE.Points>(null);

  const initial = useMemo(() => {
    const count = 2500;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 3;
      arr[i * 3 + 2] = 0.9 + Math.random() * 0.2;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    const geom = pointsRef.current?.geometry;
    if (!geom) return;
    const pos = geom.attributes.position.array as Float32Array;
    const speed = Math.min(delta, 0.05) * 2.0;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i];
      const y = pos[i + 1];
      pos[i] += speed;
      if (x > -1.2 && x < 1.2 && Math.abs(y) < 0.35) {
        pos[i + 1] += Math.sign(y || 1) * speed * 0.3;
      }
      if (pos[i] > 4.5) {
        pos[i] = -4.5;
        pos[i + 1] = (Math.random() - 0.5) * 3;
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
