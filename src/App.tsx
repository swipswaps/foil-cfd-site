import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { NavBar } from './components/NavBar';
import { Sidebar } from './components/Sidebar';
import { BackendBadge } from './components/BackendBadge';
import { type DevicePick, type DetectedDevice } from './components/DevicePanel';
import { Hero } from './sections/Hero';
import { ReadmeSection } from './sections/ReadmeSection';
import { ProjectShowcase } from './sections/ProjectShowcase';
import { useBackendProbe } from './hooks/useBackendProbe';
import { useSketchForgeProbe } from './hooks/useSketchForgeProbe';
import { backendFetch } from './lib/backendFetch';
import type { SceneContent } from './data/scene';
import { buildSceneLab, type SceneLab } from './lib/sceneVtp';
import { buildLabSearch, parseLabUrl } from './lib/labUrl';
import type { ProbeSample } from './lib/probe';
import type { JobAnalysis } from './lib/analysis';

export type CfdField = string;

const STATIC_DEMO_DATASET = `${import.meta.env.BASE_URL}demo/surface.vtp`;
const POLL_INTERVAL_MS = 1_500;
const POLL_RETRY_INTERVAL_MS = 2_000;
const POLL_MAX_ERRORS = 5;

const loadCfdLab = () => import('./sections/CfdLab');

const CfdLab = lazy(() =>
  loadCfdLab().then((m) => ({ default: m.CfdLab }))
);

function detectDevice(): DetectedDevice {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const touchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;
  const isTouchDevice = coarse || touchPoints > 0;

  if (w < 640) return 'phone';
  if (isTouchDevice && w < 1100) return 'tablet';
  return 'desktop';
}

function jobStepLabel(status: string): string {
  switch (status) {
    case 'submitting':
      return 'Submitting';
    case 'queued':
      return 'Meshing';
    case 'running':
      return 'Solving';
    case 'completed':
      return 'Post-processing';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return '';
  }
}

function initialField(): CfdField {
  try {
    const saved = window.localStorage.getItem('foil.field');
    if (saved && saved.trim()) return saved;
  } catch {
    /* private mode */
  }
  return 'p';
}

function CfdLabSkeleton() {
  return (
    <section className="cfd-lab">
      <header className="cfd-lab-head">
        <h2>CFD Laboratory</h2>
        <div className="cfd-lab-status"><span>Loading scientific viewer…</span></div>
      </header>
      <div className="cfd-lab-grid">
        <div className="cfd-vtk-skeleton" />
        <div className="cfd-vtk-skeleton" />
      </div>
    </section>
  );
}

