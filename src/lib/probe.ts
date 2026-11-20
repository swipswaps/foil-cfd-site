export interface ProbeSample {
  x: number;
  y: number;
  z: number;
  p: number;
  u: number;
  t: number;
}

export function fmtProbe(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

export const CHORD_M = 1.0;
export const NU_AIR = 1.5e-5;
export const RHO_AIR = 1.225;
export const T_INF_K = 288.15;

export interface FreeStream {
  speed: number;
  chord: number;
  reynolds: number;
  dynamicPressure: number;
  temperature: number;
}

export function freeStream(speed: number): FreeStream {
  return {
    speed,
    chord: CHORD_M,
    reynolds: (speed * CHORD_M) / NU_AIR,
    dynamicPressure: 0.5 * RHO_AIR * speed * speed,
    temperature: T_INF_K,
  };
}

export function formatRe(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  const exp = Math.floor(Math.log10(value));
  const mantissa = value / 10 ** exp;
  const superscript = String(exp)
    .replace(/-/g, '⁻')
    .replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
  return `${mantissa.toFixed(1)}×10${superscript}`;
}
