/**
 * FOIL.CFD - VTK.js Scientific 3D Viewer Component.
 * Reference: Kitware VTK.js Documentation (https://kitware.github.io/vtk-js/)[cite: 5].
 */
import { useEffect, useRef, useState } from 'react';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';

interface Props {
  datasetUrl: string;
}

export function CfdVtkViewer({ datasetUrl }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Loading scientific dataset...');
  const [field, setField] = useState('U');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const controller = new AbortController();
    const view = vtkGenericRenderWindow.newInstance({
      background: [0.035, 0.09, 0.16],
    });

    const reader = vtkXMLPolyDataReader.newInstance();
    const mapper = vtkMapper.newInstance();
    const actor = vtkActor.newInstance();

    view.setContainer(container);
    view.resize();

    mapper.setInputConnection(reader.getOutputPort());
    actor.setMapper(mapper);

    const renderer = view.getRenderer();
    renderer.addActor(actor);
    renderer.resetCamera();

    async function loadDataset() {
      try {
        const response = await fetch(datasetUrl, {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        if (controller.signal.aborted) return;

        reader.parseAsArrayBuffer(buffer);
        const data = reader.getOutputData(0);

        if (!data) {
          throw new Error('VTK dataset contains no output');
        }

        const pointArrays = data.getPointData().getArrays();
        const cellArrays = data.getCellData().getArrays();
        const arrays = [...pointArrays, ...cellArrays];
        const selected = arrays.find((item) => item.getName() === field);

        if (selected) {
          mapper.setScalarVisibility(true);
          mapper.setColorByArrayName(field);
        } else {
          mapper.setScalarVisibility(false);
        }

        mapper.setScalarModeToUsePointFieldData();
        renderer.resetCamera();
        view.getRenderWindow().render();

        setStatus(`Loaded OpenFOAM Dataset: ${data.getNumberOfPoints()} points[cite: 5]`);
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatus(error instanceof Error ? error.message : 'Dataset loading failed');
      }
    }

    loadDataset();

    const observer = new ResizeObserver(() => {
      view.resize();
      view.getRenderWindow().render();
    });

    observer.observe(container);

    return () => {
      controller.abort();
      observer.disconnect();
      actor.delete();
      mapper.delete();
      reader.delete();
      view.delete();
    };
  }, [datasetUrl, field]);

  return (
    <section className="cfd-vtk-viewer">
      <header className="vtk-header" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 1rem', background: '#102C4A', color: '#FFF' }}>
        <p style={{ margin: 0, fontSize: '0.8rem' }}>{status}</p>
        <label style={{ fontSize: '0.8rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          Field:
          <select value={field} onChange={(e) => setField(e.target.value)} style={{ background: '#0B2545', color: '#FFF', border: '1px solid #38536E', padding: '0.2rem' }}>
            <option value="U">Velocity (U)</option>
            <option value="p">Pressure (p)</option>
            <option value="T">Temperature (T)</option>
            <option value="vorticity">Vorticity</option>
          </select>
        </label>
      </header>
      <div ref={containerRef} style={{ width: '100%', height: '420px', background: '#091729' }} />
    </section>
  );
}
