import { lazy, Suspense, useEffect, useState } from 'react';
import { CfdVtkBoundary } from '../components/CfdVtkBoundary';
import { SolverStatus } from '../components/SolverStatus';
import { LabCoachMark } from '../components/LabCoachMark';
import type { CpPoint } from '../components/CpDistributionChart';
import { SAMPLE_LOWER, SAMPLE_UPPER, sectionNormalForce, summarizeCp, type DerivedCp } from '../lib/cp';
import { fallbackFields, resolveField, type FieldInfo } from '../lib/fields';
import { fmtProbe, freeStream, formatRe, type ProbeSample } from '../lib/probe';
import { summarizeAnalysis, type JobAnalysis } from '../lib/analysis';

const CfdVtkViewer = lazy(() =>
  import('../components/CfdVtkViewer').then((m) => ({ default: m.CfdVtkViewer }))
);
const CpDistributionChart = lazy(() =>
  import('../components/CpDistributionChart').then((m) => ({ default: m.CpDistributionChart }))
);

type ViewerState = 'loading' | 'ready' | 'error';
type CpSource = 'solver' | 'scene' | 'sample' | 'solver-missing';

interface Props {
  backendOnline: boolean;
  solverAvailable: boolean;
  field: string;
  onFieldChange: (field: string) => void;
  sceneLabel: string;
  cp?: { upper: CpPoint[]; lower: CpPoint[] };
  cpFromJob?: boolean;
  chartNote?: string;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  provenance: string;
  datasetUrl: string;
  jobId: string | null;
  jobStatus: string;
  analysis?: JobAnalysis | null;
  speed: number;
  onProbe?: (sample: ProbeSample | null) => void;
  lastProbe?: ProbeSample | null;
  focusRequest?: { sample: ProbeSample; nonce: number } | null;
}

const FieldSkeleton = ({ label }: { label: string }) => (
  <div className="cfd-vtk-skeleton" aria-label={`Loading ${label}`} />
);

