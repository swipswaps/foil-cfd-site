import type * as THREE from 'three';

export type SceneContent =
  | { kind: 'default' }
  | { kind: 'naca'; code: string }
  | { kind: 'stl'; geometry: THREE.BufferGeometry; filename: string };
