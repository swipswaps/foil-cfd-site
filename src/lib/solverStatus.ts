import type { BackendStatus } from '../hooks/useBackendProbe';

export type SolverStatusVariant = 'pill' | 'lab' | 'node';

/**
 * One vocabulary for the solver state, used by the status badge, the lab
 * header, and the hydro page. Operator wording (commands, loopback addresses,
 * product names) never belongs here; it lives in a secondary disclosure.
 */
export function solverStatusLabel(
  status: BackendStatus,
  solverAvailable: boolean,
  variant: SolverStatusVariant = 'pill',
): string {
  if (variant === 'lab') {
    if (status === 'probing') return 'Checking local solver';
    if (status === 'online') return solverAvailable ? 'Solver ready' : 'Preview mode · sample mesh';
    return 'Static demo';
  }
  if (variant === 'node') {
    if (status === 'probing') return 'Checking local solver';
    if (status === 'online') return 'Live solver connected';
    return 'Static preview mode';
  }
  if (status === 'probing') return 'Checking local solver';
  if (status === 'online') {
    return solverAvailable ? 'Live solver ready' : 'Live solver connected · preview mode';
  }
  return 'Static demo · sample wing';
}
