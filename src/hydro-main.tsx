import React, { useMemo, useState, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useBackendProbe } from './hooks/useBackendProbe';

interface HydroParams {
  speedKnots: number;
  aoaDeg: number;
  depthMeters: number;
  spanMeters: number;
  chordMeters: number;
  waterTempC: number;
}

function computeHydroMetrics(p: HydroParams) {
  const rho = 1025.0;
  const g = 9.80665;
  const pAtm = 101325.0;
  const pv = 610.78 * Math.exp((17.27 * p.waterTempC) / (p.waterTempC + 237.3));
  const vMs = p.speedKnots * 0.514444;
  const q = 0.5 * rho * vMs * vMs;
  const pLocal = pAtm + rho * g * p.depthMeters;
  const sigma = q > 1 ? (pLocal - pv) / q : 99.9;

  const ar = p.spanMeters / Math.max(0.05, p.chordMeters);
  const alphaRad = (p.aoaDeg * Math.PI) / 180;
  const alphaZeroLift = (-2.2 * Math.PI) / 180;
  const cl2d = 2 * Math.PI * (alphaRad - alphaZeroLift);
  const cl = cl2d / (1 + 2 / Math.max(1.5, ar));

  const cd0 = 0.0115;
  const cdi = (cl * cl) / (Math.PI * 0.88 * Math.max(1.5, ar));
  const cd = cd0 + cdi;

  const area = p.spanMeters * p.chordMeters;
  const liftN = q * area * cl;
  const dragN = q * area * cd;
  const ldRatio = cd > 0 ? cl / cd : 0;

  const negCpMin = Math.max(0.15, 0.38 + 0.72 * Math.abs(cl) + 0.045 * Math.max(0, p.aoaDeg - 4) ** 1.35);
  const cavitating = negCpMin >= sigma;
  const margin = sigma - negCpMin;

  const stations = Array.from({ length: 25 }, (_, i) => {
    const xc = i / 24;
    const lePeak = Math.exp(-Math.pow((xc - 0.12) / 0.14, 2));
    const midBody = Math.sin(Math.PI * xc);
    const cpUpper = -(negCpMin * lePeak + 0.42 * cl * midBody * (1 - xc));
    const cpLower = 0.35 * cl * (1 - xc * 0.85) - 0.12 * midBody;
    return { xc, cpUpper, cpLower };
  });

  return { vMs, q, sigma, cl, cd, liftN, liftKgf: liftN / g, dragN, ldRatio, negCpMin, cavitating, margin, stations };
}

function HydrofoilAssembly({ aoaDeg, speedKnots, cavitating }: { aoaDeg: number; speedKnots: number; cavitating: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const foilGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const pts = 48;
    for (let i = 0; i <= pts; i++) {
      const t = i / pts;
      const yt = 5 * 0.12 * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t * t * t - 0.1015 * t * t * t * t);
      const yc = 0.02 * Math.sin(Math.PI * t);
      const x = (t - 0.35) * 2.2;
      const y = (yc + yt) * 2.2;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    for (let i = pts; i >= 0; i--) {
      const t = i / pts;
      const yt = 5 * 0.12 * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t * t * t - 0.1015 * t * t * t * t);
      const yc = 0.02 * Math.sin(Math.PI * t);
      const x = (t - 0.35) * 2.2;
      const y = (yc - yt) * 2.2;
      shape.lineTo(x, y);
    }
    const extrude = new THREE.ExtrudeGeometry(shape, { depth: 4.6, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3 });
    extrude.translate(0, 0, -2.3);
    return extrude;
  }, []);

  const particlePositions = useMemo(() => {
    const count = 420;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 4.5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 5.2;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      const targetRot = (-aoaDeg * Math.PI) / 180;
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRot, 0.14);
    }
    if (particlesRef.current) {
      const pos = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const vx = Math.max(0.8, speedKnots * 0.22);
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i) + vx * delta;
        if (x > 6) x = -6;
        pos.setX(i, x);
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 8, 6]} intensity={1.35} color="#BAE6FD" />
      <pointLight position={[-4, -3, -4]} intensity={0.6} color="#0284C7" />
      <mesh position={[0, 1.85, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[14, 9]} />
        <meshStandardMaterial color="#0EA5E9" transparent opacity={0.14} side={THREE.DoubleSide} />
      </mesh>
      <group ref={groupRef}>
        <mesh geometry={foilGeometry}>
          <meshStandardMaterial color={cavitating ? '#F97316' : '#38BDF8'} metalness={0.55} roughness={0.25} />
        </mesh>
        <mesh position={[0.15, 0.95, 0]}>
          <boxGeometry args={[0.55, 1.85, 0.09]} />
          <meshStandardMaterial color="#0F2942" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.055} color={cavitating ? '#FDBA74' : '#7DD3FC'} transparent opacity={0.78} />
      </points>
      <OrbitControls enablePan={false} minDistance={4.2} maxDistance={13} />
    </>
  );
}

