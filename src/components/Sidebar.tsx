/**
 * FOIL.CFD - Sidebar Component with Integrated Scientific Tools.
 */
import { useState } from 'react';
import { DevicePanel, type DevicePick, type DetectedDevice } from './DevicePanel';
import { ModelUploader } from './ModelUploader';
import type { SceneContent } from '../data/scene';

interface Props {
  open: boolean;
  onClose: () => void;
  devicePick: DevicePick;
  detectedDevice: DetectedDevice;
  onDeviceChange: (d: DevicePick) => void;
  sceneContent: SceneContent;
  onSceneChange: (c: SceneContent) => void;
  flow: boolean;
  onFlowChange: (v: boolean) => void;
  speed: number;
  onSpeedChange: (s: number) => void;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  onRotationChange: (axis: 'x' | 'y' | 'z', v: number) => void;
  onRotationReset: () => void;
  cadStatus: 'probing' | 'online' | 'offline';
  cadUrl: string;
  onCadRetry: () => void;
  backendOnline: boolean;
  selectedField: string;
  onFieldChange: (field: string) => void;
}

export function Sidebar({
  open, onClose,
  devicePick, detectedDevice, onDeviceChange,
  sceneContent, onSceneChange,
  flow, onFlowChange,
  speed, onSpeedChange,
  rotationX, rotationY, rotationZ, onRotationChange, onRotationReset,
  cadStatus, cadUrl, onCadRetry,
  backendOnline, selectedField, onFieldChange,
}: Props) {
  const [solving, setSolving] = useState(false);
  const [solveMsg, setSolveMsg] = useState('');

  const runSolver = async () => {
    setSolving(true);
    setSolveMsg('Running OpenFOAM solver...');
    try {
      const port = window.location.port === '5173' || window.location.port === '4173' ? '8002' : window.location.port || '8002';
      const res = await fetch(`http://127.0.0.1:${port}/api/solve`, { method: 'POST' });
      const data = await res.json();
      setSolveMsg(data.message || 'Solver completed.');
    } catch (err) {
      setSolveMsg('Solver failed (backend unreachable).');
    } finally {
      setSolving(false);
    }
  };

  return (
    <aside className={`app-sidebar ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="sidebar-head">
        <span className="sidebar-brand">
          FOIL<span>.CFD</span>
        </span>
        <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close sidebar">×</button>
      </div>

      <DevicePanel pick={devicePick} detected={detectedDevice} onChange={onDeviceChange} />

      <ModelUploader content={sceneContent} onChange={onSceneChange} flow={flow} onFlowChange={onFlowChange} />

      <div className="sidebar-section">
        <div className="sidebar-section-label">Scientific Lab & Solver</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={runSolver}
            disabled={solving || !backendOnline}
            className="upload-btn"
            style={{ background: backendOnline ? '#5BC0EB' : '#38536E', color: '#0B2545', fontWeight: 600 }}
          >
            {solving ? 'Running Solver...' : 'Run OpenFOAM & PyVista ↗'} 
          </button>
          {solveMsg && <span style={{ fontSize: '0.7rem', color: '#A6D9F0' }}>{solveMsg}</span>}
          <label style={{ fontSize: '0.75rem', color: '#7FB6D4', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
            VTK Field:
            <select
              value={selectedField}
              onChange={(e) => onFieldChange(e.target.value)}
              style={{ background: '#0B2545', color: '#FFF', border: '1px solid #38536E', padding: '0.2rem', fontSize: '0.75rem' }}
            >
              <option value="U">Velocity (U)</option>
              <option value="p">Pressure (p)</option>
              <option value="T">Temperature (T)</option>
              <option value="vorticity">Vorticity</option>
            </select>
          </label>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">
          Object rotation
          <button type="button" className="sidebar-reset" onClick={onRotationReset}>Reset</button>
        </div>
        <div className="rot-slider">
          <label>Pitch (Z)</label>
          <input type="range" min={-180} max={180} step={1} value={rotationZ} onChange={(e) => onRotationChange('z', Number(e.target.value))} /> 
          <span>{rotationZ.toFixed(0)}°</span>
        </div>
        <div className="rot-slider">
          <label>Yaw (Y)</label>
          <input type="range" min={-180} max={180} step={1} value={rotationY} onChange={(e) => onRotationChange('y', Number(e.target.value))} /> 
          <span>{rotationY.toFixed(0)}°</span>
        </div>
        <div className="rot-slider">
          <label>Roll (X)</label>
          <input type="range" min={-180} max={180} step={1} value={rotationX} onChange={(e) => onRotationChange('x', Number(e.target.value))} /> 
          <span>{rotationX.toFixed(0)}°</span>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">CAD editor</div>
        {cadStatus === 'online' ? (
          <a href={cadUrl} target="_blank" rel="noreferrer" className="cad-link">
            Open SketchForge-3D ↗
          </a>
        ) : (
          <span className="cad-status">Not running. Start with <code>docker compose up -d</code>.</span>
        )}
      </div>

      <nav className="sidebar-nav">
        <a href="#top" onClick={onClose}>Overview</a>
        <a href="#readme" onClick={onClose}>README</a>
        <a href="#projects" onClick={onClose}>Projects</a>
      </nav>
    </aside>
  );
}
