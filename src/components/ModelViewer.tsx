import type * as THREE from 'three';

export function ModelViewer({ object }: { object: THREE.Object3D }) {
  return <primitive object={object} />;
}
