import { lazy, Suspense } from 'react';
import { CfdVtkBoundary } from '../components/CfdVtkBoundary';
import type { CfdField } from '../App';
import type { CpPoint } from '../components/CpPolarChart';

const CfdVtkViewer = lazy(() =>
  import('../components/CfdVtkViewer').then((m) => ({ default: m.CfdVtkViewer }))
);
const CpPolarChart = lazy(() =>
  import('../components/CpPolarChart').then((m) => ({ default: m.CpPolarChart }))
);

interface Props {
  backendOnline: boolean;
  solverAvailable: boolean;
  field: CfdField;
  onFieldChange: (field: CfdField) => void;
  sceneLabel: string;
  cp?: { upper: CpPoint[]; lower: CpPoint[] };
  chartNote?: string;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  provenance: string;
  datasetUrl: string;
  jobId: string | null;
  jobStatus: string;
  speed: number;
}

const CHORD_M = 1.0;
const NU_AIR = 1.5e-5;
const RHO_AIR = 1.225;
const T_INF_K = 288.15;

function formatRe(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  const exp = Math.floor(Math.log10(value));
  const mantissa = value / 10 ** exp;
  const superscript = String(exp).replace(/-/g, '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
  return `${mantissa.toFixed(1)}×10${superscript}`;
}

const FieldSkeleton = ({ label }: { label: string }) => (
  <div className="cfd-vtk-skeleton" aria-label={`Loading ${label}`} />
);

export function CfdLab({
  backendOnline, solverAvailable, field, onFieldChange,
  sceneLabel, cp, chartNote, rotationX, rotationY, rotationZ, provenance, datasetUrl, jobId, jobStatus, speed,
}: Props) {
  const reynolds = (speed * CHORD_M) / NU_AIR;
  const qInf = 0.5 * RHO_AIR * speed * speed;
  return (
    <section className="cfd-lab">
      <header className="cfd-lab-head">
        <h2>CFD Laboratory</h2>
        <div className="cfd-lab-status">
          <span>
            {backendOnline
              ? solverAvailable
                ? 'OpenFOAM ready'
                : 'Solver unavailable · sample mesh'
              : 'Static demo'}
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
      <div className="cfd-lab-freestream" aria-label="Free-stream conditions">
        <span title="Free-stream velocity">U∞ {speed.toFixed(1)} m/s</span>
        <span title="Reference chord">c {CHORD_M.toFixed(1)} m</span>
        <span title="Reynolds number based on chord">Re {formatRe(reynolds)}</span>
        <span title="Dynamic pressure">q∞ {Math.round(qInf)} Pa</span>
        <span title="Static temperature">T∞ {T_INF_K.toFixed(0)} K</span>
      </div>
      {jobId && (
        <div className="cfd-job-status">Job {jobId.slice(0, 8)} · {jobStatus}</div>
      )}
      <div className="cfd-lab-grid">
        <CfdVtkBoundary>
          <Suspense fallback={<FieldSkeleton label="VTK viewer" />}>
            <CfdVtkViewer datasetUrl={datasetUrl} field={field} rotationX={rotationX} rotationY={rotationY} rotationZ={rotationZ} />
          </Suspense>
        </CfdVtkBoundary>
        {cp ? (
          <Suspense fallback={<FieldSkeleton label="Cp chart" />}>
            <CpPolarChart upper={cp.upper} lower={cp.lower} title={`${sceneLabel} · Cp vs x/c`} />
          </Suspense>
        ) : chartNote ? (
          <div className="cfd-chart-note">{chartNote}</div>
        ) : (
          <Suspense fallback={<FieldSkeleton label="Cp chart" />}>
            <CpPolarChart />
          </Suspense>
        )}
      </div>
      <p className="cfd-lab-credit">
        {sceneLabel}
        {backendOnline ? '' : ' · static demo'}
      </p>
      <p className="cfd-lab-provenance">{provenance}</p>
    </section>
  );
}
