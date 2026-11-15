import { useState, useRef } from 'react';
import * as THREE from 'three';
import { NACA_PRESETS } from '../data/naca';
import type { SceneContent } from '../data/scene';

interface Props {
  content: SceneContent;
  onChange: (c: SceneContent) => void;
  flow: boolean;
  onFlowChange: (v: boolean) => void;
}

type LoaderFactory = () => Promise<new () => {
  load: (
    url: string,
    onLoad: (result: unknown) => void,
    onProgress?: (evt: ProgressEvent) => void,
    onError?: (err: unknown) => void
  ) => void;
}>;

const LOADERS: Record<string, LoaderFactory> = {
  stl: () => import('three/examples/jsm/loaders/STLLoader.js').then((m) => m.STLLoader as never),
  obj: () => import('three/examples/jsm/loaders/OBJLoader.js').then((m) => m.OBJLoader as never),
  gltf: () => import('three/examples/jsm/loaders/GLTFLoader.js').then((m) => m.GLTFLoader as never),
  glb: () => import('three/examples/jsm/loaders/GLTFLoader.js').then((m) => m.GLTFLoader as never),
  ply: () => import('three/examples/jsm/loaders/PLYLoader.js').then((m) => m.PLYLoader as never),
  fbx: () => import('three/examples/jsm/loaders/FBXLoader.js').then((m) => m.FBXLoader as never),
  dae: () => import('three/examples/jsm/loaders/ColladaLoader.js').then((m) => m.ColladaLoader as never),
  '3mf': () => import('three/examples/jsm/loaders/3MFLoader.js').then((m) => m.ThreeMFLoader as never),
  wrl: () => import('three/examples/jsm/loaders/VRMLLoader.js').then((m) => m.VRMLLoader as never),
};

const ACCEPT_STRING =
  '.stl,.obj,.gltf,.glb,.ply,.fbx,.dae,.3mf,.wrl,' +
  'model/stl,model/gltf-binary,model/gltf+json,application/octet-stream';

const MAX_BYTES = 50 * 1024 * 1024;

function disposeObject(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const c = child as THREE.Mesh;
    if (c.isMesh) {
      c.geometry?.dispose();
      const mat = c.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    }
  });
}

