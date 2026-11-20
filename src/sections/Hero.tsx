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
}

const POSTER = `${import.meta.env.BASE_URL}demo/wing-poster.png`;

export function Hero({ content, flow, speed, rotationX, rotationY, rotationZ }: Props) {
  return (
    <section id="top" className="hero-section">
      <h1 className="sr-only">
        FOIL.CFD — CFD, CAD, and 3D tools for engineering research
      </h1>
      <CanvasBoundary>
        <FoilScene
          content={content}
          flow={flow}
          speed={speed}
          rotationX={rotationX}
          rotationY={rotationY}
          rotationZ={rotationZ}
        />
      </CanvasBoundary>
      <div className="hero-caption">
        <p className="hero-tagline">
          CFD, CAD, and 3D tools for engineering research.
        </p>
        <div className="hero-actions">
          <a href="#cfd" className="hero-cta-primary">Open 3D CFD Lab ↓</a>
          <a href="#readme" className="hero-cta-secondary">Read the paper ↓</a>
        </div>
        <a href="#cfd" className="hero-lab-preview" aria-label="Open the 3D CFD lab">
          <img src={POSTER} alt="3D CFD lab sample wing" loading="lazy" />
          <span>Live sample wing · 3D lab</span>
        </a>
      </div>
    </section>
  );
}
