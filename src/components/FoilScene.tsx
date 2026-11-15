import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Airfoil } from './Airfoil';
import { FlowParticles } from './FlowParticles';
import { ModelViewer } from './ModelViewer';
import type { SceneContent, FlowDirection } from '../data/scene';

interface Props {
  content: SceneContent;
  flow: boolean;
  direction: FlowDirection;
  speed: number;
}

export function FoilScene({ content, flow, direction, speed }: Props) {
  return (
    <Canvas
      camera={{ position: [0, 1.5, 5], fov: 45 }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor('#0B2545', 1);
      }}
    >
      <color attach="background" args={['#0B2545']} />

      {/* Two-point lighting — no external HDRI dependency. */}
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 5, 5]} intensity={1.4} />
      <directionalLight position={[-5, 2, -3]} intensity={0.5} color="#5BC0EB" />

      <Suspense fallback={null}>
        {content.kind === 'default' && (
          <>
            <Airfoil />
            {flow && (
              <FlowParticles
                key={`flow-d-${content.token}-${direction}`}
                mode="planar"
                direction={direction}
                speed={speed}
              />
            )}
          </>
        )}

        {content.kind === 'naca' && (
          <>
            <Airfoil code={content.code} />
            {flow && (
              <FlowParticles
                key={`flow-n-${content.token}-${direction}`}
                mode="planar"
                direction={direction}
                speed={speed}
              />
            )}
          </>
        )}

        {content.kind === 'model' && (
          <>
            <ModelViewer object={content.object} />
            {flow && (
              <FlowParticles
                key={`flow-m-${content.token}-${direction}`}
                mode="volume"
                count={3500}
                flowSphere={content.sphere}
                direction={direction}
                speed={speed}
              />
            )}
          </>
        )}
      </Suspense>

      <OrbitControls enableDamping />
    </Canvas>
  );
}
