import { FoilScene } from '../components/FoilScene';
import type { SceneContent } from '../data/scene';

interface Props {
  content: SceneContent;
  flow: boolean;
}

export function Hero({ content, flow }: Props) {
  return (
    <section id="top" className="hero-section">
      <h1 className="sr-only">
        FOIL.CFD — CFD, CAD, and 3D tools for engineering research
      </h1>
      <FoilScene content={content} flow={flow} />
      <div className="hero-caption">
        <p className="hero-tagline">
          CFD, CAD, and 3D tools for engineering research.
        </p>
        <a href="#readme" className="hero-scroll">Read more ↓</a>
      </div>
    </section>
  );
}
