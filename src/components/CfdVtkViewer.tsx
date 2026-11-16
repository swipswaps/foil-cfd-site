import { useEffect, useRef, useState } from 'react';

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

interface Props {
  datasetUrl: string;
  field: 'p' | 'U' | 'T';
}

interface VtkRefs {
  view: ReturnType<typeof vtkGenericRenderWindow.newInstance>;
  reader: ReturnType<typeof vtkXMLPolyDataReader.newInstance>;
  mapper: ReturnType<typeof vtkMapper.newInstance>;
  actor: ReturnType<typeof vtkActor.newInstance>;
  ro?: ResizeObserver;
}

export function CfdVtkViewer({ datasetUrl, field }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vtkRef = useRef<VtkRefs | null>(null);
  const initFailedRef = useRef(false);
  const [status, setStatus] = useState('Waiting for layout…');

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
        const mapper = vtkMapper.newInstance();
        const actor = vtkActor.newInstance();
        mapper.setInputConnection(reader.getOutputPort());
        actor.setMapper(mapper);
        view.getRenderer().addActor(actor);
        const ro = new ResizeObserver(() => {
          const cur = vtkRef.current;
          if (!cur) return;
          try { cur.view.resize(); cur.view.getRenderWindow().render(); } catch { /* noop */ }
        });
        ro.observe(container);
        vtkRef.current = { view, reader, mapper, actor, ro };
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
        setStatus(`${data.getNumberOfPoints()} pts · ${data.getNumberOfCells()} cells · field=${field}`);
      } catch (err) {
        if (!cancelled) setStatus(err instanceof Error ? err.message : 'Load failed');
      }
    };
    load();
    return () => { cancelled = true; };
  }, [datasetUrl, field]);

  return (
    <section className="cfd-vtk">
      <header className="cfd-vtk-head">
        <span>{status}</span>
        <span className="cfd-vtk-field-badge">{field.toUpperCase()}</span>
      </header>
      <div ref={containerRef} className="cfd-vtk-canvas" />
    </section>
  );
}
