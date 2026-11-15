import { useState, useEffect } from 'react';
import { NavBar } from './components/NavBar';
import { Sidebar } from './components/Sidebar';
import { BackendBadge } from './components/BackendBadge';
import { type DevicePick, type DetectedDevice } from './components/DevicePanel';
import { Hero } from './sections/Hero';
import { ReadmeSection } from './sections/ReadmeSection';
import { ProjectShowcase } from './sections/ProjectShowcase';
import { useBackendProbe } from './hooks/useBackendProbe';
import type { SceneContent } from './data/scene';

function detectDevice(): DetectedDevice {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 600) return 'phone';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export default function App() {
  const backend = useBackendProbe();
  const [devicePick, setDevicePick] = useState<DevicePick>('auto');
  const [detectedDevice, setDetectedDevice] = useState<DetectedDevice>(detectDevice);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sceneContent, setSceneContent] = useState<SceneContent>({ kind: 'default' });

  const effectiveDevice: DetectedDevice =
    devicePick === 'auto' ? detectedDevice : devicePick;

  // Continuous auto-detect: updates on resize and orientationchange.
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

  // Reflect effective device on <html> so CSS media queries can rely on it.
  useEffect(() => {
    document.documentElement.setAttribute('data-device', effectiveDevice);
    document.documentElement.setAttribute(
      'data-sidebar',
      sidebarOpen ? 'open' : 'closed'
    );
  }, [effectiveDevice, sidebarOpen]);

  // Escape closes sidebar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Dispose previous STL geometry when content is replaced or app unmounts.
  useEffect(() => {
    return () => {
      if (sceneContent.kind === 'stl') {
        sceneContent.geometry.dispose();
      }
    };
  }, [sceneContent]);

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
          <Hero content={sceneContent} />
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
