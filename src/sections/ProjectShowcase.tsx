import { projects } from '../data/projects';

export function ProjectShowcase() {
  return (
    <section id="projects" className="projects-section">
      <h2 className="section-heading">CFD &amp; 3D Projects</h2>
      <div className="project-grid">
        {projects.map((p, i) => (
          <article className="project-card" key={p.name}>
            <div className="project-index">{String(i + 1).padStart(2, '0')}</div>
            <div className="project-body">
              <div className="project-head">
                <h3 className="project-name">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="project-name-link"
                  >
                    {p.name}
                  </a>
                </h3>
                <span className={`project-category project-category-${p.category}`}>
                  {p.category}
                </span>
              </div>
              <p className="project-desc">{p.description}</p>
              <div className="project-tags">
                {p.tags.map((t) => (
                  <span key={t} className="project-tag">{t}</span>
                ))}
              </div>
              <div className="project-actions">
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="project-btn"
                >
                  Repo ↗
                </a>
                {p.pagesUrl && (
                  <a
                    href={p.pagesUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="project-btn project-btn-live"
                  >
                    Live ↗
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
