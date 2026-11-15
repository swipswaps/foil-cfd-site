import type * as THREE from 'three';

export interface FlowSphere {
  center: THREE.Vector3;
  radius: number;
}

export type FlowDirection = 'free' | '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

export type SceneContent =
  | { kind: 'default'; token: number }
  | { kind: 'naca'; code: string; token: number }
  | {
      kind: 'model';
      object: THREE.Object3D;
      filename: string;
      filesize: number;
      sphere: FlowSphere;
      token: number;
    };
