import { useState } from 'react';
import { DevicePanel, type DevicePick, type DetectedDevice } from './DevicePanel';
import { ModelUploader } from './ModelUploader';
import type { SceneContent } from '../data/scene';
import { fmtProbe, type ProbeSample } from '../lib/probe';
import type { BackendStatus } from '../hooks/useBackendProbe';

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
  backendStatus: BackendStatus;
  backendUrl: string;
  solverAvailable: boolean;
  onBackendRetry: () => void;
  cfdJobId: string | null;
  cfdJobStatus: string;
  cfdJobStep: string;
  cfdElapsed: number;
  cfdConnectionLost: boolean;
  cfdError: string | null;
  onCfdSolve: () => void;
  onCfdCancel: () => void;
  onCfdRetry: () => void;
  onCfdRetryPoll: () => void;
  lastProbe: ProbeSample | null;
  onFocusProbe: () => void;
}

const STEPS = ['Meshing', 'Solving', 'Post-processing'] as const;

export function Sidebar({
  open, onClose,
  devicePick, detectedDevice, onDeviceChange,
  sceneContent, onSceneChange,
  flow, onFlowChange,
  speed, onSpeedChange,
  rotationX, rotationY, rotationZ, onRotationChange, onRotationReset,
  cadStatus, cadUrl, onCadRetry,
  backendUrl, solverAvailable, onBackendRetry,
  cfdJobId, cfdJobStatus, cfdJobStep, cfdElapsed, cfdConnectionLost, cfdError,
  onCfdSolve, onCfdCancel, onCfdRetry, onCfdRetryPoll,
  lastProbe, onFocusProbe,
}: Props) {
  const [copied, setCopied] = useState(false);
  const solving = cfdJobStatus === 'running' || cfdJobStatus === 'submitting' || cfdJobStatus === 'queued';
  // backendUrl is only set when the probe actually got a 200 from /api/health.
  // Use it as the single source of truth instead of backendMode, which can drift.
  const backendOnline = !!backendUrl;
  const terminal = cfdJobStatus === 'completed' || cfdJobStatus === 'failed' || cfdJobStatus === 'cancelled';
  const activeStep =
    cfdJobStatus === 'submitting' || cfdJobStatus === 'queued'
      ? 0
      : cfdJobStatus === 'running'
      ? 1
      : cfdJobStatus === 'completed'
      ? 2
      : -1;

  const copyJobId = async () => {
    if (!cfdJobId) return;
    try {
      await navigator.clipboard.writeText(cfdJobId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside id="app-sidebar" className={`app-sidebar ${open ? 'open' : ''}`} aria-hidden={!open} inert={!open}>
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
          <span className="sidebar-section-hint">{backendOnline ? 'live' : 'static'}</span>
        </div>

        {backendOnline ? (
          <>
            <button
              type="button"
              onClick={onCfdSolve}
              disabled={solving}
              className="upload-btn upload-btn-full solve-btn"
              title={solverAvailable ? 'Run a live simpleFoam solve on the bundled 2D channel case' : 'Render a synthetic field preview; no CFD solver is run'}
            >
              {solving
                ? (cfdJobStatus === 'submitting' ? 'Submitting…' : `Solving… ${cfdElapsed}s`)
                : solverAvailable
                ? 'Run live solve'
                : 'Preview field'}
            </button>
            <p className="solve-note">
              {solverAvailable
                ? 'Bundled 2D channel case · simpleFoam · about 30 seconds'
                : 'Synthetic field preview · no CFD solver runs'}
            </p>

            {cfdJobId && cfdJobStatus !== 'idle' && (
              <div className="cfd-solve-status" aria-live="polite">
                <ol className="cfd-steps">
                  {STEPS.map((label, i) => (
                    <li
                      key={label}
                      className={i === activeStep ? 'active' : i < activeStep ? 'done' : ''}
                      aria-current={i === activeStep ? 'step' : undefined}
                    >
                      {label}
                    </li>
                  ))}
                </ol>
                <div className="cfd-sidebar-status">
                  <span className={`cfd-status-dot cfd-status-${cfdJobStatus}`} />
                  <span>
                    Job <code>{cfdJobId.slice(0, 8)}</code>
                    {cfdJobStep ? ` · ${cfdJobStep}` : ''}
                    {solving ? ` · ${cfdElapsed}s` : ''}
                  </span>
                  <button type="button" className="upload-reset" onClick={copyJobId}>
                    {copied ? 'Copied' : 'Copy ID'}
                  </button>
                </div>
              </div>
            )}

            {solving && (
              <button type="button" className="upload-reset" onClick={onCfdCancel}>
                Cancel (best effort)
              </button>
            )}

            {cfdConnectionLost && !terminal && (
              <div className="upload-error">
                Connection lost to the local solver. The job may still be running.
                <button type="button" className="upload-reset" onClick={onCfdRetryPoll}>Reconnect</button>
              </div>
            )}

            {cfdError && (
              <div className="upload-error">
                {cfdError}
                {cfdJobId ? ` · job ${cfdJobId.slice(0, 8)}` : ''}
              </div>
            )}

            {(cfdJobStatus === 'failed' || cfdJobStatus === 'cancelled') && (
              <button type="button" className="upload-btn upload-btn-full" onClick={onCfdRetry}>
                Run again
              </button>
            )}
          </>
        ) : (
          <div className="flow-approx">
            Static demo · sample wing. Connect a local solver to run a live solve.
            <button type="button" onClick={onBackendRetry} className="upload-reset">
              Connect local backend
            </button>
            <details className="self-host">
              <summary>Self-host the solver</summary>
              <p>
                On the machine with the solver, run{' '}
                <code>docker compose up --build -d</code>, then connect again. The
                browser may ask for local network access.
              </p>
            </details>
          </div>
        )}

        <a href="#cfd" className="cfd-sidebar-jump" onClick={onClose}>
          Jump to 3D lab ↓
        </a>

        {lastProbe ? (
          <button
            type="button"
            className="cfd-sidebar-probe cfd-sidebar-probe-btn"
            onClick={() => { onFocusProbe(); onClose(); }}
            title="Re-center the 3D camera on this sample"
          >
            <span className="cfd-sidebar-probe-label">Last probe · re-center</span>
            p {fmtProbe(lastProbe.p)} · |U| {fmtProbe(lastProbe.u)} · T {fmtProbe(lastProbe.t)}
          </button>
        ) : (
          <div className="cfd-sidebar-probe" aria-live="polite">
            <span className="cfd-sidebar-probe-muted">No probe yet · use the probe station or click the 3D surface</span>
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
            <span className="cad-status">Local CAD editor not detected.</span>
            <button type="button" className="upload-btn" onClick={onCadRetry}>Retry</button>
            <details className="self-host">
              <summary>Self-host the editor</summary>
              <p>
                Start the editor container with <code>docker compose up -d</code>.
              </p>
            </details>
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