export default function App() {
  const backend = useBackendProbe();
  const cad = useSketchForgeProbe();

  const initialUrl = useMemo(
    () => parseLabUrl(typeof window === 'undefined' ? '' : window.location.search),
    [],
  );

  const [devicePick, setDevicePick] = useState<DevicePick>(() => detectDevice());
  const [detectedDevice, setDetectedDevice] = useState<DetectedDevice>(detectDevice);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [heroTab, setHeroTab] = useState<'overview' | 'lab'>(() =>
    typeof window !== 'undefined' && window.location.hash === '#cfd' ? 'lab' : 'overview',
  );
  const [lastProbe, setLastProbe] = useState<ProbeSample | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ sample: ProbeSample; nonce: number } | null>(null);
  const [sceneContent, setSceneContent] = useState<SceneContent>(() =>
    initialUrl.naca
      ? { kind: 'naca', code: initialUrl.naca, token: 1 }
      : { kind: 'default', token: 0 },
  );
  const [flow, setFlow] = useState(() => initialUrl.flow ?? true);
  const [speed, setSpeed] = useState(() => initialUrl.speed ?? 2.0);
  const [rotationX, setRotationX] = useState(() => initialUrl.rotX ?? 0);
  const [rotationY, setRotationY] = useState(() => initialUrl.rotY ?? 0);
  const [rotationZ, setRotationZ] = useState(() => initialUrl.rotZ ?? 0);

  const [cfdField, setCfdField] = useState<CfdField>(() => initialUrl.field ?? initialField());
  const [cfdJobId, setCfdJobId] = useState<string | null>(() => initialUrl.job ?? null);
  const [cfdJobStatus, setCfdJobStatus] = useState<string>(() => (initialUrl.job ? 'queued' : 'idle'));
  const [cfdError, setCfdError] = useState<string | null>(null);
  const [cfdJobDatasetUrl, setCfdJobDatasetUrl] = useState<string | null>(null);
  const [cfdStartedAt, setCfdStartedAt] = useState<number | null>(null);
  const [cfdElapsed, setCfdElapsed] = useState(0);
  const [cfdConnectionLost, setCfdConnectionLost] = useState(false);
  const [cfdAnalysis, setCfdAnalysis] = useState<JobAnalysis | null>(null);
  const [cfdPollNonce, setCfdPollNonce] = useState(0);

  const sceneLab = useMemo<SceneLab | null>(() => {
    try {
      return buildSceneLab(sceneContent);
    } catch {
      return null;
    }
  }, [sceneContent]);
  useEffect(() => {
    if (!sceneLab) return;
    return () => sceneLab.revoke();
  }, [sceneLab]);

  useEffect(() => {
    try {
      window.localStorage.setItem('foil.field', cfdField);
    } catch {
      /* private mode */
    }
  }, [cfdField]);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    requestAnimationFrame(() => document.getElementById('nav-burger')?.focus());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSidebar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeSidebar]);

  useEffect(() => {
    const apply = () => {
      if (window.location.hash === '#cfd') {
        setHeroTab('lab');
        requestAnimationFrame(() => document.getElementById('cfd')?.scrollIntoView({ block: 'start' }));
      } else {
        setHeroTab('overview');
      }
    };
    const raf = requestAnimationFrame(apply);
    window.addEventListener('hashchange', apply);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('hashchange', apply);
    };
  }, []);

  const handleHeroTab = (tab: 'overview' | 'lab') => {
    setHeroTab(tab);
    if (tab === 'overview') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Keep shareable lab state in the URL. The `#cfd` hash still marks the lab
  // tab; other anchors (for example #projects) are preserved.
  useEffect(() => {
    const search = buildLabSearch({
      field: cfdField,
      naca: sceneContent.kind === 'naca' ? sceneContent.code : undefined,
      speed,
      flow,
      rotX: rotationX,
      rotY: rotationY,
      rotZ: rotationZ,
      job: cfdJobId ?? undefined,
    });
    const currentHash = window.location.hash;
    const hash =
      heroTab === 'lab' ? '#cfd' : currentHash === '#cfd' ? '' : currentHash;
    const next = `${window.location.pathname}${search}${hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, '', next);
  }, [cfdField, sceneContent, speed, flow, rotationX, rotationY, rotationZ, cfdJobId, heroTab]);

  const effectiveDevice: DetectedDevice =
    devicePick === 'auto' ? detectedDevice : devicePick;

  // Derived — never null when backend online. No effect needed.
  const datasetUrl =
    cfdJobDatasetUrl ??
    (backend.backendOrigin
      ? `${backend.backendOrigin}/api/jobs/default/surface.vtp`
      : null);

  useEffect(() => {
    const update = () => setDetectedDevice(detectDevice());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-device', effectiveDevice);
    document.documentElement.setAttribute('data-sidebar', sidebarOpen ? 'open' : 'closed');
  }, [effectiveDevice, sidebarOpen]);

  // Lock body scroll while the drawer is open (mobile and overlay layouts).
  useEffect(() => {
    if (!sidebarOpen) return;
    document.body.classList.add('sidebar-locked');
    return () => document.body.classList.remove('sidebar-locked');
  }, [sidebarOpen]);

  const cfdActive =
    cfdJobStatus === 'submitting' || cfdJobStatus === 'queued' || cfdJobStatus === 'running';

  // Elapsed seconds tick while a solve is active.
  useEffect(() => {
    if (cfdStartedAt == null || !cfdActive) return;
    const tick = () => setCfdElapsed(Math.max(0, Math.floor((Date.now() - cfdStartedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cfdStartedAt, cfdActive]);

  // Poll the active job with a bounded retry so a dropped connection is visible
  // instead of silently stopping the update loop.
  useEffect(() => {
    if (!cfdJobId || !backend.backendOrigin) return;
    if (!cfdActive) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let errors = 0;
    const origin = backend.backendOrigin;

    const poll = async () => {
      try {
        const res = await backendFetch(`${origin}/api/jobs/${cfdJobId}`);
        if (res.status === 404) {
          if (cancelled) return;
          setCfdJobStatus('failed');
          setCfdConnectionLost(false);
          setCfdError('That saved job is no longer available. Run a new solve.');
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        errors = 0;
        setCfdConnectionLost(false);
        setCfdJobStatus(data.status);
        if (data.status === 'completed') {
          setCfdJobDatasetUrl(`${origin}/api/jobs/${cfdJobId}/surface.vtp`);
        } else if (data.status === 'failed') {
          setCfdError(typeof data.error === 'string' && data.error ? data.error : 'The solver reported a failure.');
        } else {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch {
        if (cancelled) return;
        errors += 1;
        setCfdConnectionLost(true);
        if (errors < POLL_MAX_ERRORS) {
          timer = setTimeout(poll, POLL_RETRY_INTERVAL_MS);
        } else {
          setCfdError(
            'Lost connection to the local solver. The job may still be running on the host; reconnect to check.',
          );
        }
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [cfdJobId, backend.backendOrigin, cfdActive, cfdPollNonce]);

  // Fetch the solver summary once a job completes. Kept separate from the poll
  // so the status change to "completed" cannot cancel the supplementary fetch.
  useEffect(() => {
    if (cfdJobStatus !== 'completed' || !cfdJobId || !backend.backendOrigin) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await backendFetch(`${backend.backendOrigin}/api/jobs/${cfdJobId}/analysis`);
        if (!cancelled && res.ok) {
          setCfdAnalysis((await res.json()) as JobAnalysis);
        }
      } catch {
        /* analysis is supplementary; a failure must not block the surface */
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [cfdJobStatus, cfdJobId, backend.backendOrigin]);

  const startCfdSolve = async () => {
    if (!backend.backendOrigin) return;
    const started = Date.now();
    setCfdError(null);
    setCfdConnectionLost(false);
    setCfdJobDatasetUrl(null);
    setCfdAnalysis(null);
    setCfdJobStatus('submitting');
    setCfdStartedAt(started);
    setCfdElapsed(0);
    setCfdJobId(null);
    try {
      const res = await backendFetch(`${backend.backendOrigin}/api/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: 'naca0012' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCfdJobId(data.job_id);
      setCfdJobStatus('queued');
    } catch (err) {
      setCfdError(err instanceof Error ? err.message : 'Could not start the solve.');
      setCfdJobStatus('failed');
      setCfdElapsed(Math.floor((Date.now() - started) / 1000));
    }
  };

  const cancelCfdSolve = () => {
    setCfdJobStatus('cancelled');
    setCfdConnectionLost(false);
    setCfdError(null);
  };

  const retryCfdPoll = () => {
    setCfdConnectionLost(false);
    setCfdError(null);
    setCfdPollNonce((n) => n + 1);
  };

  const handleRotation = (axis: 'x' | 'y' | 'z', v: number) => {
    if (axis === 'x') setRotationX(v);
    else if (axis === 'y') setRotationY(v);
    else setRotationZ(v);
  };
  const resetRotation = () => { setRotationX(0); setRotationY(0); setRotationZ(0); };

  const backendOnline = backend.status === 'online' && !!backend.backendOrigin;
  const labDatasetUrl = sceneLab?.url ?? (backendOnline && datasetUrl ? datasetUrl : STATIC_DEMO_DATASET);
  const labLabel = sceneLab?.label ?? (backendOnline ? 'Backend dataset' : 'Sample wing');
  const provenance = sceneLab
    ? `${sceneLab.kind === 'model' ? 'Uploaded model' : 'NACA'} · generated ${new Date(sceneLab.generatedAt).toLocaleString()}`
    : backendOnline
      ? `Backend · ${cfdJobId ? `job ${cfdJobId.slice(0, 8)}` : 'default dataset'}`
      : 'Static demo · bundled sample';

  return (
    <div className="app-shell">
      <div className={`app-frame device-${effectiveDevice}`}>
        <NavBar
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
        />
        <Sidebar
          open={sidebarOpen}
          onClose={closeSidebar}
          devicePick={devicePick}
          detectedDevice={detectedDevice}
          onDeviceChange={setDevicePick}
          sceneContent={sceneContent}
          onSceneChange={setSceneContent}
          flow={flow}
          onFlowChange={setFlow}
          speed={speed}
          onSpeedChange={setSpeed}
          rotationX={rotationX}
          rotationY={rotationY}
          rotationZ={rotationZ}
          onRotationChange={handleRotation}
          onRotationReset={resetRotation}
          cadStatus={cad.status}
          cadUrl={cad.url}
          onCadRetry={cad.probe}
          backendMode={backend.mode}
          backendStatus={backend.status}
          backendUrl={backend.backendOrigin}
          solverAvailable={backend.solverAvailable}
          onBackendRetry={backend.probe}
          cfdJobId={cfdJobId}
          cfdJobStatus={cfdJobStatus}
          cfdJobStep={jobStepLabel(cfdJobStatus)}
          cfdElapsed={cfdElapsed}
          cfdConnectionLost={cfdConnectionLost}
          cfdError={cfdError}
          onCfdSolve={startCfdSolve}
          onCfdCancel={cancelCfdSolve}
          onCfdRetry={startCfdSolve}
          onCfdRetryPoll={retryCfdPoll}
          lastProbe={lastProbe}
          onFocusProbe={() => { if (lastProbe) setFocusRequest({ sample: lastProbe, nonce: Date.now() }); }}
        />
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={closeSidebar} aria-hidden="true" />
        )}
        <main className="app-main">
          <div className="backend-badge-wrapper">
            <BackendBadge
              status={backend.status}
              reason={backend.reason}
              solverAvailable={backend.solverAvailable}
              connected={backendOnline}
              actionLabel={backend.actionLabel}
              onRetry={backend.probe}
            />
          </div>
          <Hero
            content={sceneContent}
            flow={flow}
            speed={speed}
            rotationX={rotationX}
            rotationY={rotationY}
            rotationZ={rotationZ}
            tab={heroTab}
            onTabChange={handleHeroTab}
            onPrefetchLab={loadCfdLab}
            lab={(
              <Suspense fallback={<CfdLabSkeleton />}>
                <CfdLab
                  backendOnline={backendOnline}
                  solverAvailable={backendOnline && backend.solverAvailable}
                  field={cfdField}
                  onFieldChange={setCfdField}
                  sceneLabel={labLabel}
                  cp={sceneLab?.cp}
                  cpFromJob={Boolean(cfdJobDatasetUrl)}
                  chartNote={sceneLab?.kind === 'model' ? '3D model · field-colored surface (the Cp chart applies to airfoils)' : undefined}
                  datasetUrl={labDatasetUrl}
                  jobId={backendOnline ? cfdJobId : null}
                  jobStatus={backendOnline ? cfdJobStatus : 'static'}
                  analysis={cfdAnalysis}
                  speed={speed}
                  onProbe={setLastProbe}
                  lastProbe={lastProbe}
                  focusRequest={focusRequest}
                  rotationX={rotationX}
                  rotationY={rotationY}
                  rotationZ={rotationZ}
                  provenance={provenance}
                />
              </Suspense>
            )}
          />
          <ReadmeSection />
          <ProjectShowcase />
          <footer className="footer">
            <span className="footer-brand">
              FOIL<span className="footer-brand-dot">.CFD</span>
            </span>
            ·{' '}
            <a
              href="https://github.com/swipswaps/foil-cfd-site"
              target="_blank"
              rel="noreferrer"
              className="footer-link"
            >
              GitHub
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
