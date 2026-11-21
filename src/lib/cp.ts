export interface CpPoint {
  x: number;
  cp: number;
}

/** Bundled sample distribution shown when no scene-specific Cp is available. */
export const SAMPLE_UPPER: CpPoint[] = [
  { x: 0, cp: 1.0 }, { x: 0.05, cp: -0.9 }, { x: 0.1, cp: -1.5 },
  { x: 0.3, cp: -1.0 }, { x: 0.6, cp: -0.4 }, { x: 1.0, cp: -0.1 },
];

export const SAMPLE_LOWER: CpPoint[] = [
  { x: 0, cp: 1.0 }, { x: 0.05, cp: 0.4 }, { x: 0.2, cp: 0.2 },
  { x: 0.5, cp: 0.1 }, { x: 1.0, cp: 0.0 },
];

function interpolate(points: CpPoint[], x: number): number {
  if (points.length === 0) return Number.NaN;
  if (x <= points[0].x) return points[0].cp;
  const last = points[points.length - 1];
  if (x >= last.x) return last.cp;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (x <= b.x) {
      const span = b.x - a.x;
      if (span <= 0) return b.cp;
      const t = (x - a.x) / span;
      return a.cp + t * (b.cp - a.cp);
    }
  }
  return last.cp;
}

/**
 * Section normal-force coefficient from a Cp distribution:
 *   Cn = ∫₀¹ (Cp_lower − Cp_upper) d(x/c)
 * Trapezoidal on the union of both x/c grids. This is post-processing of the
 * displayed chart, not a solver force output.
 */
export function sectionNormalForce(upper: CpPoint[], lower: CpPoint[]): number {
  if (upper.length < 2 || lower.length < 2) return Number.NaN;
  const xs = Array.from(new Set([...upper.map((p) => p.x), ...lower.map((p) => p.x)]))
    .sort((a, b) => a - b);
  let cn = 0;
  for (let i = 1; i < xs.length; i++) {
    const xa = xs[i - 1];
    const xb = xs[i];
    const ya = interpolate(lower, xa) - interpolate(upper, xa);
    const yb = interpolate(lower, xb) - interpolate(upper, xb);
    cn += ((ya + yb) / 2) * (xb - xa);
  }
  return cn;
}