async function loadModelFile(file: File): Promise<{
  object: THREE.Object3D;
  sphere: { center: THREE.Vector3; radius: number };
}> {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const factory = LOADERS[ext];
  if (!factory) {
    throw new Error(
      `.${ext} not supported. Use: ${Object.keys(LOADERS).map((k) => '.' + k).join(', ')}`
    );
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB > 50 MB)`);
  }

  const Loader = await factory();
  const url = URL.createObjectURL(file);

  const result = await new Promise<unknown>((resolve, reject) => {
    try {
      const loader = new Loader();
      loader.load(url, resolve, undefined, reject);
    } catch (e) {
      reject(e);
    }
  });

  URL.revokeObjectURL(url);

  const group = new THREE.Group();
  let added: THREE.Object3D;

  if (result instanceof THREE.BufferGeometry) {
    const geom = result;
    if (!geom.attributes.position) throw new Error('Model has no position data');
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00A8E8,
      metalness: 0.45,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    added = new THREE.Mesh(geom, mat);
  } else if (
    result &&
    typeof result === 'object' &&
    'scene' in (result as Record<string, unknown>)
  ) {
    added = (result as { scene: THREE.Object3D }).scene;
  } else if (result instanceof THREE.Object3D) {
    added = result;
  } else {
    throw new Error('Unexpected loader result');
  }

  group.add(added);

  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty() || !isFinite(box.min.x)) {
    throw new Error('Model bounding box is invalid');
  }

  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2.5 / maxDim;
  group.scale.setScalar(scale);

  group.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  group.position.sub(center);

  group.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(group);
  const sphere = new THREE.Sphere();
  finalBox.getBoundingSphere(sphere);
  const halfExtents = new THREE.Vector3();
  finalBox.getSize(halfExtents);
  halfExtents.multiplyScalar(0.5);

  return {
    object: group,
    sphere: {
      center: sphere.center.clone(),
      radius: Math.max(sphere.radius, 0.4),
      halfExtents: halfExtents.clone(),
    },
  };
}

export function ModelUploader({ content, onChange, flow, onFlowChange }: Props) {
  const [selectedNaca, setSelectedNaca] = useState<string>('custom');
  const [customNaca, setCustomNaca] = useState('4415');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef(1);

  const nextToken = () => ++tokenRef.current;

  const applyNaca = (code?: string) => {
    const c = (code ?? (selectedNaca === 'custom' ? customNaca : selectedNaca)).trim();
    if (!/^\d{4}$/.test(c)) {
      setError('NACA code must be exactly 4 digits (e.g. 4415, 2412, 0012)');
      return;
    }
    setError(null);
    if (content.kind === 'model') disposeObject(content.object);
    onChange({ kind: 'naca', code: c, token: nextToken() });
  };

  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const { object, sphere } = await loadModelFile(file);
      if (content.kind === 'model') disposeObject(content.object);
      onChange({
        kind: 'model',
        object,
        filename: file.name,
        filesize: file.size,
        sphere,
        token: nextToken(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load file';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setError(null);
    if (content.kind === 'model') disposeObject(content.object);
    onChange({ kind: 'default', token: nextToken() });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const statusLabel =
    content.kind === 'default'
      ? 'Default NACA 16-series'
      : content.kind === 'naca'
      ? `NACA ${content.code}`
      : `${content.filename} · ${(content.filesize / 1024 / 1024).toFixed(2)} MB`;

  return (
    <>
      {/* NACA */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">NACA airfoil</div>
        <select
          value={selectedNaca}
          onChange={(e) => {
            setSelectedNaca(e.target.value);
            if (e.target.value !== 'custom') applyNaca(e.target.value);
          }}
          className="upload-select"
        >
          <option value="custom">Custom…</option>
          {NACA_PRESETS.map((p) => (
            <option key={p.code} value={p.code}>{p.label}</option>
          ))}
        </select>
        {selectedNaca === 'custom' && (
          <div className="upload-row">
            <input
              type="text"
              value={customNaca}
              onChange={(e) => setCustomNaca(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') applyNaca(); }}
              maxLength={4}
              placeholder="4415"
              className="upload-input"
              aria-label="NACA 4-digit code"
            />
            <button type="button" onClick={() => applyNaca()} className="upload-btn">
              Apply
            </button>
          </div>
        )}
      </div>

      {/* 3D model */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">3D model</div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_STRING}
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <div
          className={`upload-drop ${dragging ? 'drag' : ''} ${loading ? 'loading' : ''}`}
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); }}
          onDragLeave={(e) => {
            if (e.currentTarget === e.target) setDragging(false);
          }}
          onDrop={onDrop}
          onClick={() => !loading && fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
          }}
        >
          {loading ? (
            <span className="upload-drop-text">Loading…</span>
          ) : (
            <>
              <span className="upload-drop-icon" aria-hidden="true">⬆</span>
              <span className="upload-drop-text">
                Drop file or click
              </span>
              <span className="upload-drop-hint">
                .stl .obj .gltf .glb .ply .fbx .dae .3mf .wrl
              </span>
            </>
          )}
        </div>
      </div>

      {/* Flow toggle */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">
          Airflow overlay
        </div>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={flow}
            onChange={(e) => onFlowChange(e.target.checked)}
          />
          <span className="toggle-label">
            {flow ? 'On — particles animated' : 'Off — model only'}
          </span>
        </label>
      </div>

      {/* Status */}
      <div className="upload-status">
        <span title={statusLabel}>Showing: {statusLabel}</span>
        {content.kind !== 'default' && (
          <button type="button" onClick={reset} className="upload-reset">
            Reset
          </button>
        )}
      </div>

      {error && <div className="upload-error">{error}</div>}
    </>
  );
}
