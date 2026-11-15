import { useEffect, useState } from 'react';
import { templates, type TemplateId } from '../data/templates';

const STORAGE_KEY = 'foil-cfd-template';

function readInitial(): TemplateId {
  if (typeof window === 'undefined') return 'minimal';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'minimal' || saved === 'cinematic' || saved === 'grid') return saved;
  } catch {
    /* localStorage blocked */
  }
  return 'minimal';
}

export function TemplateToggle() {
  const [active, setActive] = useState<TemplateId>(readInitial);

  useEffect(() => {
    document.documentElement.setAttribute('data-template', active);
    try {
      window.localStorage.setItem(STORAGE_KEY, active);
    } catch {
      /* ignore */
    }
  }, [active]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        gap: 8,
        background: 'rgba(11, 26, 36, 0.88)',
        border: '1px solid #1E3A4A',
        borderRadius: 999,
        padding: '6px 10px',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      {templates.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setActive(t.id)}
          title={t.description}
          style={{
            border: 'none',
            borderRadius: 999,
            padding: '6px 14px',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            background: active === t.id ? '#5BC0EB' : 'transparent',
            color: active === t.id ? '#06121A' : '#94AEBF',
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
