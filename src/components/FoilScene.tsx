import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Airfoil } from './Airfoil';
import { FlowParticles } from './FlowParticles';
import { ModelViewer } from './ModelViewer';
import type { SceneContent } from '../data/scene';

interface Props {
  content: SceneContent;
  flow: boolean;
  speed: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

export function FoilScene({
  content, flow, speed,
  rotationX, rotationY, rotationZ,
}: Props) {
  const quat = useMemo(() => {
    const e = new THREE.Euler(
      (rotationX * Math.PI) / 180,
      (rotationY * Math.PI) / 180,
      (rotationZ * Math.PI) / 180,
      'XYZ'
    );
    return new THREE.Quaternion().setFromEuler(e);
  }, [rotationX, rotationY, rotationZ]);

  return (
    <Canvas
      camera={{ position: [0, 1.5, 5], fov: 45 }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      }}
      dpr={[1, 1.5]}
      onCreated={({ gl }) => { gl.setClearColor('#0B2545', 1); }}
    >
      <color attach="background" args={['#0B2545']} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 5, 5]} intensity={1.4} />
      <directionalLight position={[-5, 2, -3]} intensity={0.5} color="#5BC0EB" />

      <Suspense fallback={null}>
        <group quaternion={quat}>
          {content.kind === 'default' && <Airfoil />}
          {content.kind === 'naca' && <Airfoil code={content.code} />}
          {content.kind === 'model' && <ModelViewer object={content.object} />}
        </group>

        {flow && (
          <FlowParticles
            key={`flow-${content.token}`}
            mode={content.kind === 'model' ? 'volume' : 'planar'}
            count={content.kind === 'model' ? 3500 : 2500}
            flowSphere={content.kind === 'model' ? content.sphere : undefined}
            bodyQuaternion={quat}
            speed={speed}
          />
        )}
      </Suspense>

      <OrbitControls enableDamping />
    </Canvas>
  );
}
