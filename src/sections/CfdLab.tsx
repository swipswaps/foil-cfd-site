import { useEffect, useState, lazy, Suspense } from 'react';

const CfdVtkViewer = lazy(() =>
  import('../components/CfdVtkViewer').then((m) => ({ default: m.CfdVtkViewer }))
);
const CpPolarChart = lazy(() =>
  import('../components/CpPolarChart').then((m) => ({ default: m.CpPolarChart }))
);

import { CfdVtkBoundary } from '../components/CfdVtkBoundary';

interface Props { backendUrl: string; solverAvailable: boolean }

const FieldSkeleton = ({ label }: { label: string }) => (
  <div className="cfd-vtk-skeleton" aria-label={`Loading ${label}`} />
);

export function CfdLab({ backendUrl, solverAvailable }: Props) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const [datasetUrl, setDatasetUrl] = useState<string>(
    `${backendUrl}/api/jobs/default/surface.vtp`
  );

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/jobs/${jobId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setJobStatus(data.status);
        if (data.status === 'completed') {
          setDatasetUrl(`${backendUrl}/api/jobs/${jobId}/surface.vtp`);
        } else if (data.status !== 'failed') {
          setTimeout(poll, 1500);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Poll failed');
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [jobId, backendUrl]);

  const startSolve = async () => {
    setError(null);
    setJobStatus('submitting');
    try {
      const res = await fetch(`${backendUrl}/api/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: 'naca0012' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setJobId(data.job_id);
      setJobStatus('queued');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
      setJobStatus('idle');
    }
  };

  return (
    <section id="cfd" className="cfd-lab">
      <header className="cfd-lab-head">
        <h2>CFD Laboratory</h2>
        <div className="cfd-lab-status">
          <span>{solverAvailable ? 'OpenFOAM ready' : 'Solver unavailable · showing default mesh'}</span>
          {solverAvailable && (
            <button
              type="button"
              onClick={startSolve}
              disabled={jobStatus === 'running' || jobStatus === 'submitting'}
              className="cfd-solve-btn"
            >
              {jobStatus === 'running' ? 'Solving…' : jobStatus === 'submitting' ? 'Submitting…' : 'Run simpleFoam'}
            </button>
          )}
        </div>
      </header>
      {jobId && <div className="cfd-job-status">Job {jobId.slice(0, 8)} · {jobStatus}</div>}
      {error && <div className="cfd-error">{error}</div>}
      <div className="cfd-lab-grid">
        <CfdVtkBoundary>
          <Suspense fallback={<FieldSkeleton label="VTK viewer" />}>
            <CfdVtkViewer datasetUrl={datasetUrl} />
          </Suspense>
        </CfdVtkBoundary>
        <Suspense fallback={<FieldSkeleton label="Cp chart" />}>
          <CpPolarChart />
        </Suspense>
      </div>
    </section>
  );
}
