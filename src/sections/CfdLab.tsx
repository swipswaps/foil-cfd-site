import { useState } from 'react';
import { CfdVtkViewer } from '../components/CfdVtkViewer';
import { CpPolarChart } from '../components/CpPolarChart';

interface Props {
  backendOnline: boolean;
  datasetUrl: string;
}

export function CfdLab({ backendOnline, datasetUrl }: Props) {
  const [solving, setSolving] = useState(false);
  const [solveMsg, setSolveMsg] = useState('');

  const runSolver = async () => {
    setSolving(true);
    setSolveMsg('Running OpenFOAM simpleFoam & PyVista extraction...');
    try {
      const backendPort = typeof window !== 'undefined' ? (window.location.port === '5173' || window.location.port === '4173' || window.location.port === '4174' ? '8002' : window.location.port) : '8002';
      const res = await fetch(`http://127.0.0.1:${backendPort}/api/solve`, { method: 'POST' });
      const data = await res.json();
      setSolveMsg(data.message || 'Solver completed successfully.');
    } catch (err) {
      setSolveMsg('Solver execution failed (backend unreachable).');
    } finally {
      setSolving(false);
    }
  };

  return (
    <section id="cfd-lab" className="cfd-laboratory-section" style={{ padding: '3rem 1.5rem', background: '#071728', borderTop: '1px solid #1E3A4A' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', color: '#E2F4FF', marginBottom: '0.5rem' }}>
            OpenFOAM & PyVista Scientific Laboratory
          </h2>
          <p style={{ color: '#7FB6D4', fontSize: '0.95rem', marginBottom: '1rem' }}>
            {backendOnline
              ? 'Connected to Docker OpenFOAM Solver Backend. Live 3D surface mesh & pressure distributions.'
              : 'Docker backend offline (showing pre-computed OpenFOAM datasets). Start backend container for live solving.'}
          </p>
          <button
            onClick={runSolver}
            disabled={solving || !backendOnline}
            style={{
              background: backendOnline ? '#5BC0EB' : '#38536E',
              color: '#0B2545',
              border: 'none',
              padding: '0.6rem 1.2rem',
              borderRadius: '4px',
              fontWeight: 600,
              cursor: backendOnline ? 'pointer' : 'not-allowed',
            }}
          >
            {solving ? 'Running Solver...' : 'Run OpenFOAM Solver & PyVista Extract ↗'}
          </button>
          {solveMsg && <p style={{ color: '#A6D9F0', fontSize: '0.85rem', marginTop: '0.5rem' }}>{solveMsg}</p>}
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem' }}>
          <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #1E3A4A' }}>
            <CfdVtkViewer datasetUrl={datasetUrl} />
          </div>
          <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #1E3A4A', background: '#0B2545', padding: '0.5rem' }}>
            <CpPolarChart />
          </div>
        </div>
      </div>
    </section>
  );
}
