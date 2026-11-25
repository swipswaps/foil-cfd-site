import type { BackendStatus } from '../hooks/useBackendProbe';
import { solverStatusLabel, type SolverStatusVariant } from '../lib/solverStatus';

interface Props {
  status: BackendStatus;
  solverAvailable: boolean;
  variant?: SolverStatusVariant;
  actionLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export function SolverStatus({
  status,
  solverAvailable,
  variant = 'pill',
  actionLabel = 'Retry',
  onRetry,
  className,
}: Props) {
  const classes = [
    'solver-status',
    `solver-status-${status}`,
    `solver-status-${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} role="status" aria-live="polite">
      <span className={`solver-dot solver-dot-${status}`} aria-hidden="true" />
      <span className="solver-label">{solverStatusLabel(status, solverAvailable, variant)}</span>
      {onRetry && status !== 'online' && (
        <button type="button" className="backend-retry" onClick={onRetry}>
          {actionLabel}
        </button>
      )}
    </span>
  );
}
