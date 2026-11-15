import { DevicePanel, type DevicePick, type DetectedDevice } from './DevicePanel';
import { UploadPanel } from './UploadPanel';
import type { SceneContent } from '../data/scene';

interface Props {
  open: boolean;
  onClose: () => void;
  devicePick: DevicePick;
  detectedDevice: DetectedDevice;
  onDeviceChange: (d: DevicePick) => void;
  sceneContent: SceneContent;
  onSceneChange: (c: SceneContent) => void;
}

export function Sidebar({
  open,
  onClose,
  devicePick,
  detectedDevice,
  onDeviceChange,
  sceneContent,
  onSceneChange,
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

      <DevicePanel
        pick={devicePick}
        detected={detectedDevice}
        onChange={onDeviceChange}
      />

      <UploadPanel content={sceneContent} onChange={onSceneChange} />

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
