import { FoilScene } from '../components/FoilScene';

export function Hero() {
  return (
    <section id="top" className="hero-section">
      <h1 className="sr-only">
        FOIL.CFD — CFD, CAD, and 3D tools for engineering research
      </h1>
      <FoilScene />
      <div className="hero-caption">
        <p className="hero-tagline">
          CFD, CAD, and 3D tools for engineering research.
        </p>
        <a href="#readme" className="hero-scroll">Read more ↓</a>
      </div>
    </section>
  );
}
