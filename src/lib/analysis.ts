export interface JobAnalysis {
  source?: string;
  n_points?: number;
  n_cells?: number;
  point_fields?: string[];
  cell_fields?: string[];
  velocity_magnitude_mean?: number;
  velocity_magnitude_max?: number;
  note?: string;
}

/** One-line, user-facing summary of a completed job's analysis payload. */
export function summarizeAnalysis(a: JobAnalysis): string {
  const parts: string[] = [];
  if (a.source) parts.push(`source ${a.source}`);
  if (typeof a.n_points === 'number') parts.push(`${a.n_points} points`);
  if (typeof a.n_cells === 'number') parts.push(`${a.n_cells} cells`);
  const fields = Array.isArray(a.point_fields) && a.point_fields.length > 0
    ? a.point_fields
    : Array.isArray(a.cell_fields)
    ? a.cell_fields
    : [];
  if (fields.length > 0) parts.push(`fields ${fields.join(', ')}`);
  if (typeof a.velocity_magnitude_mean === 'number' && typeof a.velocity_magnitude_max === 'number') {
    parts.push(`|U| mean ${a.velocity_magnitude_mean.toFixed(2)}, max ${a.velocity_magnitude_max.toFixed(2)}`);
  }
  return parts.join(' · ');
}
