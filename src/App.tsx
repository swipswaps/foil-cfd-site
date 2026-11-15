import { useState, useEffect } from 'react';
import { NavBar } from './components/NavBar';
import { Sidebar } from './components/Sidebar';
import { BackendBadge } from './components/BackendBadge';
import { DeviceControls, type Device } from './components/DeviceControls';
import { Hero } from './sections/Hero';
import { ReadmeSection } from './sections/ReadmeSection';
import { ProjectShowcase } from './sections/ProjectShowcase';
import { useBackendProbe } from './hooks/useBackendProbe';

function detectDevice(): Device {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 600) return 'phone';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

export default function App() {
  const backend = useBackendProbe();
  const [device, setDevice] = useState<Device>(detectDevice);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-device', device);
    document.documentElement.setAttribute('data-sidebar', sidebarOpen ? 'open' : 'closed');
  }, [device, sidebarOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app-shell">
      <div className={`app-frame device-${device}`}>
        <NavBar
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
        />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
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
          <Hero />
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
      <DeviceControls device={device} onDeviceChange={setDevice} />
    </div>
  );
}
