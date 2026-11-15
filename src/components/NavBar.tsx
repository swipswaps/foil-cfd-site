export function NavBar() {
  return (
    <nav className="nav-bar">
      <a href="#top" className="nav-brand">
        FOIL<span className="nav-brand-dot">.CFD</span>
      </a>
      <div className="nav-links">
        <a href="#projects" className="nav-link">Projects</a>
        <a href="#readme" className="nav-link">README</a>
        <a
          href="https://github.com/swipswaps/foil-cfd-site"
          target="_blank"
          rel="noreferrer"
          className="nav-link"
        >
          GitHub ↗
        </a>
      </div>
    </nav>
  );
}
