import { useState, useEffect } from 'react';
import { NavBar } from './components/NavBar';
import { Sidebar } from './components/Sidebar';
import { BackendBadge } from './components/BackendBadge';
import { type DevicePick, type DetectedDevice } from './components/DevicePanel';
import { Hero } from './sections/Hero';
import { ReadmeSection } from './sections/ReadmeSection';
import { ProjectShowcase } from './sections/ProjectShowcase';
import { useBackendProbe } from './hooks/useBackendProbe';
import { useSketchForgeProbe } from './hooks/useSketchForgeProbe';
import type { SceneContent, FlowDirection } from './data/scene';

function detectDevice(): DetectedDevice {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 600) return 'phone';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export default function App() {
  const backend = useBackendProbe();
  const cad = useSketchForgeProbe();

  const [devicePick, setDevicePick] = useState<DevicePick>('auto');
  const [detectedDevice, setDetectedDevice] = useState<DetectedDevice>(detectDevice);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sceneContent, setSceneContent] = useState<SceneContent>({
    kind: 'default',
    token: 0,
  });
  const [flow, setFlow] = useState(true);
  const [direction, setDirection] = useState<FlowDirection>('+x');
  const [speed, setSpeed] = useState(2.0);

  const effectiveDevice: DetectedDevice =
    devicePick === 'auto' ? detectedDevice : devicePick;

  useEffect(() => {
    const update = () => setDetectedDevice(detectDevice());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-device', effectiveDevice);
    document.documentElement.setAttribute(
      'data-sidebar',
      sidebarOpen ? 'open' : 'closed'
    );
  }, [effectiveDevice, sidebarOpen]);

  useEffect(() => {
    // +Z / -Z flow only makes sense for 3D models.
    if (sceneContent.kind !== 'model' && (direction === '+z' || direction === '-z')) {
      setDirection('+x');
    }
  }, [sceneContent.kind, direction]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-shell">
      <div className={`app-frame device-${effectiveDevice}`}>
        <NavBar
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
        />
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          devicePick={devicePick}
          detectedDevice={detectedDevice}
          onDeviceChange={setDevicePick}
          sceneContent={sceneContent}
          onSceneChange={setSceneContent}
          flow={flow}
          onFlowChange={setFlow}
          direction={direction}
          onDirectionChange={setDirection}
          speed={speed}
          onSpeedChange={setSpeed}
          cadStatus={cad.status}
          cadUrl={cad.url}
          onCadRetry={cad.probe}
        />
        {sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}
        <main className="app-main">
          <div className="backend-badge-wrapper">
            <BackendBadge
              status={backend.status}
              reason={backend.reason}
              onRetry={backend.probe}
            />
          </div>
          <Hero
            content={sceneContent}
            flow={flow}
            direction={direction}
            speed={speed}
          />
          <ReadmeSection />
          <ProjectShowcase />
          <footer className="footer">
            <span className="footer-brand">
              FOIL<span className="footer-brand-dot">.CFD</span>
            </span>
            ·{' '}
            <a
              href="https://github.com/swipswaps/foil-cfd-site"
              target="_blank"
              rel="noreferrer"
              className="footer-link"
            >
              GitHub
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
