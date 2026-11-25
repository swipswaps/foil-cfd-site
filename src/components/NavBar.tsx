interface Props {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}

export function NavBar({ onToggleSidebar, sidebarOpen }: Props) {
  return (
    <nav className="nav-bar">
      <div className="nav-left">
        <button
          type="button"
          id="nav-burger"
          className="nav-burger"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
        >
          <span /><span /><span />
        </button>
        <a href="#top" className="nav-brand">
          FOIL<span className="nav-brand-dot">.CFD</span>
        </a>
      </div>
      <div className="nav-links">
        <a href="#cfd" className="nav-link">Lab</a>
        <a href="#projects" className="nav-link">Projects</a>
        <a href="#readme" className="nav-link">README</a>
        <a href="https://github.com/swipswaps/foil-cfd-site" target="_blank" rel="noreferrer" className="nav-link">GitHub ↗</a>
      </div>
    </nav>
  );
}
