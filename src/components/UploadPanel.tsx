import { useState, useRef } from 'react';
import * as THREE from 'three';
import type { SceneContent } from '../data/scene';

interface Props {
  content: SceneContent;
  onChange: (c: SceneContent) => void;
}

export function UploadPanel({ content, onChange }: Props) {
  const [nacaCode, setNacaCode] = useState('4415');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const applyNaca = () => {
    const code = nacaCode.trim();
    if (!/^\d{4}$/.test(code)) {
      setError('NACA code must be 4 digits (e.g. 4415)');
      return;
    }
    setError(null);
    onChange({ kind: 'naca', code });
  };

  const loadStl = async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      if (file.size > 15 * 1024 * 1024) {
        throw new Error('File too large (max 15 MB)');
      }
      const buffer = await file.arrayBuffer();
      const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
      const loader = new STLLoader();
      const geom: THREE.BufferGeometry = loader.parse(buffer);

      geom.computeBoundingBox();
      const box = geom.boundingBox;
      if (!box) throw new Error('Could not compute STL bounds');

      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 2.5 / maxDim;
      geom.center();
      geom.scale(scale, scale, scale);
      geom.computeVertexNormals();

      onChange({ kind: 'stl', geometry: geom, filename: file.name });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load STL';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-label">Load model</div>

      <div className="upload-block">
        <label className="upload-label">NACA 4-digit</label>
        <div className="upload-row">
          <input
            type="text"
            value={nacaCode}
            onChange={(e) => setNacaCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') applyNaca(); }}
            maxLength={4}
            placeholder="4415"
            className="upload-input"
            aria-label="NACA 4-digit code"
          />
          <button type="button" onClick={applyNaca} className="upload-btn">
            Apply
          </button>
        </div>
      </div>

      <div className="upload-block">
        <label className="upload-label">3D model (.stl)</label>
        <input
          ref={fileRef}
          type="file"
          accept=".stl,model/stl,application/sla"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadStl(f);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="upload-btn upload-btn-full"
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Choose STL file'}
        </button>
      </div>

      <div className="upload-status">
        {content.kind === 'default' && (
          <span>Showing: default NACA 16-series</span>
        )}
        {content.kind === 'naca' && (
          <>
            <span>Showing: NACA {content.code}</span>
            <button
              type="button"
              onClick={() => onChange({ kind: 'default' })}
              className="upload-reset"
            >
              Reset
            </button>
          </>
        )}
        {content.kind === 'stl' && (
          <>
            <span title={content.filename}>
              Showing: {content.filename}
            </span>
            <button
              type="button"
              onClick={() => onChange({ kind: 'default' })}
              className="upload-reset"
            >
              Reset
            </button>
          </>
        )}
      </div>

      {error && <div className="upload-error">{error}</div>}
    </div>
  );
}
