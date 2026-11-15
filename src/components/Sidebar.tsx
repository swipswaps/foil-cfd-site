import { DevicePanel, type DevicePick, type DetectedDevice } from './DevicePanel';
import { ModelUploader } from './ModelUploader';
import type { SceneContent, FlowDirection } from '../data/scene';

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
  direction: FlowDirection;
  onDirectionChange: (d: FlowDirection) => void;
  speed: number;
  onSpeedChange: (s: number) => void;
  cadStatus: 'probing' | 'online' | 'offline';
  cadUrl: string;
  onCadRetry: () => void;
}

const BASE_DIRS: { id: FlowDirection; label: string; modelOnly?: boolean }[] = [
  { id: 'free', label: 'Free' },
  { id: '+x', label: '+X' },
  { id: '-x', label: '−X' },
  { id: '+y', label: '+Y' },
  { id: '-y', label: '−Y' },
  { id: '+z', label: '+Z', modelOnly: true },
  { id: '-z', label: '−Z', modelOnly: true },
];

export function Sidebar({
  open,
  onClose,
  devicePick,
  detectedDevice,
  onDeviceChange,
  sceneContent,
  onSceneChange,
  flow,
  onFlowChange,
  direction,
  onDirectionChange,
  speed,
  onSpeedChange,
  cadStatus,
  cadUrl,
  onCadRetry,
}: Props) {
  const isModel = sceneContent.kind === 'model';
  const dirs = BASE_DIRS.filter((d) => !d.modelOnly || isModel);

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

      <DevicePanel
        pick={devicePick}
        detected={detectedDevice}
        onChange={onDeviceChange}
      />

      <ModelUploader
        content={sceneContent}
        onChange={onSceneChange}
        flow={flow}
        onFlowChange={onFlowChange}
      />

      <div className="sidebar-section">
        <div className="sidebar-section-label">Flow direction</div>
        <div className="direction-grid">
          {dirs.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onDirectionChange(d.id)}
              className={direction === d.id ? 'active' : ''}
              aria-pressed={direction === d.id}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="speed-row">
          <label htmlFor="flow-speed">Speed</label>
          <input
            id="flow-speed"
            type="range"
            min={0.5}
            max={5}
            step={0.1}
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
          />
          <span className="speed-value">{speed.toFixed(1)}×</span>
        </div>
        <div className="flow-approx">
          Approximate visualization.
          {isModel
            ? ' Potential flow around the model\u2019s bounding sphere.'
            : ' Chord-aligned heuristic.'}
          {' '}For real CFD, use the CAD editor below.
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">CAD editor</div>
        {cadStatus === 'online' ? (
          <a href={cadUrl} target="_blank" rel="noreferrer" className="cad-link">
            Open SketchForge-3D ↗
            <span className="cad-link-hint">
              import STL · booleans · export STL/OBJ/STEP
            </span>
          </a>
        ) : cadStatus === 'probing' ? (
          <span className="cad-status">Checking local editor…</span>
        ) : (
          <div className="cad-offline">
            <span className="cad-status">
              Not running. Start with <code>docker compose up -d</code>.
            </span>
            <button type="button" className="upload-btn" onClick={onCadRetry}>
              Retry
            </button>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        <a href="#top" onClick={onClose}>Overview</a>
        <a href="#readme" onClick={onClose}>README</a>
        <a href="#projects" onClick={onClose}>Projects</a>
      </nav>

      <div className="sidebar-foot">
        <a
          href="https://github.com/swipswaps/foil-cfd-site"
          target="_blank"
          rel="noreferrer"
        >
          GitHub ↗
        </a>
      </div>
    </aside>
  );
}
