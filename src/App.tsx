import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { NavBar } from './components/NavBar';
import { Sidebar } from './components/Sidebar';
import { BackendBadge } from './components/BackendBadge';
import { type DevicePick, type DetectedDevice } from './components/DevicePanel';
import { Hero } from './sections/Hero';
import { ReadmeSection } from './sections/ReadmeSection';
import { ProjectShowcase } from './sections/ProjectShowcase';
import { useBackendProbe } from './hooks/useBackendProbe';
import { useSketchForgeProbe } from './hooks/useSketchForgeProbe';
import type { SceneContent } from './data/scene';
import { buildSceneLab, type SceneLab } from './lib/sceneVtp';
import type { ProbeSample } from './lib/probe';

export type CfdField = 'p' | 'U' | 'T';

const STATIC_DEMO_DATASET = `${import.meta.env.BASE_URL}demo/surface.vtp`;

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

  const [devicePick, setDevicePick] = useState<DevicePick>(() => detectDevice());
  const [detectedDevice, setDetectedDevice] = useState<DetectedDevice>(detectDevice);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [heroTab, setHeroTab] = useState<'overview' | 'lab'>('overview');
  const [lastProbe, setLastProbe] = useState<ProbeSample | null>(null);
  const [sceneContent, setSceneContent] = useState<SceneContent>({ kind: 'default', token: 0 });
  const [flow, setFlow] = useState(true);
  const [speed, setSpeed] = useState(2.0);
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);

  const [cfdField, setCfdField] = useState<CfdField>('p');
  const [cfdJobId, setCfdJobId] = useState<string | null>(null);
  const [cfdJobStatus, setCfdJobStatus] = useState<string>('idle');
  const [cfdError, setCfdError] = useState<string | null>(null);
  const [cfdJobDatasetUrl, setCfdJobDatasetUrl] = useState<string | null>(null);

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
    const url = tab === 'lab' ? '#cfd' : `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', url);
    if (tab === 'overview') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Poll active job
  useEffect(() => {
    if (!cfdJobId || !backend.backendOrigin) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${backend.backendOrigin}/api/jobs/${cfdJobId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setCfdJobStatus(data.status);
        if (data.status === 'completed') {
          setCfdJobDatasetUrl(`${backend.backendOrigin}/api/jobs/${cfdJobId}/surface.vtp`);
        } else if (data.status !== 'failed') {
          setTimeout(poll, 1500);
        }
      } catch (err) {
        if (!cancelled) setCfdError(err instanceof Error ? err.message : 'Poll failed');
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [cfdJobId, backend.backendOrigin]);

  const startCfdSolve = async () => {
    if (!backend.backendOrigin) return;
    setCfdError(null);
    setCfdJobStatus('submitting');
    try {
      const res = await fetch(`${backend.backendOrigin}/api/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: 'naca0012' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCfdJobId(data.job_id);
      setCfdJobStatus('queued');
    } catch (err) {
      setCfdError(err instanceof Error ? err.message : 'Submit failed');
      setCfdJobStatus('idle');
    }
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
          onClose={() => setSidebarOpen(false)}
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
          backendUrl={backend.backendOrigin}
          solverAvailable={backend.solverAvailable}
          onBackendRetry={backend.probe}
          cfdJobId={cfdJobId}
          cfdJobStatus={cfdJobStatus}
          cfdError={cfdError}
          onCfdSolve={startCfdSolve}
          lastProbe={lastProbe}
        />
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}
        <main className="app-main">
          <div className="backend-badge-wrapper">
            <BackendBadge
              status={backend.status}
              reason={backend.reason}
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
                  chartNote={sceneLab?.kind === 'model' ? '3D model · field-colored surface (the Cp chart applies to airfoils)' : undefined}
                  datasetUrl={labDatasetUrl}
                  jobId={backendOnline ? cfdJobId : null}
                  jobStatus={backendOnline ? cfdJobStatus : 'static'}
                  speed={speed}
                  onProbe={setLastProbe}
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
