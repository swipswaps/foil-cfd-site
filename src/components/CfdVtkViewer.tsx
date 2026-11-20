import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
  try {
    Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
  } catch {
    /* read-only in some engines */
  }
}

import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import '@kitware/vtk.js/Rendering/Profiles/Volume';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkPolyDataNormals from '@kitware/vtk.js/Filters/Core/PolyDataNormals';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkColorMaps from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps';

interface Props {
  datasetUrl: string;
  field: 'p' | 'U' | 'T';
  rotationX: number;
  rotationY: number;
  rotationZ: number;
}

interface VtkRefs {
  view: ReturnType<typeof vtkGenericRenderWindow.newInstance>;
  reader: ReturnType<typeof vtkXMLPolyDataReader.newInstance>;
  normals: ReturnType<typeof vtkPolyDataNormals.newInstance>;
  mapper: ReturnType<typeof vtkMapper.newInstance>;
  actor: ReturnType<typeof vtkActor.newInstance>;
  ctf: ReturnType<typeof vtkColorTransferFunction.newInstance>;
  ro?: ResizeObserver;
  added?: boolean;
}

interface VtkPointDataLike {
  getArrayByName(name: string): { getComponent(tuple: number, component: number): number } | null;
}

interface VtkDataLike {
  getNumberOfPoints(): number;
  getPoints(): { getData(): ArrayLike<number> };
  getPointData(): VtkPointDataLike;
}

