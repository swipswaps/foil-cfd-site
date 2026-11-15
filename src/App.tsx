import { NavBar } from './components/NavBar';
import { BackendBadge } from './components/BackendBadge';
import { Hero } from './sections/Hero';
import { ReadmeSection } from './sections/ReadmeSection';
import { ProjectShowcase } from './sections/ProjectShowcase';
import { TemplateToggle } from './sections/TemplateToggle';
import { useBackendProbe } from './hooks/useBackendProbe';

export default function App() {
  const backend = useBackendProbe();

  return (
    <div style={{ background: '#06121A', minHeight: '100vh' }}>
      <NavBar />

      <div style={{ position: 'fixed', top: 68, right: 20, zIndex: 40 }}>
        <BackendBadge
          status={backend.status}
          reason={backend.reason}
          onRetry={backend.probe}
        />
      </div>

      <Hero />
      <ReadmeSection />
      <ProjectShowcase />

      <footer
        style={{
          borderTop: '1px solid #1E3A4A',
          padding: '2rem 1.5rem',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: '#5E8FA8',
        }}
      >
        <span style={{ marginRight: '0.5rem' }}>
          FOIL<span style={{ color: '#5BC0EB' }}>.CFD</span>
        </span>
        ·{' '}
        <a
          href="https://github.com/swipswaps/foil-cfd-site"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'inherit', textDecoration: 'underline' }}
        >
          GitHub
        </a>
      </footer>

      <TemplateToggle />
    </div>
  );
}
