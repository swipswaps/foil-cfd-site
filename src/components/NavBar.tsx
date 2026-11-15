import type { CSSProperties } from 'react';

const navLink: CSSProperties = {
  color: '#94AEBF',
  textDecoration: 'none',
  fontSize: '0.85rem',
  fontWeight: 500,
  letterSpacing: '0.02em',
};

export function NavBar() {
  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.85rem 1.75rem',
        background: 'rgba(6, 18, 26, 0.72)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(30, 58, 74, 0.55)',
      }}
    >
      <a
        href="#top"
        style={{
          textDecoration: 'none',
          fontFamily: "Impact, 'Arial Narrow Bold', sans-serif",
          fontSize: '1.15rem',
          letterSpacing: '0.02em',
          color: '#E2F4FF',
        }}
      >
        FOIL<span style={{ color: '#5BC0EB' }}>.CFD</span>
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
        <a href="#projects" style={navLink}>Projects</a>
        <a href="#readme" style={navLink}>README</a>
        <a
          href="https://github.com/swipswaps/foil-cfd-site"
          target="_blank"
          rel="noreferrer"
          style={navLink}
        >
          GitHub ↗
        </a>
      </div>
    </nav>
  );
}
