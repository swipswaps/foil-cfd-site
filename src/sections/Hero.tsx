import { FoilScene } from '../components/FoilScene';
import type { SceneContent } from '../data/scene';

interface Props {
  content: SceneContent;
}

export function Hero({ content }: Props) {
  return (
    <section id="top" className="hero-section">
      <h1 className="sr-only">
        FOIL.CFD — CFD, CAD, and 3D tools for engineering research
      </h1>
      <FoilScene content={content} />
      <div className="hero-caption">
        <p className="hero-tagline">
          CFD, CAD, and 3D tools for engineering research.
        </p>
        <a href="#readme" className="hero-scroll">Read more ↓</a>
      </div>
    </section>
  );
}
