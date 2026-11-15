import * as THREE from 'three';

interface Props {
  geometry: THREE.BufferGeometry;
}

export function ModelViewer({ geometry }: Props) {
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#00A8E8"
        metalness={0.55}
        roughness={0.35}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
