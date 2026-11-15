import { projects } from '../data/projects';

export function ProjectShowcase() {
  return (
    <section
      id="projects"
      style={{ maxWidth: 1100, margin: '0 auto', padding: '4rem 1.5rem 6rem' }}
    >
      <h2
        style={{
          fontSize: '1.6rem',
          fontWeight: 700,
          color: '#E2F4FF',
          marginBottom: '2rem',
          borderBottom: '1px solid #1E3A4A',
          paddingBottom: '0.75rem',
        }}
      >
        CFD &amp; 3D Projects
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {projects.map((p) => (
          <a
            key={p.name}
            href={p.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #1E3A4A',
              borderRadius: 12,
              padding: '1.25rem',
              background: '#0B1A24',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.6rem',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#E2F4FF' }}>
                {p.name}
              </h3>
              <span
                style={{
                  fontSize: '0.62rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color:
                    p.category === 'cfd'
                      ? '#5BC0EB'
                      : p.category === 'cad'
                      ? '#F4A261'
                      : '#A78BFA',
                }}
              >
                {p.category}
              </span>
            </div>
            <p style={{ margin: '0 0 0.9rem', fontSize: '0.85rem', color: '#94AEBF', lineHeight: 1.55 }}>
              {p.description}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.9rem' }}>
              {p.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: '0.62rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: 4,
                    background: '#132A38',
                    color: '#7FB6D4',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            <div style={{ marginTop: 'auto', display: 'flex', gap: '0.9rem', fontSize: '0.72rem' }}>
              <span style={{ color: '#5E8FA8' }}>Repo ↗</span>
              {p.pagesUrl && <span style={{ color: '#5BC0EB' }}>Live ↗</span>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