export function CfdVtkViewer({ datasetUrl, field, rotationX, rotationY, rotationZ }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vtkRef = useRef<VtkRefs | null>(null);
  const initFailedRef = useRef(false);
  const dataRef = useRef<VtkDataLike | null>(null);
  const [status, setStatus] = useState('Waiting for layout…');
  const [legend, setLegend] = useState<{ name: string; lo: number; hi: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let raf = 0;
    const tryInit = () => {
      if (cancelled || initFailedRef.current || vtkRef.current) return;
      if (container.getBoundingClientRect().width < 2 && container.clientWidth === 0) {
        raf = requestAnimationFrame(tryInit);
        return;
      }
      try {
        const view = vtkGenericRenderWindow.newInstance({ background: [0.043, 0.071, 0.102] });
        view.setContainer(container);
        view.resize();
        const reader = vtkXMLPolyDataReader.newInstance();
        const normals = vtkPolyDataNormals.newInstance();
        normals.setInputConnection(reader.getOutputPort());
        const mapper = vtkMapper.newInstance();
        const actor = vtkActor.newInstance();
        mapper.setInputConnection(normals.getOutputPort());
        actor.setMapper(mapper);
        const prop = actor.getProperty();
        prop.setAmbient(0.35);
        prop.setDiffuse(0.8);
        prop.setSpecular(0.25);
        prop.setSpecularPower(12);
        const ctf = vtkColorTransferFunction.newInstance();
        const preset = vtkColorMaps.getPresetByName('Cool to Warm');
        if (preset) ctf.applyColorMap(preset);
        mapper.setLookupTable(ctf);
        let lastSize = '';
        const ro = new ResizeObserver(() => {
          const cur = vtkRef.current;
          if (!cur) return;
          const next = `${container.clientWidth}x${container.clientHeight}`;
          if (next === lastSize) return;
          lastSize = next;
          try { cur.view.resize(); cur.view.getRenderWindow().render(); } catch { /* noop */ }
        });
        ro.observe(container);
        vtkRef.current = { view, reader, normals, mapper, actor, ctf, ro };
        setStatus('Ready — loading dataset…');
      } catch (err) {
        initFailedRef.current = true;
        setStatus(err instanceof Error ? `VTK init: ${err.message}` : 'VTK init failed');
      }
    };
    raf = requestAnimationFrame(tryInit);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      const vtk = vtkRef.current;
      if (vtk) {
        try { vtk.ro?.disconnect(); } catch { /* noop */ }
        try { vtk.actor.delete(); } catch { /* noop */ }
        try { vtk.mapper.delete(); } catch { /* noop */ }
        try { vtk.ctf.delete(); } catch { /* noop */ }
        try { vtk.normals.delete(); } catch { /* noop */ }
        try { vtk.reader.delete(); } catch { /* noop */ }
        try { vtk.view.delete(); } catch { /* noop */ }
        vtkRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let waited = 0;
      while (!cancelled && !vtkRef.current && !initFailedRef.current && waited < 120) {
        await new Promise((r) => requestAnimationFrame(r));
        waited++;
      }
      if (cancelled || initFailedRef.current) return;
      const vtk = vtkRef.current;
      if (!vtk) return;
      try {
        const res = await fetch(datasetUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        vtk.reader.parseAsArrayBuffer(buf);
        const data = vtk.reader.getOutputData(0);
        if (!data) throw new Error('VTK dataset empty');
        const pd = data.getPointData();
        const names = pd.getArrays().map((a: { getName: () => string }) => a.getName());
        let colorName: string = field;
        if (field === 'U' && pd.getArrayByName('U')) {
          const vec = pd.getArrayByName('U');
          const n = data.getNumberOfPoints();
          const mag = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            const u = vec.getComponent(i, 0) || 0;
            const v = vec.getComponent(i, 1) || 0;
            const w = vec.getComponent(i, 2) || 0;
            mag[i] = Math.hypot(u, v, w);
          }
          if (!pd.getArrayByName('Umag')) {
            pd.addArray(vtkDataArray.newInstance({ name: 'Umag', values: mag, numberOfComponents: 1 }));
          }
          colorName = 'Umag';
        }
        if (names.includes(field) || colorName !== field) {
          const arr = pd.getArrayByName(colorName);
          const range = arr?.getRange?.() ?? [0, 1];
          const lo = Number.isFinite(range[0]) ? range[0] : 0;
          const hi = Number.isFinite(range[1]) && range[1] > lo ? range[1] : lo + 1;
          vtk.ctf.setMappingRange(lo, hi);
          vtk.mapper.setScalarRange(lo, hi);
          vtk.mapper.setScalarVisibility(true);
          vtk.mapper.setColorByArrayName(colorName);
          vtk.mapper.setScalarModeToUsePointFieldData();
          dataRef.current = data as unknown as VtkDataLike;
          setLegend({ name: colorName, lo, hi });
        } else {
          vtk.mapper.setScalarVisibility(false);
          dataRef.current = data as unknown as VtkDataLike;
          setLegend(null);
        }
        if (!vtk.added) {
          vtk.view.getRenderer().addActor(vtk.actor);
          vtk.added = true;
        }
        vtk.view.getRenderer().resetCamera();
        vtk.view.getRenderWindow().render();
        setStatus(`${data.getNumberOfPoints()} pts · ${data.getNumberOfCells()} cells · field=${field}`);
      } catch (err) {
        if (!cancelled) setStatus(err instanceof Error ? err.message : 'Load failed');
      }
    };
    load();
    return () => { cancelled = true; };
  }, [datasetUrl, field]);

  useEffect(() => {
    const vtk = vtkRef.current;
    if (!vtk) return;
    vtk.actor.setOrientation(
      (rotationX * 180) / Math.PI,
      (rotationY * 180) / Math.PI,
      (rotationZ * 180) / Math.PI,
    );
    vtk.view.getRenderWindow().render();
  }, [rotationX, rotationY, rotationZ]);

  const exportVtp = async () => {
    try {
      const res = await fetch(datasetUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'surface.vtp';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setStatus('Export failed');
    }
  };

  const exportCsv = () => {
    const data = dataRef.current;
    if (!data) return;
    const pts = data.getPoints().getData();
    const pd = data.getPointData();
    const comp = (name: string, tuple: number, component: number) => {
      const arr = pd.getArrayByName(name);
      return arr ? arr.getComponent(tuple, component) : 0;
    };
    const rows = ['x,y,z,p,Ux,Uy,Uz,T'];
    for (let i = 0; i < data.getNumberOfPoints(); i++) {
      rows.push(
        `${pts[i * 3]},${pts[i * 3 + 1]},${pts[i * 3 + 2]},${comp('p', i, 0)},${comp('U', i, 0)},${comp('U', i, 1)},${comp('U', i, 2)},${comp('T', i, 0)}`,
      );
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'surface.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const setView = (mode: 'iso' | 'top' | 'side') => {
    const vtk = vtkRef.current;
    if (!vtk) return;
    const renderer = vtk.view.getRenderer();
    if (mode === 'iso') {
      renderer.resetCamera();
    } else {
      const b = renderer.computeVisiblePropBounds();
      const cx = (b[0] + b[1]) / 2;
      const cy = (b[2] + b[3]) / 2;
      const cz = (b[4] + b[5]) / 2;
      const dist = Math.max(b[1] - b[0], b[3] - b[2], b[5] - b[4]) * 2 || 4;
      const cam = renderer.getActiveCamera();
      cam.setFocalPoint(cx, cy, cz);
      if (mode === 'top') {
        cam.setPosition(cx, cy + dist, cz);
        cam.setViewUp(0, 0, -1);
      } else {
        cam.setPosition(cx + dist, cy, cz);
        cam.setViewUp(0, 1, 0);
      }
      renderer.resetCameraClippingRange();
    }
    vtk.view.getRenderWindow().render();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const vtk = vtkRef.current;
    if (!vtk) return;
    const renderer = vtk.view.getRenderer();
    const cam = renderer.getActiveCamera();
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': cam.azimuth(-5); break;
      case 'ArrowRight': cam.azimuth(5); break;
      case 'ArrowUp': cam.elevation(5); break;
      case 'ArrowDown': cam.elevation(-5); break;
      case '+': case '=': cam.zoom(1.1); break;
      case '-': case '_': cam.zoom(0.9); break;
      case 'r': case 'R': renderer.resetCamera(); break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      renderer.resetCameraClippingRange();
      vtk.view.getRenderWindow().render();
    }
  };

  return (
    <section className="cfd-vtk">
      <header className="cfd-vtk-head">
        <div className="cfd-vtk-statusline">
          <span>{status}</span>
          <span className="cfd-vtk-field-badge">{field.toUpperCase()}</span>
        </div>
        {legend && (
          <div className="cfd-vtk-legend">
            <span>{legend.lo.toFixed(2)}</span>
            <span className="cfd-vtk-legend-bar" aria-hidden="true" />
            <span>{legend.hi.toFixed(2)}</span>
            <span className="cfd-vtk-legend-name">
              {legend.name === 'Umag' ? '|U|' : legend.name.toUpperCase()}
            </span>
          </div>
        )}
        <div className="cfd-vtk-actions">
          <button type="button" onClick={() => setView('iso')}>Reset</button>
          <button type="button" onClick={() => setView('top')}>Top</button>
          <button type="button" onClick={() => setView('side')}>Side</button>
          <button type="button" onClick={exportVtp}>Export VTP</button>
          <button type="button" onClick={exportCsv}>Export CSV</button>
        </div>
      </header>
      <div
        ref={containerRef}
        className="cfd-vtk-canvas"
        role="img"
        aria-label={`3D CFD surface, ${field.toUpperCase()} field`}
        tabIndex={0}
        onKeyDown={onKeyDown}
      />
    </section>
  );
}
