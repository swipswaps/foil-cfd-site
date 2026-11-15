import { projects } from '../data/projects';

export function ProjectShowcase() {
  return (
    <section id="projects" className="projects-section">
      <h2 className="section-heading">CFD &amp; 3D Projects</h2>
      <div className="project-grid">
        {projects.map((p) => (
          <a
            key={p.name}
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="project-card"
          >
            <div className="project-head">
              <h3 className="project-name">{p.name}</h3>
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
            <div className="project-links">
              <span className="project-repo">Repo ↗</span>
              {p.pagesUrl && <span className="project-live">Live ↗</span>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
