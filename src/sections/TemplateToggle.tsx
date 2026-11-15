import { useEffect, useState } from 'react';
import { templates, type TemplateId } from '../data/templates';

const STORAGE_KEY = 'foil-cfd-template';

function readInitial(): TemplateId {
  if (typeof window === 'undefined') return 'minimal';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'minimal' || saved === 'cinematic' || saved === 'grid') return saved;
  } catch { /* ignore */ }
  return 'minimal';
}

export function TemplateToggle() {
  const [active, setActive] = useState<TemplateId>(readInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-template', active);
    try { window.localStorage.setItem(STORAGE_KEY, active); } catch { /* ignore */ }
  }, [active]);

  return (
    <div className="template-toggle" role="group" aria-label="Visual template">
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setActive(t.id)}
          className={active === t.id ? 'active' : ''}
          aria-pressed={active === t.id}
          title={t.description}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
