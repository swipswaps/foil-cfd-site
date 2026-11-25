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

export interface CpSummary {
  peak: { x: number; cp: number };
  cn: number;
  recoveryX: number;
  text: string;
}

/**
 * A plain-text reading of the Cp chart so the conclusion is available without
 * seeing the plot (screen readers, low-vision, print). Every number is derived
 * from the plotted samples; nothing is invented.
 */
export function summarizeCp(upper: CpPoint[], lower: CpPoint[]): CpSummary {
  const suction = upper.length >= 2 ? upper : lower;
  let peak = suction[0] ?? { x: 0, cp: 0 };
  for (const p of suction) {
    if (p.cp < peak.cp) peak = p;
  }
  const cn = sectionNormalForce(upper, lower);
  const cnText = Number.isFinite(cn) ? cn.toFixed(2) : '—';
  const recoveryX = suction.length > 0 ? suction[suction.length - 1].x : 1;
  const text =
    `Peak suction Cp ${peak.cp.toFixed(2)} at x/c ${peak.x.toFixed(2)}; ` +
    `section normal force Cn ${cnText}; ` +
    `upper-surface pressure recovers toward x/c ${recoveryX.toFixed(2)}.`;
  return { peak, cn, recoveryX, text };
}


function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface DerivedCp {
  upper: CpPoint[];
  lower: CpPoint[];
  pRef: number;
  uRef: number;
}

/**
 * Build a chordwise Cp distribution from a loaded surface's point data.
 *
 * `pressure` is normalised by the free-stream: Cp = (p - p_ref) / (0.5 U_ref²),
 * where p_ref is the median surface pressure (the outlet is the common
 * reference) and U_ref is the maximum velocity magnitude on the surface. That
 * makes a solved OpenFOAM kinematic-pressure field (m²/s²) comparable across
 * jobs. The x axis is normalised to x/c using the surface bounds, and points are
 * split into upper/lower halves around the local mid-line of each chord bin.
 *
 * Returns null when the data cannot form two distributions (for example a
 * single-sided sheet or a field with no pressure).
 */
export function deriveCpFromSurface(
  pointCoords: ArrayLike<number>,
  pressure: ArrayLike<number>,
  opts: { uRef?: number; bins?: number } = {},
): DerivedCp | null {
  const n = Math.min(pressure.length, Math.floor(pointCoords.length / 3));
  if (n < 4) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  const pVals: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const x = Number(pointCoords[i * 3]);
    if (Number.isFinite(x)) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    const p = Number(pressure[i]);
    if (Number.isFinite(p)) pVals.push(p);
  }
  const span = maxX - minX;
  if (!Number.isFinite(span) || span <= 0 || pVals.length < 4) return null;

  const bins = Math.max(8, Math.min(opts.bins ?? 32, n));
  const pRef = median(pVals);
  const uRef = opts.uRef && Number.isFinite(opts.uRef) && opts.uRef > 0 ? opts.uRef : 0;
  const qRef = uRef > 0 ? 0.5 * uRef * uRef : 1;
  const binOf = (x: number) =>
    Math.min(bins - 1, Math.max(0, Math.floor(((x - minX) / span) * bins)));

  const ySum = new Array<number>(bins).fill(0);
  const yCount = new Array<number>(bins).fill(0);
  for (let i = 0; i < n; i += 1) {
    const x = Number(pointCoords[i * 3]);
    const y = Number(pointCoords[i * 3 + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const b = binOf(x);
    ySum[b] += y;
    yCount[b] += 1;
  }

  const upperSum = new Array<number>(bins).fill(0);
  const upperN = new Array<number>(bins).fill(0);
  const lowerSum = new Array<number>(bins).fill(0);
  const lowerN = new Array<number>(bins).fill(0);
  for (let i = 0; i < n; i += 1) {
    const x = Number(pointCoords[i * 3]);
    const y = Number(pointCoords[i * 3 + 1]);
    const p = Number(pressure[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(p)) continue;
    const b = binOf(x);
    const meanY = yCount[b] > 0 ? ySum[b] / yCount[b] : 0;
    const cp = (p - pRef) / qRef;
    if (y >= meanY) {
      upperSum[b] += cp;
      upperN[b] += 1;
    } else {
      lowerSum[b] += cp;
      lowerN[b] += 1;
    }
  }

  const upper: CpPoint[] = [];
  const lower: CpPoint[] = [];
  for (let b = 0; b < bins; b += 1) {
    const xc = (b + 0.5) / bins;
    if (upperN[b] > 0) upper.push({ x: xc, cp: upperSum[b] / upperN[b] });
    if (lowerN[b] > 0) lower.push({ x: xc, cp: lowerSum[b] / lowerN[b] });
  }
  if (upper.length < 2 || lower.length < 2) return null;
  return { upper, lower, pRef, uRef };
}
