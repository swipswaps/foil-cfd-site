import { lazy, Suspense } from 'react';
import { CfdVtkBoundary } from '../components/CfdVtkBoundary';
import type { CfdField } from '../App';

const CfdVtkViewer = lazy(() =>
  import('../components/CfdVtkViewer').then((m) => ({ default: m.CfdVtkViewer }))
);
const CpPolarChart = lazy(() =>
  import('../components/CpPolarChart').then((m) => ({ default: m.CpPolarChart }))
);

interface Props {
  backendUrl: string;
  backendOnline: boolean;
  solverAvailable: boolean;
  field: CfdField;
  onFieldChange: (field: CfdField) => void;
  datasetUrl: string;
  jobId: string | null;
  jobStatus: string;
}

const FieldSkeleton = ({ label }: { label: string }) => (
  <div className="cfd-vtk-skeleton" aria-label={`Loading ${label}`} />
);

export function CfdLab({
  backendUrl, backendOnline, solverAvailable, field, onFieldChange,
  datasetUrl, jobId, jobStatus,
}: Props) {
  return (
    <section id="cfd" className="cfd-lab">
      <header className="cfd-lab-head">
        <h2>CFD Laboratory</h2>
        <div className="cfd-lab-status">
          <span>
            {backendOnline
              ? solverAvailable
                ? 'OpenFOAM ready'
                : 'Solver unavailable · sample mesh'
              : 'Static demo · sample wing'}
          </span>
          <label className="cfd-lab-field">
            Field
            <select
              value={field}
              onChange={(e) => onFieldChange(e.target.value as CfdField)}
            >
              <option value="p">Pressure (p)</option>
              <option value="U">Velocity (U)</option>
              <option value="T">Temperature (T)</option>
            </select>
          </label>
        </div>
      </header>
      {jobId && (
        <div className="cfd-job-status">Job {jobId.slice(0, 8)} · {jobStatus}</div>
      )}
      <div className="cfd-lab-grid">
        <CfdVtkBoundary>
          <Suspense fallback={<FieldSkeleton label="VTK viewer" />}>
            <CfdVtkViewer datasetUrl={datasetUrl} field={field} />
          </Suspense>
        </CfdVtkBoundary>
        <Suspense fallback={<FieldSkeleton label="Cp chart" />}>
          <CpPolarChart />
        </Suspense>
      </div>
      <p className="cfd-lab-credit">
        {backendOnline ? (
          <>Viewing <code>{datasetUrl.replace(backendUrl, '')}</code></>
        ) : (
          <>Static demo · sample wing</>
        )}
      </p>
    </section>
  );
}
