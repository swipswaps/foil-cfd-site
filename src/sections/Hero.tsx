import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { FoilScene } from '../components/FoilScene';
import { CanvasBoundary } from '../components/CanvasBoundary';
import type { SceneContent } from '../data/scene';

interface Props {
  content: SceneContent;
  flow: boolean;
  speed: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  tab: 'overview' | 'lab';
  onTabChange: (tab: 'overview' | 'lab') => void;
  onPrefetchLab?: () => void;
  lab: ReactNode;
}

const POSTER = `${import.meta.env.BASE_URL}demo/wing-poster.png`;

export function Hero({ content, flow, speed, rotationX, rotationY, rotationZ, tab, onTabChange, onPrefetchLab, lab }: Props) {
  const overviewRef = useRef<HTMLButtonElement>(null);
  const labRef = useRef<HTMLButtonElement>(null);

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = tab === 'overview' ? 0 : 1;
    let next = index;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowUp':
        next = index === 0 ? 1 : 0;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const target = next === 0 ? 'overview' : 'lab';
    onTabChange(target);
    (next === 0 ? overviewRef : labRef).current?.focus();
  };

  return (
    <section id="top" className="hero-section">
      <h1 className="sr-only">FOIL.CFD — CFD, CAD, and 3D tools for engineering research</h1>
      <div className="hero-tabs" role="tablist" aria-label="Hero view" onKeyDown={onTabKeyDown}>
        <button
          ref={overviewRef}
          id="hero-tab-overview"
          type="button"
          role="tab"
          aria-selected={tab === 'overview'}
          aria-controls="hero-panel-overview"
          tabIndex={tab === 'overview' ? 0 : -1}
          className="hero-tab"
          onClick={() => onTabChange('overview')}
        >
          Overview
        </button>
        <button
          ref={labRef}
          id="hero-tab-lab"
          type="button"
          role="tab"
          aria-selected={tab === 'lab'}
          aria-controls="cfd"
          tabIndex={tab === 'lab' ? 0 : -1}
          className="hero-tab"
          onClick={() => onTabChange('lab')}
          onPointerEnter={onPrefetchLab}
          onFocus={onPrefetchLab}
        >
          3D Lab
        </button>
      </div>
      {tab === 'lab' ? (
        <div id="cfd" className="hero-lab" role="tabpanel" aria-labelledby="hero-tab-lab">
          {lab}
        </div>
      ) : (
        <div id="hero-panel-overview" className="hero-panel-overview" role="tabpanel" aria-labelledby="hero-tab-overview">
          <CanvasBoundary>
            <FoilScene content={content} flow={flow} speed={speed} rotationX={rotationX} rotationY={rotationY} rotationZ={rotationZ} />
          </CanvasBoundary>
          <div className="hero-caption">
            <p className="hero-tagline">CFD, CAD, and 3D tools for engineering research.</p>
            <div className="hero-actions">
              <a href="#cfd" className="hero-cta-primary" onPointerEnter={onPrefetchLab} onFocus={onPrefetchLab}>Open 3D CFD Lab ↓</a>
              <a href="#readme" className="hero-cta-secondary">Read the paper ↓</a>
            </div>
            <a href="#cfd" className="hero-lab-preview" aria-label="Open the 3D CFD lab: Live sample wing · 3D lab" onPointerEnter={onPrefetchLab} onFocus={onPrefetchLab}>
              <img src={POSTER} alt="3D CFD lab sample wing" loading="lazy" />
              <span>Live sample wing · 3D lab</span>
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
