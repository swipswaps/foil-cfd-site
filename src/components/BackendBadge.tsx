import type { BackendStatus } from '../hooks/useBackendProbe';

interface Props {
  status: BackendStatus;
  reason: string;
  onRetry: () => void;
}

export function BackendBadge({ status, reason, onRetry }: Props) {
  const label =
    status === 'online'
      ? 'Backend online'
      : status === 'probing'
      ? 'Detecting backend…'
      : `Static mode — ${reason}`;

  return (
    <div className="backend-badge" role="status" aria-live="polite">
      <span className={`backend-dot backend-dot-${status}`} aria-hidden="true" />
      <span className="backend-label">{label}</span>
      {status !== 'online' && (
        <button type="button" onClick={onRetry} className="backend-retry">
          Retry
        </button>
      )}
    </div>
  );
}
