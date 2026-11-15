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
    <div className="app-shell">
      <NavBar />

      <aside className="grid-sidebar" aria-label="Section navigation">
        <a href="#top" className="grid-sidebar-brand">
          FOIL<span>.CFD</span>
        </a>
        <nav className="grid-sidebar-nav">
          <a href="#top">Overview</a>
          <a href="#readme">README</a>
          <a href="#projects">Projects</a>
        </nav>
        <div className="grid-sidebar-foot">
          <span>Static mode</span>
          <a
            href="https://github.com/swipswaps/foil-cfd-site"
            target="_blank"
            rel="noreferrer"
          >
            GitHub ↗
          </a>
        </div>
      </aside>

      <main className="main-content">
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

      <TemplateToggle />
    </div>
  );
}
