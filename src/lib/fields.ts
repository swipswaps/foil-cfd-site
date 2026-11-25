export interface FieldInfo {
  name: string;
  label: string;
  kind: 'scalar' | 'vector';
}

const LABELS: Record<string, string> = {
  p: 'Pressure (p)',
  U: 'Velocity (U)',
  T: 'Temperature (T)',
  k: 'Turbulent kinetic energy (k)',
  epsilon: 'Turbulence dissipation (epsilon)',
  nut: 'Eddy viscosity (nut)',
};

const PRIORITY: Record<string, number> = {
  p: 0,
  U: 1,
  T: 2,
  k: 3,
  epsilon: 4,
  nut: 5,
};

export function labelForField(name: string): string {
  return LABELS[name] ?? name;
}

export function orderFields(fields: FieldInfo[]): FieldInfo[] {
  return [...fields].sort((a, b) => {
    const pa = PRIORITY[a.name] ?? 100;
    const pb = PRIORITY[b.name] ?? 100;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });
}

/** Default field list before the dataset has reported its real arrays. */
export function fallbackFields(): FieldInfo[] {
  return [{ name: 'p', label: labelForField('p'), kind: 'scalar' }];
}

/** Pick the requested field if present, otherwise the first offered field. */
export function resolveField(fields: FieldInfo[], requested: string): string {
  if (fields.some((f) => f.name === requested)) return requested;
  return fields[0]?.name ?? requested;
}
