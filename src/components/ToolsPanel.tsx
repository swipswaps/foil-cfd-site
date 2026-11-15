interface Props {
  online: boolean;
}

export function ToolsPanel({ online }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-300">
      <h3 className="mb-1 text-sm font-semibold text-slate-100">CFD Tools</h3>
      <p className="mb-2 text-slate-400">
        {online
          ? 'Backend connected — write operations enabled.'
          : 'Static mode — read-only. Run docker compose up -d to unlock.'}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!online}
          className="rounded bg-sky-600 px-3 py-1 font-medium text-white disabled:opacity-40"
        >
          Run Mesh
        </button>
        <button
          type="button"
          disabled={!online}
          className="rounded bg-sky-600 px-3 py-1 font-medium text-white disabled:opacity-40"
        >
          Solve Flow
        </button>
      </div>
    </div>
  );
}
