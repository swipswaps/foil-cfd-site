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
}

export function Sidebar({
  open, onClose,
  devicePick, detectedDevice, onDeviceChange,
  sceneContent, onSceneChange,
  flow, onFlowChange,
  speed, onSpeedChange,
  rotationX, rotationY, rotationZ, onRotationChange, onRotationReset,
  cadStatus, cadUrl, onCadRetry,
}: Props) {
  return (
    <aside className={`app-sidebar ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="sidebar-head">
        <span className="sidebar-brand">
          FOIL<span>.CFD</span>
        </span>
        <button
          type="button"
          className="sidebar-close"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          ×
        </button>
      </div>

      <DevicePanel pick={devicePick} detected={detectedDevice} onChange={onDeviceChange} />

      <ModelUploader
        content={sceneContent}
        onChange={onSceneChange}
        flow={flow}
        onFlowChange={onFlowChange}
      />

      <div className="sidebar-section">
        <div className="sidebar-section-label">
          Object rotation
          <button type="button" className="sidebar-reset" onClick={onRotationReset}>
            Reset
          </button>
        </div>
        <div className="rot-slider">
          <label>Pitch (Z)</label>
          <input type="range" min={-180} max={180} step={1} value={rotationZ}
            onChange={(e) => onRotationChange('z', Number(e.target.value))} />
          <span>{rotationZ.toFixed(0)}°</span>
        </div>
        <div className="rot-slider">
          <label>Yaw (Y)</label>
          <input type="range" min={-180} max={180} step={1} value={rotationY}
            onChange={(e) => onRotationChange('y', Number(e.target.value))} />
          <span>{rotationY.toFixed(0)}°</span>
        </div>
        <div className="rot-slider">
          <label>Roll (X)</label>
          <input type="range" min={-180} max={180} step={1} value={rotationX}
            onChange={(e) => onRotationChange('x', Number(e.target.value))} />
          <span>{rotationX.toFixed(0)}°</span>
        </div>
        <div className="speed-row">
          <label htmlFor="flow-speed">Speed</label>
          <input id="flow-speed" type="range" min={0.5} max={5} step={0.1}
            value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))} />
          <span className="speed-value">{speed.toFixed(1)}×</span>
        </div>
        <div className="flow-approx">
          Potential-flow visualization. Rotate the object to change
          its angle to the wind. For real CFD, use the CAD editor.
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">CAD editor</div>
        {cadStatus === 'online' ? (
          <a href={cadUrl} target="_blank" rel="noreferrer" className="cad-link">
            Open SketchForge-3D ↗
            <span className="cad-link-hint">import STL · booleans · export STL/OBJ/STEP</span>
          </a>
        ) : cadStatus === 'probing' ? (
          <span className="cad-status">Checking local editor…</span>
        ) : (
          <div className="cad-offline">
            <span className="cad-status">
              Not running. Start with <code>docker compose up -d</code>.
            </span>
            <button type="button" className="upload-btn" onClick={onCadRetry}>Retry</button>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        <a href="#top" onClick={onClose}>Overview</a>
        <a href="#readme" onClick={onClose}>README</a>
        <a href="#projects" onClick={onClose}>Projects</a>
      </nav>

      <div className="sidebar-foot">
        <a href="https://github.com/swipswaps/foil-cfd-site" target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      </div>
    </aside>
  );
}
