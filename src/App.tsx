import { FoilScene } from './components/FoilScene';
import { BackendBadge } from './components/BackendBadge';
import { ToolsPanel } from './components/ToolsPanel';
import { useBackendProbe } from './hooks/useBackendProbe';

export default function App() {
  const backend = useBackendProbe();

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
      }}
    >
      <FoilScene />
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}foil-logo.svg`}
          alt="FOIL.CFD"
          style={{ width: 260, height: 'auto' }}
        />
        <BackendBadge
          status={backend.status}
          reason={backend.reason}
          onRetry={backend.probe}
        />
        <ToolsPanel online={backend.status === 'online'} />
      </div>
    </div>
  );
}
