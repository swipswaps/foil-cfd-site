import { DevicePanel, type DevicePick, type DetectedDevice } from './DevicePanel';
import { ModelUploader } from './ModelUploader';
import type { SceneContent } from '../data/scene';
import type { CfdField } from '../App';

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
  backendMode: 'static' | 'cfd';
  backendUrl: string;
  solverAvailable: boolean;
  onBackendRetry: () => void;
  cfdField: CfdField;
  onCfdFieldChange: (f: CfdField) => void;
  cfdJobId: string | null;
  cfdJobStatus: string;
  cfdError: string | null;
  onCfdSolve: () => void;
}

export function Sidebar({
  open, onClose,
  devicePick, detectedDevice, onDeviceChange,
  sceneContent, onSceneChange,
  flow, onFlowChange,
  speed, onSpeedChange,
  rotationX, rotationY, rotationZ, onRotationChange, onRotationReset,
  cadStatus, cadUrl, onCadRetry,
  backendUrl, solverAvailable, onBackendRetry,
  cfdField, onCfdFieldChange,
  cfdJobId, cfdJobStatus, cfdError, onCfdSolve,
}: Props) {
  const solving = cfdJobStatus === 'running' || cfdJobStatus === 'submitting';
  const portLabel = backendUrl ? backendUrl.replace(/^https?:\/\//, '') : 'offline';
  // backendUrl is only set when the probe actually got a 200 from /api/health.
  // Use it as the single source of truth instead of backendMode, which can drift.
  const backendOnline = !!backendUrl;

  return (
    <aside className={`app-sidebar ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="sidebar-head">
        <span className="sidebar-brand">
          FOIL<span>.CFD</span>
        </span>
        <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close sidebar">
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
          <button type="button" className="sidebar-reset" onClick={onRotationReset}>Reset</button>
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
        <div className="sidebar-section-label">
          Scientific tools
          <span className="sidebar-section-hint">{portLabel}</span>
        </div>

        {backendOnline ? (
          <>
            <div className="cfd-sidebar-row">
              <label className="cfd-sidebar-label">Field</label>
              <select
                value={cfdField}
                onChange={(e) => onCfdFieldChange(e.target.value as CfdField)}
                className="upload-select"
              >
                <option value="p">Pressure (p)</option>
                <option value="U">Velocity (U)</option>
                <option value="T">Temperature (T)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={onCfdSolve}
              disabled={solving}
              className="upload-btn upload-btn-full"
              title={solverAvailable ? 'Run simpleFoam on NACA0012 case' : 'Generate a synthetic NACA0012 preview; no CFD solver is run'}
            >
              {solving
                ? (cfdJobStatus === 'submitting' ? 'Submitting…' : 'Solving…')
                : solverAvailable
                ? 'Run simpleFoam'
                : 'Generate synthetic preview'}
            </button>

            {cfdJobId && cfdJobStatus !== 'idle' && (
              <div className="cfd-sidebar-status">
                <span className={`cfd-status-dot cfd-status-${cfdJobStatus}`} />
                Job {cfdJobId.slice(0, 8)} · {cfdJobStatus}
              </div>
            )}

            {cfdError && <div className="upload-error">{cfdError}</div>}

            <a href="#cfd" className="cfd-sidebar-jump" onClick={onClose}>
              Jump to 3D lab ↓
            </a>
          </>
        ) : (
          <div className="flow-approx">
            Backend offline. Start with <code>docker compose up --build -d</code>.
            <button
              type="button"
              onClick={onBackendRetry}
              className="upload-reset"
              style={{ marginLeft: '0.5rem' }}
            >
              Retry
            </button>
          </div>
        )}
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
        <a href="#cfd" onClick={onClose}>CFD Lab</a>
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
