import { useState, useEffect, lazy, Suspense } from 'react';
import { NavBar } from './components/NavBar';
import { Sidebar } from './components/Sidebar';
import { BackendBadge } from './components/BackendBadge';
import { type DevicePick, type DetectedDevice } from './components/DevicePanel';
import { Hero } from './sections/Hero';
import { ReadmeSection } from './sections/ReadmeSection';
import { ProjectShowcase } from './sections/ProjectShowcase';
import { useBackendProbe } from './hooks/useBackendProbe';
import { useSketchForgeProbe } from './hooks/useSketchForgeProbe';
import type { SceneContent } from './data/scene';

const CfdLab = lazy(() =>
  import('./sections/CfdLab').then((m) => ({ default: m.CfdLab }))
);

function detectDevice(): DetectedDevice {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 600) return 'phone';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function CfdLabSkeleton() {
  return (
    <section className="cfd-lab">
      <header className="cfd-lab-head">
        <h2>CFD Laboratory</h2>
        <div className="cfd-lab-status"><span>Loading scientific viewer…</span></div>
      </header>
      <div className="cfd-lab-grid">
        <div className="cfd-vtk-skeleton" />
        <div className="cfd-vtk-skeleton" />
      </div>
    </section>
  );
}

export default function App() {
  const backend = useBackendProbe();
  const cad = useSketchForgeProbe();

  const [devicePick, setDevicePick] = useState<DevicePick>(() => detectDevice());
  const [detectedDevice, setDetectedDevice] = useState<DetectedDevice>(detectDevice);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sceneContent, setSceneContent] = useState<SceneContent>({ kind: 'default', token: 0 });
  const [flow, setFlow] = useState(true);
  const [speed, setSpeed] = useState(2.0);
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);

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
    document.documentElement.setAttribute('data-sidebar', sidebarOpen ? 'open' : 'closed');
  }, [effectiveDevice, sidebarOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleRotation = (axis: 'x' | 'y' | 'z', v: number) => {
    if (axis === 'x') setRotationX(v);
    else if (axis === 'y') setRotationY(v);
    else setRotationZ(v);
  };
  const resetRotation = () => { setRotationX(0); setRotationY(0); setRotationZ(0); };

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
          speed={speed}
          onSpeedChange={setSpeed}
          rotationX={rotationX}
          rotationY={rotationY}
          rotationZ={rotationZ}
          onRotationChange={handleRotation}
          onRotationReset={resetRotation}
          cadStatus={cad.status}
          cadUrl={cad.url}
          onCadRetry={cad.probe}
        />
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
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
            speed={speed}
            rotationX={rotationX}
            rotationY={rotationY}
            rotationZ={rotationZ}
          />
          {backend.mode === 'cfd' && (
            <Suspense fallback={<CfdLabSkeleton />}>
              <CfdLab
                backendUrl={backend.backendOrigin}
                solverAvailable={backend.solverAvailable}
              />
            </Suspense>
          )}
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
