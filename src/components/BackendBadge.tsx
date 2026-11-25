import type { BackendStatus } from '../hooks/useBackendProbe';
import { SolverStatus } from './SolverStatus';

interface Props {
  status: BackendStatus;
  reason: string;
  solverAvailable: boolean;
  connected: boolean;
  actionLabel?: string;
  onRetry: () => void;
}

/**
 * Primary solver status. The pill speaks to visitors ("Live solver ready",
 * "Static demo · sample wing"); connection and solver diagnostics stay in the
 * closed "Technical details" disclosure below it for operators.
 */
export function BackendBadge({
  status,
  reason,
  solverAvailable,
  connected,
  actionLabel = 'Retry',
  onRetry,
}: Props) {
  return (
    <div className="backend-badge-stack">
      <SolverStatus
        status={status}
        solverAvailable={solverAvailable}
        actionLabel={actionLabel}
        onRetry={onRetry}
        className="backend-badge"
      />
      <details className="backend-details">
        <summary>Technical details</summary>
        <dl>
          <dt>Connection</dt>
          <dd>{connected ? 'connected' : 'not connected'}</dd>
          <dt>Solver</dt>
          <dd>{solverAvailable ? 'available' : 'not available'}</dd>
        </dl>
        {reason && <p className="backend-reason">{reason}</p>}
        <p className="backend-reason">
          Self-hosting instructions are in the sidebar under “Self-host the solver”.
        </p>
      </details>
    </div>
  );
}