function CpCavitationChart({ stations, sigma, cavitating }: { stations: any[]; sigma: number; cavitating: boolean }) {
  const w = 540; const h = 230; const padL = 46; const padR = 16; const padT = 18; const padB = 30;
  const innerW = w - padL - padR; const innerH = h - padT - padB;
  const minCp = Math.min(-3.0, -sigma - 0.4, ...stations.map((s) => s.cpUpper));
  const maxCp = 1.2;
  const mapX = (xc: number) => padL + xc * innerW;
  const mapY = (cp: number) => padT + ((cp - minCp) / (maxCp - minCp)) * innerH;
  const upperPath = stations.map((s, i) => `${i === 0 ? 'M' : 'L'} ${mapX(s.xc).toFixed(1)} ${mapY(s.cpUpper).toFixed(1)}`).join(' ');
  const lowerPath = stations.map((s, i) => `${i === 0 ? 'M' : 'L'} ${mapX(s.xc).toFixed(1)} ${mapY(s.cpLower).toFixed(1)}`).join(' ');
  const cavY = mapY(-sigma);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <rect x={0} y={0} width={w} height={h} rx={8} fill="#07192B" />
      {cavY > padT && <rect x={padL} y={padT} width={innerW} height={Math.min(innerH, Math.max(0, cavY - padT))} fill="rgba(249, 115, 22, 0.14)" />}
      <line x1={padL} y1={mapY(0)} x2={w - padR} y2={mapY(0)} stroke="#1E3A5F" strokeDasharray="3 3" />
      {cavY >= padT && cavY <= h - padB && (
        <>
          <line x1={padL} y1={cavY} x2={w - padR} y2={cavY} stroke={cavitating ? '#F97316' : '#FACC15'} strokeWidth={1.6} strokeDasharray="5 4" />
          <text x={padL + 6} y={Math.max(padT + 12, cavY - 5)} fill="#FACC15" fontSize="10.5">Cavitation Limit (-σ = -{sigma.toFixed(2)})</text>
        </>
      )}
      <path d={upperPath} fill="none" stroke="#38BDF8" strokeWidth={2.4} />
      <path d={lowerPath} fill="none" stroke="#34D399" strokeWidth={2} />
      <text x={padL} y={h - 8} fill="#7FB6D4" fontSize="10.5">Leading Edge (x/c = 0)</text>
      <text x={w - padR - 95} y={h - 8} fill="#7FB6D4" fontSize="10.5">Trailing Edge (1.0)</text>
      <text x={8} y={padT + 10} fill="#7FB6D4" fontSize="10.5">-Cp</text>
    </svg>
  );
}

