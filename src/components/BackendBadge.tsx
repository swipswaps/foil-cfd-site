import type { BackendStatus } from '../hooks/useBackendProbe';

interface Props {
  status: BackendStatus;
  reason: string;
  onRetry: () => void;
}

export function BackendBadge({ status, reason, onRetry }: Props) {
  const dot =
    status === 'online'
      ? 'bg-emerald-400'
      : status === 'probing'
      ? 'bg-sky-400 animate-pulse'
      : 'bg-amber-400';

  const label =
    status === 'online'
      ? 'Backend online — full tools'
      : status === 'probing'
      ? 'Detecting backend…'
      : `Static mode — limited tools (${reason})`;

  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span>{label}</span>
      {status !== 'online' && (
        <button
          type="button"
          onClick={onRetry}
          className="underline hover:text-white"
        >
          Retry
        </button>
      )}
    </div>
  );
}
