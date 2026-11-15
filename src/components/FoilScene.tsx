import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { Airfoil } from './Airfoil';
import { FlowParticles } from './FlowParticles';
import { ModelViewer } from './ModelViewer';
import type { SceneContent } from '../data/scene';

interface Props {
  content: SceneContent;
}

export function FoilScene({ content }: Props) {
  return (
    <Canvas camera={{ position: [0, 1.5, 5], fov: 45 }}>
      <color attach="background" args={['#0B2545']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <Environment preset="city" />

      {content.kind === 'default' && (
        <>
          <Airfoil />
          <FlowParticles />
        </>
      )}
      {content.kind === 'naca' && (
        <>
          <Airfoil code={content.code} />
          <FlowParticles />
        </>
      )}
      {content.kind === 'stl' && <ModelViewer geometry={content.geometry} />}

      <OrbitControls enableDamping />
    </Canvas>
  );
}
