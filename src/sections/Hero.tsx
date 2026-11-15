import { FoilScene } from '../components/FoilScene';

export function Hero() {
  return (
    <section
      id="top"
      style={{ position: 'relative', height: '100vh', width: '100vw' }}
    >
      <h1 className="sr-only">FOIL.CFD — CFD, CAD, and 3D tools for engineering research</h1>
      <FoilScene />
      <div
        style={{
          position: 'absolute',
          bottom: '8vh',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          maxWidth: 640,
          padding: '0 1.5rem',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 'clamp(0.9rem, 1.4vw, 1.05rem)',
            color: 'rgba(148, 201, 232, 0.82)',
            textShadow: '0 2px 12px rgba(0, 0, 0, 0.85)',
            lineHeight: 1.55,
            letterSpacing: '0.01em',
          }}
        >
          CFD, CAD, and 3D tools for engineering research.
        </p>
        <a
          href="#readme"
          style={{
            pointerEvents: 'auto',
            display: 'inline-block',
            marginTop: '1.75rem',
            fontSize: '0.68rem',
            letterSpacing: '0.25em',
            color: 'rgba(94, 143, 168, 0.95)',
            textTransform: 'uppercase',
            textDecoration: 'none',
            borderBottom: '1px solid rgba(30, 58, 74, 0.7)',
            paddingBottom: '0.3rem',
          }}
        >
          Read more ↓
        </a>
      </div>
    </section>
  );
}