function HydroApp() {
  const [params, setParams] = useState<HydroParams>({ speedKnots: 22, aoaDeg: 4.5, depthMeters: 0.65, spanMeters: 0.92, chordMeters: 0.14, waterTempC: 18 });
  const backend = useBackendProbe();

  const m = useMemo(() => computeHydroMetrics(params), [params]);

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif', minHeight: '100vh', background: '#061320', color: '#E2F4FF' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.75rem', borderBottom: '1px solid #16324F', background: '#081829', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <strong style={{ fontSize: '1.15rem', letterSpacing: '0.04em', color: '#38BDF8' }}>HYDRO.FOIL.CFD</strong>
          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: '999px', background: '#0F2942', color: '#7DD3FC' }}>Marine · e-Foil · AUV Hydrodynamics</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem' }}>
          <a href="./index.html" style={{ color: '#93C5FD', textDecoration: 'none' }}>← Core FOIL.CFD Hub</a>
          <button
            type="button"
            onClick={backend.probe}
            title={backend.status === 'offline' ? backend.reason : undefined}
            style={{ padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.78rem', font: 'inherit', cursor: backend.status === 'online' ? 'default' : 'pointer', background: backend.status === 'online' ? 'rgba(16,185,129,0.16)' : 'rgba(148,163,184,0.14)', color: backend.status === 'online' ? '#34D399' : '#94A3B8', border: `1px solid ${backend.status === 'online' ? '#059669' : '#334155'}` }}
          >
            {backend.status === 'online'
              ? `Local OpenFOAM/VTK Node Online (${backend.backendOrigin.replace(/^https?:\/\//, '')})`
              : backend.status === 'probing'
              ? 'Detecting local solver…'
              : 'Static Cavitation Preview Mode'}
          </button>
        </div>
      </header>
      <main style={{ maxWidth: '1240px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        <section style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.1rem', margin: '0 0 0.6rem', color: '#F0F9FF' }}>Cavitation-Safe Hydrofoil &amp; Subsea Wing Engineering</h1>
          <p style={{ maxWidth: '780px', color: '#94C3DF', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
            Screen e-foil wings, America&apos;s Cup T-foils, and AUV hydroplanes before cutting carbon or CNC tooling. Inspect 3D flow geometry, lift-to-drag polars, and real-time cavitation inception margins in your browser—then burst full 3D RANS meshes to your local Docker OpenFOAM solver.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            <button onClick={() => setParams({ speedKnots: 20, aoaDeg: 4.2, depthMeters: 0.55, spanMeters: 0.88, chordMeters: 0.15, waterTempC: 20 })} style={{ background: '#0F2942', color: '#E0F2FE', border: '1px solid #1E4976', padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: 'pointer' }}>Preset: e-Foil Cruiser (20 kt)</button>
            <button onClick={() => setParams({ speedKnots: 38, aoaDeg: 2.6, depthMeters: 1.1, spanMeters: 1.65, chordMeters: 0.16, waterTempC: 16 })} style={{ background: '#0F2942', color: '#E0F2FE', border: '1px solid #1E4976', padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: 'pointer' }}>Preset: High-Speed Racing T-Foil (38 kt)</button>
            <button onClick={() => setParams({ speedKnots: 8, aoaDeg: 5.5, depthMeters: 15.0, spanMeters: 0.65, chordMeters: 0.12, waterTempC: 10 })} style={{ background: '#0F2942', color: '#E0F2FE', border: '1px solid #1E4976', padding: '0.45rem 0.9rem', borderRadius: '6px', cursor: 'pointer' }}>Preset: Subsea AUV Hydroplane (15 m depth)</button>
          </div>
        </section>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <div style={{ background: '#081A2C', border: '1px solid #16324F', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '320px', position: 'relative', background: '#040E18' }}>
              <Canvas camera={{ position: [0, 1.4, 5.6], fov: 44 }}>
                <HydrofoilAssembly aoaDeg={params.aoaDeg} speedKnots={params.speedKnots} cavitating={m.cavitating} />
              </Canvas>
              <div style={{ position: 'absolute', top: '10px', left: '12px', fontSize: '0.78rem', background: 'rgba(6, 19, 32, 0.82)', padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #1E3A5F' }}>
                Drag to orbit · Scroll to zoom · Free-surface at +{params.depthMeters.toFixed(2)} m
              </div>
            </div>
            <div style={{ padding: '1.15rem', display: 'grid', gap: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>Boat / Vehicle Speed</span><strong>{params.speedKnots.toFixed(1)} kt ({m.vMs.toFixed(2)} m/s)</strong></div>
                <input type="range" min={4} max={48} step={0.5} value={params.speedKnots} onChange={(e) => setParams({ ...params, speedKnots: Number(e.target.value) })} style={{ width: '100%' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>Angle of Attack (α)</span><strong>{params.aoaDeg.toFixed(1)}°</strong></div>
                <input type="range" min={-2} max={12} step={0.2} value={params.aoaDeg} onChange={(e) => setParams({ ...params, aoaDeg: Number(e.target.value) })} style={{ width: '100%' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}><span>Submergence Depth (h)</span><strong>{params.depthMeters.toFixed(2)} m</strong></div>
                <input type="range" min={0.15} max={20} step={0.05} value={params.depthMeters} onChange={(e) => setParams({ ...params, depthMeters: Number(e.target.value) })} style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}><span>Span (b)</span><strong>{params.spanMeters.toFixed(2)} m</strong></div>
                  <input type="range" min={0.4} max={2.2} step={0.02} value={params.spanMeters} onChange={(e) => setParams({ ...params, spanMeters: Number(e.target.value) })} style={{ width: '100%' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}><span>Mean Chord (c)</span><strong>{params.chordMeters.toFixed(2)} m</strong></div>
                  <input type="range" min={0.08} max={0.35} step={0.01} value={params.chordMeters} onChange={(e) => setParams({ ...params, chordMeters: Number(e.target.value) })} style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </div>
          <div style={{ background: '#081A2C', border: '1px solid #16324F', borderRadius: '10px', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ padding: '0.85rem 1rem', borderRadius: '8px', background: m.cavitating ? 'rgba(249, 115, 22, 0.16)' : 'rgba(16, 185, 129, 0.14)', border: `1px solid ${m.cavitating ? '#F97316' : '#10B981'}` }}>
              <div style={{ fontWeight: 700, color: m.cavitating ? '#FDBA74' : '#6EE7B7', fontSize: '0.95rem' }}>
                {m.cavitating ? `⚠ CAVITATION INCEPTION DETECTED (-Cp,min = ${m.negCpMin.toFixed(2)} ≥ σ = ${m.sigma.toFixed(2)})` : `✓ CAVITATION-FREE ENVELOPE (Margin Δσ = +${m.margin.toFixed(2)})`}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: '0.25rem' }}>
                {m.cavitating ? 'Suction peak drops below seawater vapor pressure. Reduce speed, lower α, or increase submergence depth.' : 'Local static pressure remains safely above vapor pressure across the entire suction surface.'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              <div style={{ background: '#061320', padding: '0.75rem', borderRadius: '8px', border: '1px solid #132C46' }}>
                <div style={{ fontSize: '0.75rem', color: '#7FB6D4' }}>Total Hydrodynamic Lift</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{m.liftN.toFixed(0)} N <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>({m.liftKgf.toFixed(1)} kgf)</span></div>
              </div>
              <div style={{ background: '#061320', padding: '0.75rem', borderRadius: '8px', border: '1px solid #132C46' }}>
                <div style={{ fontSize: '0.75rem', color: '#7FB6D4' }}>Total Foil Drag / L:D</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{m.dragN.toFixed(1)} N <span style={{ fontSize: '0.85rem', color: '#38BDF8' }}>({m.ldRatio.toFixed(1)} L/D)</span></div>
              </div>
              <div style={{ background: '#061320', padding: '0.75rem', borderRadius: '8px', border: '1px solid #132C46' }}>
                <div style={{ fontSize: '0.75rem', color: '#7FB6D4' }}>Cavitation Number (σ)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{m.sigma.toFixed(2)}</div>
              </div>
              <div style={{ background: '#061320', padding: '0.75rem', borderRadius: '8px', border: '1px solid #132C46' }}>
                <div style={{ fontSize: '0.75rem', color: '#7FB6D4' }}>Peak Suction (-Cp,min)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: m.cavitating ? '#FB923C' : '#34D399' }}>{m.negCpMin.toFixed(2)}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', color: '#93C5FD', marginBottom: '0.4rem' }}>Chordwise Pressure Distribution (Cp) vs. Cavitation Threshold</div>
              <CpCavitationChart stations={m.stations} sigma={m.sigma} cavitating={m.cavitating} />
            </div>
          </div>
        </section>
        <section>
          <h2 style={{ fontSize: '1.45rem', marginBottom: '0.4rem' }}>Deployment &amp; Licensing Tiers</h2>
          <p style={{ color: '#7FB6D4', fontSize: '0.9rem', marginBottom: '1.25rem' }}>Local-first architecture: run free browser screening on GitHub Pages, unlock automated 3D OpenFOAM cavitation sweeps locally or on burst cloud workers.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.15rem' }}>
            {[
              { name: 'Community Open-Core', price: '$0 / forever', desc: 'Browser 3D hydrofoil preview, cavitation number calculator, and self-hosted Docker connector.', cta: 'Active in Browser' },
              { name: 'Hydro Pro Workstation', price: '$49 / mo per seat', desc: 'Automated angle-of-attack & speed polar sweeps, snappyHexMesh boundary layers, and VTP/CSV export.', cta: 'Request Pro Key' },
              { name: 'Custom Shaper White-Label', price: '$750 / mo', desc: 'Embeddable foil configurator for e-foil & yacht brands with validated STEP/STL manufacturing export.', cta: 'Book Shaper Demo' }
            ].map((tier) => (
              <div key={tier.name} style={{ background: '#081A2C', border: '1px solid #16324F', borderRadius: '10px', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#38BDF8', fontWeight: 600 }}>{tier.name}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.35rem 0 0.6rem' }}>{tier.price}</div>
                  <p style={{ fontSize: '0.86rem', color: '#94C3DF', lineHeight: 1.5, margin: 0 }}>{tier.desc}</p>
                </div>
                <button style={{ background: '#0EA5E9', color: '#04101D', border: 'none', borderRadius: '6px', padding: '0.55rem 0.9rem', fontWeight: 600, cursor: 'pointer' }}>{tier.cta}</button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('hydro-root')!).render(
  <React.StrictMode>
    <HydroApp />
  </React.StrictMode>
);
