import { useEffect, useRef, useState } from 'react';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';

interface Props {
  datasetUrl: string;
}

interface VtkRefs {
  view: ReturnType<typeof vtkGenericRenderWindow.newInstance>;
  reader: ReturnType<typeof vtkXMLPolyDataReader.newInstance>;
  mapper: ReturnType<typeof vtkMapper.newInstance>;
  actor: ReturnType<typeof vtkActor.newInstance>;
  ro?: ResizeObserver;
}

export function CfdVtkViewer({ datasetUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vtkRef = useRef<VtkRefs | null>(null);
  const initFailedRef = useRef(false);
  const [status, setStatus] = useState('Waiting for layout…');
  const [field, setField] = useState('p');

  // -------------------------------------------------------------------------
  // Effect 1: initialise VTK once. Defers until the container has real
  // dimensions; guards WebGL2 availability; every VTK call in try/catch.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let raf = 0;

    const tryInit = () => {
      if (cancelled || initFailedRef.current || vtkRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) {
        raf = requestAnimationFrame(tryInit);
        return;
      }
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2');
        if (!gl) {
          initFailedRef.current = true;
          setStatus('WebGL2 not available in this browser');
          return;
        }

        const view = vtkGenericRenderWindow.newInstance({
          background: [0.043, 0.071, 0.102],
        });
        view.setContainer(container);
        view.resize();

        const reader = vtkXMLPolyDataReader.newInstance();
        const mapper = vtkMapper.newInstance();
        const actor = vtkActor.newInstance();
        mapper.setInputConnection(reader.getOutputPort());
        actor.setMapper(mapper);
        view.getRenderer().addActor(actor);

        const ro = new ResizeObserver(() => {
          const cur = vtkRef.current;
          if (!cur) return;
          try {
            cur.view.resize();
            cur.view.getRenderWindow().render();
          } catch {
            /* ignore transient resize failures */
          }
        });
        ro.observe(container);

        vtkRef.current = { view, reader, mapper, actor, ro };
        setStatus('Ready — loading dataset…');
      } catch (err) {
        initFailedRef.current = true;
        setStatus(
          err instanceof Error ? `VTK init: ${err.message}` : 'VTK init failed'
        );
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
        try { vtk.reader.delete(); } catch { /* noop */ }
        try { vtk.view.delete(); } catch { /* noop */ }
        vtkRef.current = null;
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // Effect 2: load / reload dataset when URL or field changes. Reuses the
  // existing VTK instance — no new WebGL context per toggle.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Wait until VTK is initialised (Effect 1 does it async)
      let waited = 0;
      while (!cancelled && !vtkRef.current && !initFailedRef.current && waited < 100) {
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

        const names = data.getPointData().getArrays().map((a) => a.getName());
        if (names.includes(field)) {
          vtk.mapper.setScalarVisibility(true);
          vtk.mapper.setColorByArrayName(field);
          vtk.mapper.setScalarModeToUsePointFieldData();
        } else {
          vtk.mapper.setScalarVisibility(false);
        }
        vtk.view.getRenderer().resetCamera();
        vtk.view.getRenderWindow().render();
        setStatus(`${data.getNumberOfPoints()} pts · ${data.getNumberOfCells()} cells`);
      } catch (err) {
        if (cancelled) return;
        setStatus(err instanceof Error ? err.message : 'Load failed');
      }
    };

    load();
    return () => { cancelled = true; };
  }, [datasetUrl, field]);

  return (
    <section className="cfd-vtk">
      <header className="cfd-vtk-head">
        <span>{status}</span>
        <label>
          Field
          <select value={field} onChange={(e) => setField(e.target.value)}>
            <option value="p">Pressure (p)</option>
            <option value="U">Velocity (U)</option>
            <option value="T">Temperature (T)</option>
          </select>
        </label>
      </header>
      <div ref={containerRef} className="cfd-vtk-canvas" />
    </section>
  );
}
