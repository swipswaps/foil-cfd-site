import { FoilScene } from '../components/FoilScene';
import { CanvasBoundary } from '../components/CanvasBoundary';
import type { SceneContent, FlowDirection } from '../data/scene';

interface Props {
  content: SceneContent;
  flow: boolean;
  direction: FlowDirection;
  speed: number;
}

export function Hero({ content, flow, direction, speed }: Props) {
  return (
    <section id="top" className="hero-section">
      <h1 className="sr-only">
        FOIL.CFD — CFD, CAD, and 3D tools for engineering research
      </h1>
      <CanvasBoundary>
        <FoilScene
          content={content}
          flow={flow}
          direction={direction}
          speed={speed}
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