export function CfdLab({
  backendOnline, solverAvailable, field, onFieldChange,
  sceneLabel, cp, cpFromJob, chartNote, rotationX, rotationY, rotationZ, provenance, datasetUrl, jobId, jobStatus, analysis, speed, onProbe, lastProbe, focusRequest,
}: Props) {
  const [fields, setFields] = useState<FieldInfo[]>(fallbackFields);
  const [datasetCp, setDatasetCp] = useState<DerivedCp | null>(null);
  const activeField = resolveField(fields, field);

  const usingSolverCp = Boolean(cpFromJob && datasetCp);
  const effectiveCp = usingSolverCp ? datasetCp : cpFromJob ? undefined : cp;
  const cpData = effectiveCp ?? { upper: SAMPLE_UPPER, lower: SAMPLE_LOWER };
  const summary = summarizeCp(cpData.upper, cpData.lower);
  const sectionCn = effectiveCp
    ? sectionNormalForce(effectiveCp.upper, effectiveCp.lower)
    : chartNote || cpFromJob
    ? undefined
    : sectionNormalForce(SAMPLE_UPPER, SAMPLE_LOWER);

  // When a completed job is shown, use the solved surface's own speed estimate
  // for the free-stream strip instead of the preview speed slider.
  const solverSpeed =
    usingSolverCp && datasetCp && datasetCp.uRef > 0 ? datasetCp.uRef : null;
  const stream = freeStream(solverSpeed ?? speed);

  const cpSource: CpSource = usingSolverCp
    ? 'solver'
    : cpFromJob
    ? 'solver-missing'
    : cp
    ? 'scene'
    : 'sample';
  const chartTitle =
    cpSource === 'solver'
      ? 'Solved surface · Cp distribution (Cp vs x/c)'
      : `${sceneLabel} · Cp distribution (Cp vs x/c)`;
  const sourceText: Record<CpSource, string> = {
    solver: 'Pressure coefficient (Cp) derived from the solved surface pressure: (p − p_ref) / (½·U_ref²).',
    'solver-missing': 'The solved surface has no pressure field; showing the bundled sample.',
    scene: 'Generated preview · synthetic Cp, not solver output.',
    sample: 'Bundled sample · synthetic Cp, not solver output.',
  };

  const [viewerState, setViewerState] = useState<ViewerState>('loading');
  const [slowLoad, setSlowLoad] = useState(false);
  const [station, setStation] = useState(0.3);
  const [stationNonce, setStationNonce] = useState(0);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const href = window.location.href;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
    } catch {
      try {
        const field = document.createElement('textarea');
        field.value = href;
        field.setAttribute('readonly', '');
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        field.remove();
        setCopied(true);
      } catch {
        setCopied(false);
      }
    }
    window.setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    if (viewerState === 'ready') return;
    const t = setTimeout(() => setSlowLoad(true), 12_000);
    return () => clearTimeout(t);
  }, [viewerState]);

  const moveStation = (value: number) => {
    setStation(value);
    setStationNonce((n) => n + 1);
  };

  const probeStation = stationNonce > 0 ? { xc: station, nonce: stationNonce } : null;

  const readings = lastProbe?.readings && lastProbe.readings.length > 0
    ? lastProbe.readings
    : [
        { name: 'p', label: 'Pressure (p)', value: lastProbe ? lastProbe.p : Number.NaN },
        { name: 'U', label: '|U|', value: lastProbe ? lastProbe.u : Number.NaN },
        { name: 'T', label: 'Temperature (T)', value: lastProbe ? lastProbe.t : Number.NaN },
      ];

  return (
    <section className="cfd-lab">
      <header className="cfd-lab-head">
        <h2>CFD Laboratory</h2>
        <div className="cfd-lab-status">
          <SolverStatus
            status={backendOnline ? 'online' : 'offline'}
            solverAvailable={solverAvailable}
            variant="lab"
          />
          <label className="cfd-lab-field">
            Colour by
            <select
              value={activeField}
              onChange={(e) => onFieldChange(e.target.value)}
            >
              {fields.map((f) => (
                <option key={f.name} value={f.name}>{f.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="upload-btn cfd-share-btn"
            onClick={copyLink}
            title="Copy a link that restores this lab view"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </header>
      <LabCoachMark />
      <div className="cfd-lab-freestream" aria-label="Free-stream conditions">
        <span
          title={
            solverSpeed
              ? 'Estimated from the solved surface (maximum velocity magnitude), not the case inlet'
              : 'Preview-model free-stream velocity; a live solve uses its own case inlet'
          }
        >
          U∞ {stream.speed.toFixed(1)} m/s{solverSpeed ? ' (data)' : ''}
        </span>
        <span title="Reference chord">c {stream.chord.toFixed(1)} m</span>
        <span title="Reynolds number based on chord">Re {formatRe(stream.reynolds)}</span>
        <span title="Dynamic pressure">q∞ {Math.round(stream.dynamicPressure)} Pa</span>
        <span title="Static temperature">T∞ {stream.temperature.toFixed(0)} K</span>
        {sectionCn !== undefined && Number.isFinite(sectionCn) && (
          <span
            title={
              usingSolverCp
                ? 'Normal-force coefficient integrated from the solved surface Cp'
                : 'Section normal-force coefficient integrated from the plotted Cp (post-processed, not solver output)'
            }
          >
            Cn {sectionCn.toFixed(3)}
          </span>
        )}
      </div>
      {jobId && (
        <div className="cfd-job-status">Job {jobId.slice(0, 8)} · {jobStatus}</div>
      )}
      {analysis && (
        <div className="cfd-job-analysis" title="From the backend analysis endpoint for this completed job">
          <strong>Solver summary</strong> · {summarizeAnalysis(analysis)}
        </div>
      )}
      {viewerState !== 'ready' && (
        <div className="cfd-loading" role="status" aria-live="polite">
          <span className="cfd-loading-bar" aria-hidden="true" />
          <span>
            {viewerState === 'error'
              ? 'The 3D viewer failed to load.'
              : slowLoad
              ? 'Still loading the 3D viewer…'
              : 'Loading 3D viewer…'}
          </span>
          <button type="button" className="upload-reset" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
      <div className="cfd-lab-grid">
        <CfdVtkBoundary>
          <Suspense fallback={<FieldSkeleton label="VTK viewer" />}>
            <CfdVtkViewer
              datasetUrl={datasetUrl}
              field={activeField}
              rotationX={rotationX}
              rotationY={rotationY}
              rotationZ={rotationZ}
              onProbe={onProbe}
              onLoadState={setViewerState}
              onFieldsChange={setFields}
              onCpSample={setDatasetCp}
              freeStream={stream}
              sectionCn={sectionCn}
              focusRequest={focusRequest}
              probeStation={probeStation}
            />
          </Suspense>
        </CfdVtkBoundary>
        <div className="cfd-chart-cell">
          {effectiveCp ? (
            <Suspense fallback={<FieldSkeleton label="Cp chart" />}>
              <CpDistributionChart
                upper={effectiveCp.upper}
                lower={effectiveCp.lower}
                title={chartTitle}
                station={station}
              />
            </Suspense>
          ) : chartNote ? (
            <div className="cfd-chart-note">{chartNote}</div>
          ) : (
            <Suspense fallback={<FieldSkeleton label="Cp chart" />}>
              <CpDistributionChart
                upper={cpData.upper}
                lower={cpData.lower}
                title={chartTitle}
                station={station}
              />
            </Suspense>
          )}
          {!chartNote && (
            <>
              <p className="cfd-chart-source">{sourceText[cpSource]}</p>
              <p className="cfd-chart-summary">
                <span className="cfd-chart-summary-label">Chart summary</span> {summary.text}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="cfd-probe-panel">
        <label className="cfd-station">
          <span>Probe station x/c</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={station}
            aria-valuetext={`x/c ${station.toFixed(2)}`}
            onChange={(e) => moveStation(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                moveStation(Math.max(0, Number((station - 0.01).toFixed(2))));
              } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                moveStation(Math.min(1, Number((station + 0.01).toFixed(2))));
              }
            }}
          />
          <span className="cfd-station-value">{station.toFixed(2)}</span>
        </label>
        <button
          type="button"
          className="upload-btn cfd-probe-btn"
          onClick={() => moveStation(station)}
          aria-label="Probe station"
        >
          Probe
        </button>
        <table className="cfd-probe-table">
          <caption>
            {lastProbe
              ? `Probe sample at station x/c ${station.toFixed(2)}`
              : `Probe station x/c ${station.toFixed(2)} · no sample yet`}
          </caption>
          <thead>
            <tr><th scope="col">Quantity</th><th scope="col">Value</th></tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.name}>
                <th scope="row">{r.label}</th>
                <td>{Number.isFinite(r.value) ? fmtProbe(r.value) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!lastProbe && (
          <p className="cfd-probe-hint">
            Choose Probe, move the slider, or click the 3D surface to read p, |U|, and T.
          </p>
        )}
      </div>

      <details className="cfd-glossary">
        <summary>What am I looking at?</summary>
        <dl>
          <dt>Colour by</dt>
          <dd>Maps one field to colour; the legend shows its low-to-high range. Vector fields are shown by magnitude.</dd>
          <dt>Probe</dt>
          <dd>Samples one point: click the surface, or move the probe-station slider. The canvas card and the table show the values.</dd>
          <dt>Velocity vectors</dt>
          <dd>Arrow glyphs showing the stored velocity direction, coloured by speed |U|. These are surface vectors, not streamlines.</dd>
          <dt>Cp distribution</dt>
          <dd>Pressure coefficient (Cp) against chord position (x/c). A completed live job derives it from the solved surface pressure; previews use synthetic data.</dd>
          <dt>Live solve vs preview</dt>
          <dd>Live solve runs simpleFoam on the bundled 2D channel case. NACA and uploaded models are synthetic previews, not solver results.</dd>
          <dt>Export</dt>
          <dd>VTP (VTK PolyData) is the mesh plus fields; CSV (comma-separated values) is the point table; probe JSON adds the free-stream and probe context.</dd>
        </dl>
      </details>

      <p className="cfd-lab-credit">
        {sceneLabel}
        {backendOnline ? '' : ' · static demo'}
      </p>
      <p className="cfd-lab-provenance">{provenance}</p>
    </section>
  );
}
