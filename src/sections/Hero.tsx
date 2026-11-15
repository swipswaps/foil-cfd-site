import { FoilScene } from '../components/FoilScene';

export function Hero() {
  return (
    <section
      id="top"
      style={{ position: 'relative', height: '100vh', width: '100vw' }}
    >
      <FoilScene />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          textAlign: 'center',
          padding: '0 1.5rem',
        }}
      >
        <h1 style={{ margin: 0, lineHeight: 0 }}>
          <img
            src={`${import.meta.env.BASE_URL}foil-logo-dark.svg`}
            alt="FOIL.CFD"
            style={{
              width: 'min(560px, 78vw)',
              height: 'auto',
              filter: 'drop-shadow(0 6px 40px rgba(0, 0, 0, 0.55))',
            }}
          />
        </h1>
        <p
          style={{
            marginTop: '1.5rem',
            fontSize: 'clamp(0.95rem, 1.6vw, 1.2rem)',
            color: '#94C9E8',
            maxWidth: 640,
            lineHeight: 1.55,
          }}
        >
          CFD, CAD, and 3D tools for engineering research.
        </p>
        <a
          href="#readme"
          style={{
            pointerEvents: 'auto',
            marginTop: '3rem',
            fontSize: '0.75rem',
            letterSpacing: '0.25em',
            color: '#5E8FA8',
            textTransform: 'uppercase',
            textDecoration: 'none',
            borderBottom: '1px solid #1E3A4A',
            paddingBottom: '0.35rem',
          }}
        >
          Read more ↓
        </a>
      </div>
    </section>
  );
}
