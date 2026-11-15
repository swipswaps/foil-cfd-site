import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Airfoil } from './Airfoil';
import { FlowParticles } from './FlowParticles';
import { ModelViewer } from './ModelViewer';
import type { SceneContent } from '../data/scene';

interface Props {
  content: SceneContent;
  flow: boolean;
}

export function FoilScene({ content, flow }: Props) {
  return (
    <Canvas camera={{ position: [0, 1.5, 5], fov: 45 }}>
      <color attach="background" args={['#0B2545']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <Environment preset="city" />

      {content.kind === 'default' && (
        <>
          <Airfoil />
          {flow && (
            <FlowParticles key={`flow-d-${content.token}`} mode="planar" />
          )}
        </>
      )}

      {content.kind === 'naca' && (
        <>
          <Airfoil code={content.code} />
          {flow && (
            <FlowParticles
              key={`flow-n-${content.token}`}
              mode="planar"
            />
          )}
        </>
      )}

      {content.kind === 'model' && (
        <>
          <ModelViewer object={content.object} />
          {flow && (
            <FlowParticles
              key={`flow-m-${content.token}`}
              mode="volume"
              count={3500}
              flowSphere={content.sphere}
            />
          )}
        </>
      )}

      <OrbitControls enableDamping />
    </Canvas>
  );
}
