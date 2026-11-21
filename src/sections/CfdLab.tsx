import { lazy, Suspense } from 'react';
import { CfdVtkBoundary } from '../components/CfdVtkBoundary';
import type { CfdField } from '../App';
import type { CpPoint } from '../components/CpPolarChart';
import { SAMPLE_LOWER, SAMPLE_UPPER, sectionNormalForce } from '../lib/cp';
import { freeStream, formatRe, type ProbeSample } from '../lib/probe';

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
  onProbe?: (sample: ProbeSample | null) => void;
  focusRequest?: { sample: ProbeSample; nonce: number } | null;
}

const FieldSkeleton = ({ label }: { label: string }) => (
  <div className="cfd-vtk-skeleton" aria-label={`Loading ${label}`} />
);

export function CfdLab({
  backendOnline, solverAvailable, field, onFieldChange,
  sceneLabel, cp, chartNote, rotationX, rotationY, rotationZ, provenance, datasetUrl, jobId, jobStatus, speed, onProbe, focusRequest,
}: Props) {
  const stream = freeStream(speed);
  const sectionCn = cp
    ? sectionNormalForce(cp.upper, cp.lower)
    : chartNote
    ? undefined
    : sectionNormalForce(SAMPLE_UPPER, SAMPLE_LOWER);
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
        <span title="Free-stream velocity">U∞ {stream.speed.toFixed(1)} m/s</span>
        <span title="Reference chord">c {stream.chord.toFixed(1)} m</span>
        <span title="Reynolds number based on chord">Re {formatRe(stream.reynolds)}</span>
        <span title="Dynamic pressure">q∞ {Math.round(stream.dynamicPressure)} Pa</span>
        <span title="Static temperature">T∞ {stream.temperature.toFixed(0)} K</span>
        {sectionCn !== undefined && Number.isFinite(sectionCn) && (
          <span title="Section normal-force coefficient integrated from the plotted Cp (post-processed, not solver output)">
            Cn {sectionCn.toFixed(3)}
          </span>
        )}
      </div>
      {jobId && (
        <div className="cfd-job-status">Job {jobId.slice(0, 8)} · {jobStatus}</div>
      )}
      <div className="cfd-lab-grid">
        <CfdVtkBoundary>
          <Suspense fallback={<FieldSkeleton label="VTK viewer" />}>
            <CfdVtkViewer datasetUrl={datasetUrl} field={field} rotationX={rotationX} rotationY={rotationY} rotationZ={rotationZ} onProbe={onProbe} freeStream={stream} sectionCn={sectionCn} focusRequest={focusRequest} />
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
