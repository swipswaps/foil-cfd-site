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
        <a href="#readme" className="hero-scroll">Read more ↓</a>
      </div>
    </section>
  );
}
