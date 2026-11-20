import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  id: string;
  children: ReactNode;
  rootMargin?: string;
}

export function LazyMount({ id, children, rootMargin = '300px' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      const t = setTimeout(() => setMounted(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted, rootMargin]);

  return (
    <div id={id} ref={ref} className="lazy-mount">
      {mounted ? children : <div className="cfd-lab-skeleton" aria-hidden="true" />}
    </div>
  );
}
