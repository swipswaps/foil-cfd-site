export interface LabUrlState {
  field?: string;
  naca?: string;
  speed?: number;
  flow?: boolean;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  job?: string;
}

const FIELD = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;
const NACA = /^\d{4}$/;
const JOB = /^[A-Za-z0-9_-]{1,64}$/;

function numberIn(value: string | null, lo: number, hi: number): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(hi, Math.max(lo, n));
}

/** Read the shareable lab state from a query string. Invalid values are dropped. */
export function parseLabUrl(search: string): LabUrlState {
  const params = new URLSearchParams(search);
  const field = params.get('field');
  const naca = params.get('naca');
  const job = params.get('job');
  const flow = params.get('flow');
  return {
    field: field && FIELD.test(field) ? field : undefined,
    naca: naca && NACA.test(naca) ? naca : undefined,
    job: job && JOB.test(job) ? job : undefined,
    speed: numberIn(params.get('speed'), 0.5, 5),
    flow: flow === '1' ? true : flow === '0' ? false : undefined,
    rotX: numberIn(params.get('rx'), -180, 180),
    rotY: numberIn(params.get('ry'), -180, 180),
    rotZ: numberIn(params.get('rz'), -180, 180),
  };
}

/**
 * Compose a query string for the lab state. Defaults are omitted so an untouched
 * visit keeps a clean URL; only non-default state is written.
 */
export function buildLabSearch(state: LabUrlState): string {
  const params = new URLSearchParams();
  if (state.field && state.field !== 'p') params.set('field', state.field);
  if (state.naca) params.set('naca', state.naca);
  if (state.speed !== undefined && Math.abs(state.speed - 2) > 1e-9) {
    params.set('speed', state.speed.toFixed(1));
  }
  if (state.flow === false) params.set('flow', '0');
  if (state.rotX) params.set('rx', state.rotX.toFixed(0));
  if (state.rotY) params.set('ry', state.rotY.toFixed(0));
  if (state.rotZ) params.set('rz', state.rotZ.toFixed(0));
  if (state.job) params.set('job', state.job);
  const query = params.toString();
  return query ? `?${query}` : '';
}
