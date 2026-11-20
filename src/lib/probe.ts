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
