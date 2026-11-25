import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

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
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkColorMaps from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction/ColorMaps';
import vtkPointPicker from '@kitware/vtk.js/Rendering/Core/PointPicker';
import { fmtProbe, type FreeStream, type ProbeReading, type ProbeSample } from '../lib/probe';
import { backendFetch } from '../lib/backendFetch';
import { labelForField, orderFields, type FieldInfo } from '../lib/fields';
import { deriveCpFromSurface, type DerivedCp } from '../lib/cp';

interface Props {
  datasetUrl: string;
  field: string;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  onProbe?: (sample: ProbeSample | null) => void;
  onLoadState?: (state: 'loading' | 'ready' | 'error') => void;
  onFieldsChange?: (fields: FieldInfo[]) => void;
  onCpSample?: (cp: DerivedCp | null) => void;
  freeStream?: FreeStream;
  sectionCn?: number;
  focusRequest?: { sample: ProbeSample; nonce: number } | null;
  probeStation?: { xc: number; nonce: number } | null;
}

interface VtkRefs {
  view: ReturnType<typeof vtkGenericRenderWindow.newInstance>;
  reader: ReturnType<typeof vtkXMLPolyDataReader.newInstance>;
  normals: ReturnType<typeof vtkPolyDataNormals.newInstance>;
  mapper: ReturnType<typeof vtkMapper.newInstance>;
  actor: ReturnType<typeof vtkActor.newInstance>;
  ctf: ReturnType<typeof vtkColorTransferFunction.newInstance>;
  picker: ReturnType<typeof vtkPointPicker.newInstance>;
  ro?: ResizeObserver;
  added?: boolean;
}

interface VtkArrayLike {
  getName(): string;
  getNumberOfComponents?(): number;
  getRange?(): number[];
  getComponent(tuple: number, component: number): number;
}

interface VtkPointDataLike {
  getArrayByName(name: string): VtkArrayLike | null;
  getArrays(): VtkArrayLike[];
  addArray(array: unknown): void;
}

interface VtkDataLike {
  getNumberOfPoints(): number;
  getPoints(): { getData(): ArrayLike<number> };
  getPointData(): VtkPointDataLike;
}

interface Probe extends ProbeSample {
  left: number;
  top: number;
}

interface CameraLike {
  getFocalPoint(): number[];
  getPosition(): number[];
  setFocalPoint(x: number, y: number, z: number): void;
  setPosition(x: number, y: number, z: number): void;
  setViewUp(x: number, y: number, z: number): void;
}

interface RendererLike {
  computeVisiblePropBounds(): number[];
  getActiveCamera(): CameraLike;
  resetCameraClippingRange(): void;
}

interface ViewNodeLike {
  getFramebufferSize?: () => number[];
  worldToDisplay?: (x: number, y: number, z: number, renderer: unknown) => number[];
}

function bounds(renderer: RendererLike) {
  const b = renderer.computeVisiblePropBounds();
  return {
    cx: (b[0] + b[1]) / 2,
    cy: (b[2] + b[3]) / 2,
    cz: (b[4] + b[5]) / 2,
    size: Math.max(b[1] - b[0], b[3] - b[2], b[5] - b[4]) * 2 || 4,
  };
}

function fitIso(renderer: RendererLike) {
  const { cx, cy, cz, size } = bounds(renderer);
  const cam = renderer.getActiveCamera();
  const offset = size * 0.8;
  cam.setFocalPoint(cx, cy, cz);
  cam.setPosition(cx + offset, cy - offset, cz + offset);
  cam.setViewUp(0, 0, 1);
  renderer.resetCameraClippingRange();
}

function fitOrtho(renderer: RendererLike, mode: 'top' | 'side') {
  const { cx, cy, cz, size } = bounds(renderer);
  const cam = renderer.getActiveCamera();
  cam.setFocalPoint(cx, cy, cz);
  if (mode === 'top') {
    cam.setPosition(cx, cy + size, cz);
    cam.setViewUp(0, 0, -1);
  } else {
    cam.setPosition(cx + size, cy, cz);
    cam.setViewUp(0, 1, 0);
  }
  renderer.resetCameraClippingRange();
}

export function CfdVtkViewer({ datasetUrl, field, rotationX, rotationY, rotationZ, onProbe, onLoadState, onFieldsChange, onCpSample, freeStream, sectionCn, focusRequest, probeStation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vtkRef = useRef<VtkRefs | null>(null);
  const initFailedRef = useRef(false);
  const dataRef = useRef<VtkDataLike | null>(null);
  const datasetRef = useRef<string | null>(null);
  const probeWorldRef = useRef<ProbeSample | null>(null);
  const fieldsRef = useRef<FieldInfo[]>([]);
  const onLoadStateRef = useRef(onLoadState);
  const onFieldsChangeRef = useRef(onFieldsChange);
  const onCpSampleRef = useRef(onCpSample);
  const [status, setStatus] = useState('Waiting for layout…');
  const [legend, setLegend] = useState<{ name: string; lo: number; hi: number } | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [showVectors, setShowVectors] = useState(false);
  const showVectorsRef = useRef(false);
  const glyphRef = useRef<{
    actor: ReturnType<typeof vtkActor.newInstance>;
    mapper: ReturnType<typeof vtkMapper.newInstance>;
    ctf: ReturnType<typeof vtkColorTransferFunction.newInstance>;
  } | null>(null);
  const rebuildVectorsRef = useRef<(data: VtkDataLike | null, on: boolean) => void>(() => {});
  const downRef = useRef<{ x: number; y: number } | null>(null);

  const clearGlyphs = () => {
    const vtk = vtkRef.current;
    const g = glyphRef.current;
    if (!vtk || !g) return;
    try { vtk.view.getRenderer().removeActor(g.actor); } catch { /* noop */ }
    try { g.actor.delete(); } catch { /* noop */ }
    try { g.mapper.delete(); } catch { /* noop */ }
    try { g.ctf.delete(); } catch { /* noop */ }
    glyphRef.current = null;
  };

  const rebuildVectors = (data: VtkDataLike | null, on: boolean) => {
    const vtk = vtkRef.current;
    if (!vtk) return;
    clearGlyphs();
    const render = () => vtk.view.getRenderWindow().render();
    if (!on || !data || !vtk.added) {
      render();
      return;
    }
    const u = data.getPointData().getArrayByName('U');
    if (!u) {
      setAnnouncement('Flow vectors unavailable: no U array');
      render();
      return;
    }
    const n = data.getNumberOfPoints();
    const pts = data.getPoints().getData();
    const stride = Math.max(1, Math.floor(n / 120));
    const sampled: number[] = [];
    let maxU = 0;
    for (let i = 0; i < n; i += stride) {
      const m = Math.hypot(u.getComponent(i, 0) || 0, u.getComponent(i, 1) || 0, u.getComponent(i, 2) || 0);
      if (m > 1e-6) {
        sampled.push(i);
        if (m > maxU) maxU = m;
      }
    }
    if (sampled.length === 0 || maxU <= 0) {
      setAnnouncement('Flow vectors: no non-zero velocities');
      render();
      return;
    }
    const len = 0.16;
    const back = len * 0.35;
    const wing = len * 0.18;
    const verts = new Float32Array(sampled.length * 12);
    const lines = new Uint32Array(sampled.length * 9);
    const mags = new Float32Array(sampled.length * 4);
    sampled.forEach((i, k) => {
      const px = Number(pts[i * 3]);
      const py = Number(pts[i * 3 + 1]);
      const pz = Number(pts[i * 3 + 2]);
      const ux = u.getComponent(i, 0) || 0;
      const uy = u.getComponent(i, 1) || 0;
      const uz = u.getComponent(i, 2) || 0;
      const m = Math.hypot(ux, uy, uz) || 1;
      const dx = ux / m;
      const dy = uy / m;
      const dz = uz / m;
      const tx = px + dx * len;
      const ty = py + dy * len;
      const tz = pz + dz * len;
      // A perpendicular picks the arrowhead plane; avoid the degenerate case
      // when the flow is nearly parallel to Z.
      const ax = Math.abs(dz) < 0.9 ? 0 : 1;
      const ay = 0;
      const az = Math.abs(dz) < 0.9 ? 1 : 0;
      let hx = dy * az - dz * ay;
      let hy = dz * ax - dx * az;
      let hz = dx * ay - dy * ax;
      const hn = Math.hypot(hx, hy, hz) || 1;
      hx /= hn;
      hy /= hn;
      hz /= hn;
      const b0 = k * 4;
      verts[b0 * 3] = px;
      verts[b0 * 3 + 1] = py;
      verts[b0 * 3 + 2] = pz;
      verts[(b0 + 1) * 3] = tx;
      verts[(b0 + 1) * 3 + 1] = ty;
      verts[(b0 + 1) * 3 + 2] = tz;
      verts[(b0 + 2) * 3] = tx - dx * back + hx * wing;
      verts[(b0 + 2) * 3 + 1] = ty - dy * back + hy * wing;
      verts[(b0 + 2) * 3 + 2] = tz - dz * back + hz * wing;
      verts[(b0 + 3) * 3] = tx - dx * back - hx * wing;
      verts[(b0 + 3) * 3 + 1] = ty - dy * back - hy * wing;
      verts[(b0 + 3) * 3 + 2] = tz - dz * back - hz * wing;
      const l0 = k * 9;
      lines[l0] = 2;
      lines[l0 + 1] = b0;
      lines[l0 + 2] = b0 + 1;
      lines[l0 + 3] = 2;
      lines[l0 + 4] = b0 + 1;
      lines[l0 + 5] = b0 + 2;
      lines[l0 + 6] = 2;
      lines[l0 + 7] = b0 + 1;
      lines[l0 + 8] = b0 + 3;
      for (let q = 0; q < 4; q++) mags[k * 4 + q] = m;
    });
    const poly = vtkPolyData.newInstance();
    poly.getPoints().setData(verts, 3);
    poly.getLines().setData(lines);
    poly.getPointData().setScalars(
      vtkDataArray.newInstance({ name: 'Umag', values: mags, numberOfComponents: 1 }),
    );
    const ctf = vtkColorTransferFunction.newInstance();
    const preset =
      vtkColorMaps.getPresetByName('Viridis (matplotlib)') ??
      vtkColorMaps.getPresetByName('Cool to Warm');
    if (preset) ctf.applyColorMap(preset);
    ctf.setMappingRange(0, maxU);
    const mapper = vtkMapper.newInstance();
    mapper.setInputData(poly);
    mapper.setLookupTable(ctf);
    mapper.setScalarRange(0, maxU);
    mapper.setScalarVisibility(true);
    const actor = vtkActor.newInstance();
    actor.setMapper(mapper);
    actor.getProperty().setLineWidth(2);
    actor.setOrientation(
      (rotationX * 180) / Math.PI,
      (rotationY * 180) / Math.PI,
      (rotationZ * 180) / Math.PI,
    );
    vtk.view.getRenderer().addActor(actor);
    glyphRef.current = { actor, mapper, ctf };
    render();
    setAnnouncement(`Flow vectors on · ${sampled.length} glyphs · colour = |U|`);
  };

  // No dependency array on purpose: sync every render so the load effect
  // never closes over a stale rebuild function (it reads current rotation).
  useEffect(() => {
    rebuildVectorsRef.current = rebuildVectors;
    onLoadStateRef.current = onLoadState;
    onFieldsChangeRef.current = onFieldsChange;
    onCpSampleRef.current = onCpSample;
  });

  const toggleVectors = () => {
    const next = !showVectorsRef.current;
    showVectorsRef.current = next;
    setShowVectors(next);
    rebuildVectors(dataRef.current, next);
    if (!next) setAnnouncement('Flow vectors off');
  };

  const projectProbe = () => {
    const vtk = vtkRef.current;
    const sample = probeWorldRef.current;
    const surface = containerRef.current;
    if (!vtk || !sample || !surface) return;
    const rect = surface.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const m = vtk.actor.getMatrix();
    const wx = m[0] * sample.x + m[4] * sample.y + m[8] * sample.z + m[12];
    const wy = m[1] * sample.x + m[5] * sample.y + m[9] * sample.z + m[13];
    const wz = m[2] * sample.x + m[6] * sample.y + m[10] * sample.z + m[14];
    const renderer = vtk.view.getRenderer();
    const views = (vtk.view.getRenderWindow() as unknown as { getViews?: () => ViewNodeLike[] }).getViews?.();
    const vnode = views?.[0];
    if (!vnode?.worldToDisplay) return;
    const disp = vnode.worldToDisplay(wx, wy, wz, renderer);
    if (!disp || !Number.isFinite(disp[0]) || !Number.isFinite(disp[1])) return;
    const fb = vnode.getFramebufferSize?.() ?? [rect.width, rect.height];
    if (!fb[0] || !fb[1]) return;
    const left = (disp[0] / fb[0]) * rect.width;
    const top = rect.height - (disp[1] / fb[1]) * rect.height;
    setProbe((prev) => (prev ? { ...prev, left, top } : prev));
  };

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
        const picker = vtkPointPicker.newInstance();
        picker.setPickFromList(true);
        picker.initializePickList();
        picker.addPickList(actor);
        let lastSize = '';
        const ro = new ResizeObserver(() => {
          const cur = vtkRef.current;
          if (!cur) return;
          const next = `${container.clientWidth}x${container.clientHeight}`;
          if (next === lastSize) return;
          lastSize = next;
          try { cur.view.resize(); cur.view.getRenderWindow().render(); } catch { /* noop */ }
          projectProbe();
        });
        ro.observe(container);
        view.getInteractor().onEndInteraction(projectProbe);
        vtkRef.current = { view, reader, normals, mapper, actor, ctf, picker, ro };
        setStatus('Ready — loading dataset…');
      } catch (err) {
        initFailedRef.current = true;
        onLoadStateRef.current?.('error');
        setStatus(err instanceof Error ? `VTK init: ${err.message}` : 'VTK init failed');
      }
    };
    raf = requestAnimationFrame(tryInit);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      const vtk = vtkRef.current;
      if (vtk) {
        clearGlyphs();
        try { vtk.ro?.disconnect(); } catch { /* noop */ }
        try { vtk.actor.delete(); } catch { /* noop */ }
        try { vtk.mapper.delete(); } catch { /* noop */ }
        try { vtk.ctf.delete(); } catch { /* noop */ }
        try { vtk.picker.delete(); } catch { /* noop */ }
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
      setProbe(null);
      probeWorldRef.current = null;
      onProbe?.(null);
      const datasetChanged = datasetRef.current !== datasetUrl;
      datasetRef.current = datasetUrl;
      if (datasetChanged) onLoadStateRef.current?.('loading');
      try {
        const res = await backendFetch(datasetUrl, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        vtk.reader.parseAsArrayBuffer(buf);
        const data = vtk.reader.getOutputData(0);
        if (!data) throw new Error('VTK dataset empty');
        const pd = data.getPointData();
        const arrays = pd.getArrays().filter((a: VtkArrayLike) => !/(^Umag$|_mag$)/.test(a.getName()));
        const available: FieldInfo[] = orderFields(
          arrays.map((a: VtkArrayLike) => {
            const comps = typeof a.getNumberOfComponents === 'function' ? a.getNumberOfComponents() : 1;
            const name = a.getName();
            return {
              name,
              label: labelForField(name),
              kind: (comps > 1 ? 'vector' : 'scalar') as 'vector' | 'scalar',
            };
          }),
        );
        fieldsRef.current = available;
        if (datasetChanged) {
          onFieldsChangeRef.current?.(available);
          // Derive a Cp distribution from the loaded surface so a completed job
          // drives the chart instead of the synthetic preview curve.
          const pArr = pd.getArrayByName('p');
          if (pArr) {
            const uArr = pd.getArrayByName('U');
            const n = data.getNumberOfPoints();
            const pressure = new Float32Array(n);
            let uRef = 0;
            for (let i = 0; i < n; i += 1) {
              pressure[i] = pArr.getComponent(i, 0) || 0;
              if (uArr) {
                const m = Math.hypot(
                  uArr.getComponent(i, 0) || 0,
                  uArr.getComponent(i, 1) || 0,
                  uArr.getComponent(i, 2) || 0,
                );
                if (m > uRef) uRef = m;
              }
            }
            onCpSampleRef.current?.(
              deriveCpFromSurface(data.getPoints().getData(), pressure, { uRef }),
            );
          } else {
            onCpSampleRef.current?.(null);
          }
        }

        const selected = pd.getArrayByName(field);
        let colorName: string | null = selected ? field : null;
        if (selected) {
          const comps = typeof selected.getNumberOfComponents === 'function'
            ? selected.getNumberOfComponents()
            : 1;
          if (comps > 1) {
            const magName = field === 'U' ? 'Umag' : `${field}_mag`;
            if (!pd.getArrayByName(magName)) {
              const n = data.getNumberOfPoints();
              const mag = new Float32Array(n);
              for (let i = 0; i < n; i += 1) {
                let sum = 0;
                for (let c = 0; c < comps; c += 1) {
                  const v = selected.getComponent(i, c) || 0;
                  sum += v * v;
                }
                mag[i] = Math.sqrt(sum);
              }
              pd.addArray(vtkDataArray.newInstance({ name: magName, values: mag, numberOfComponents: 1 }));
            }
            colorName = magName;
          }
        }
        const colorArr = colorName ? pd.getArrayByName(colorName) : null;
        if (colorName && colorArr) {
          const range = colorArr.getRange?.() ?? [0, 1];
          const lo = Number.isFinite(range[0]) ? range[0] : 0;
          const hi = Number.isFinite(range[1]) && range[1] > lo ? range[1] : lo + 1;
          vtk.ctf.setMappingRange(lo, hi);
          vtk.mapper.setScalarRange(lo, hi);
          vtk.mapper.setScalarVisibility(true);
          vtk.mapper.setColorByArrayName(colorName);
          vtk.mapper.setScalarModeToUsePointFieldData();
          setLegend({ name: colorName, lo, hi });
        } else {
          vtk.mapper.setScalarVisibility(false);
          setLegend(null);
        }
        dataRef.current = data as unknown as VtkDataLike;
        if (!vtk.added) {
          vtk.view.getRenderer().addActor(vtk.actor);
          vtk.added = true;
        }
        if (showVectorsRef.current) rebuildVectorsRef.current(data as unknown as VtkDataLike, true);
        if (datasetChanged) fitIso(vtk.view.getRenderer() as unknown as RendererLike);
        vtk.view.getRenderWindow().render();
        setStatus(`${data.getNumberOfPoints()} pts · ${data.getNumberOfCells()} cells · field=${field}`);
        onLoadStateRef.current?.('ready');
      } catch (err) {
        if (!cancelled) {
          onLoadStateRef.current?.('error');
          setStatus(err instanceof Error ? err.message : 'Load failed');
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [datasetUrl, field, onProbe]);

  useEffect(() => {
    const vtk = vtkRef.current;
    if (!vtk) return;
    vtk.actor.setOrientation(
      (rotationX * 180) / Math.PI,
      (rotationY * 180) / Math.PI,
      (rotationZ * 180) / Math.PI,
    );
    glyphRef.current?.actor.setOrientation(
      (rotationX * 180) / Math.PI,
      (rotationY * 180) / Math.PI,
      (rotationZ * 180) / Math.PI,
    );
    vtk.view.getRenderWindow().render();
    projectProbe();
  }, [rotationX, rotationY, rotationZ]);

  useEffect(() => {
    if (!focusRequest) return;
    const vtk = vtkRef.current;
    if (!vtk) return;
    const renderer = vtk.view.getRenderer();
    const cam = renderer.getActiveCamera() as unknown as CameraLike;
    const fp = cam.getFocalPoint();
    const pos = cam.getPosition();
    const { x, y, z } = focusRequest.sample;
    cam.setFocalPoint(x, y, z);
    cam.setPosition(pos[0] + (x - fp[0]), pos[1] + (y - fp[1]), pos[2] + (z - fp[2]));
    renderer.resetCameraClippingRange();
    vtk.view.getRenderWindow().render();
    projectProbe();
    setAnnouncement(`Centered on probe ${fmtProbe(x)}, ${fmtProbe(y)}, ${fmtProbe(z)}`);
  }, [focusRequest]);

  const exportProbeJson = () => {
    if (!probe) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      datasetUrl,
      field,
      freeStream: freeStream ?? null,
      analysis: {
        sectionCn: typeof sectionCn === 'number' && Number.isFinite(sectionCn) ? sectionCn : null,
      },
      probe: { x: probe.x, y: probe.y, z: probe.z, p: probe.p, U: probe.u, T: probe.t },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'probe.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportVtp = async () => {
    try {
      const res = await backendFetch(datasetUrl);
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
    const n = (v: number) => (Number.isFinite(v) ? v.toFixed(2) : 'na');
    const pts = data.getPoints().getData();
    const pd = data.getPointData();
    const comp = (name: string, tuple: number, component: number) => {
      const arr = pd.getArrayByName(name);
      return arr ? arr.getComponent(tuple, component) : 0;
    };
    const rows = probe
      ? [`# probe x=${fmtProbe(probe.x, 3)} y=${fmtProbe(probe.y, 3)} z=${fmtProbe(probe.z, 3)} p=${fmtProbe(probe.p)} U=${fmtProbe(probe.u)} T=${fmtProbe(probe.t)}`, 'x,y,z,p,Ux,Uy,Uz,T']
      : ['x,y,z,p,Ux,Uy,Uz,T'];
    for (let i = 0; i < data.getNumberOfPoints(); i++) {
      rows.push(
        `${pts[i * 3]},${pts[i * 3 + 1]},${pts[i * 3 + 2]},${comp('p', i, 0)},${comp('U', i, 0)},${comp('U', i, 1)},${comp('U', i, 2)},${comp('T', i, 0)}`,
      );
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = probe ? `surface-p${n(probe.p)}-U${n(probe.u)}-T${n(probe.t)}.csv` : 'surface.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const samplePoint = (id: number): ProbeSample | null => {
    const data = dataRef.current;
    if (!data) return null;
    const pd = data.getPointData();
    const pts = data.getPoints().getData();
    const comp = (name: string, tuple: number, component: number) => {
      const arr = pd.getArrayByName(name);
      return arr ? arr.getComponent(tuple, component) : Number.NaN;
    };
    const ux = comp('U', id, 0);
    const uy = comp('U', id, 1);
    const uz = comp('U', id, 2);
    const readings: ProbeReading[] = [];
    for (const f of fieldsRef.current) {
      const arr = pd.getArrayByName(f.name);
      if (!arr) continue;
      if (f.kind === 'vector') {
        const comps = typeof arr.getNumberOfComponents === 'function' ? arr.getNumberOfComponents() : 3;
        let sum = 0;
        for (let c = 0; c < comps; c += 1) {
          const v = arr.getComponent(id, c) || 0;
          sum += v * v;
        }
        readings.push({ name: f.name, label: f.label, value: Math.sqrt(sum) });
      } else {
        readings.push({ name: f.name, label: f.label, value: arr.getComponent(id, 0) });
      }
    }
    return {
      x: Number(pts[id * 3]) || 0,
      y: Number(pts[id * 3 + 1]) || 0,
      z: Number(pts[id * 3 + 2]) || 0,
      p: comp('p', id, 0),
      u: Number.isFinite(ux) || Number.isFinite(uy) || Number.isFinite(uz)
        ? Math.hypot(ux || 0, uy || 0, uz || 0)
        : Number.NaN,
      t: comp('T', id, 0),
      readings,
    };
  };

  // Keyboard/slider probe: pick the point nearest a requested chord station.
  const sampleNearestX = (xc: number) => {
    const data = dataRef.current;
    if (!data) return;
    const pts = data.getPoints().getData();
    const n = data.getNumberOfPoints();
    if (!n) return;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = Number(pts[i * 3]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    const target = minX + Math.min(1, Math.max(0, xc)) * ((maxX - minX) || 1);
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(Number(pts[i * 3]) - target);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    const sample = best >= 0 ? samplePoint(best) : null;
    if (!sample) return;
    probeWorldRef.current = sample;
    setProbe({ ...sample, left: 0, top: 0 });
    projectProbe();
    onProbe?.(sample);
    setAnnouncement(
      `Station x/c ${xc.toFixed(2)} · p ${fmtProbe(sample.p)} · |U| ${fmtProbe(sample.u)} · T ${fmtProbe(sample.t)}`,
    );
  };

  const sampleNearestXRef = useRef(sampleNearestX);
  useEffect(() => {
    sampleNearestXRef.current = sampleNearestX;
  });
  useEffect(() => {
    if (!probeStation) return;
    sampleNearestXRef.current(probeStation.xc);
  }, [probeStation]);

  const pickAt = (clientX: number, clientY: number) => {
    const vtk = vtkRef.current;
    const data = dataRef.current;
    const surface = containerRef.current;
    if (!vtk || !data || !surface) return;
    const rect = surface.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const views = (vtk.view.getRenderWindow() as unknown as { getViews?: () => { getFramebufferSize?: () => number[] }[] }).getViews?.();
    const fb = views?.[0]?.getFramebufferSize?.() ?? [rect.width, rect.height];
    const x = ((clientX - rect.left) / rect.width) * fb[0];
    const y = ((rect.bottom - clientY) / rect.height) * fb[1];
    vtk.picker.pick([x, y, 0], vtk.view.getRenderer());
    const id = vtk.picker.getPointId();
    if (!Number.isFinite(id) || id < 0) {
      setProbe(null);
      probeWorldRef.current = null;
      onProbe?.(null);
      return;
    }
    const sample = samplePoint(id);
    if (!sample) return;
    probeWorldRef.current = sample;
    setProbe({ ...sample, left: clientX - rect.left, top: clientY - rect.top });
    onProbe?.(sample);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    downRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const down = downRef.current;
    downRef.current = null;
    if (!down) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) {
      projectProbe();
      return;
    }
    pickAt(e.clientX, e.clientY);
  };


  const setView = (mode: 'iso' | 'top' | 'side') => {
    const vtk = vtkRef.current;
    if (!vtk) return;
    const renderer = vtk.view.getRenderer() as unknown as RendererLike;
    if (mode === 'iso') fitIso(renderer);
    else fitOrtho(renderer, mode);
    vtk.view.getRenderWindow().render();
    projectProbe();
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
      case 'r': case 'R': fitIso(renderer as unknown as RendererLike); break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      renderer.resetCameraClippingRange();
      vtk.view.getRenderWindow().render();
      projectProbe();
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
          <button
            type="button"
            onClick={exportProbeJson}
            disabled={!probe}
            title={probe ? 'Download probe.json with free-stream and Re context' : 'Probe the surface first'}
          >
            Export probe JSON
          </button>
          <button
            type="button"
            onClick={toggleVectors}
            aria-pressed={showVectors}
            title="Overlay sampled surface velocity vectors, coloured by |U| (light-path view, not volume streamlines)"
          >
            Flow vectors
          </button>
          <span className="cfd-vtk-hint">Click surface to probe</span>
        </div>
      </header>
      <span className="sr-only cfd-vtk-announce" role="status" aria-live="polite">
        {announcement}
      </span>
      <div
        className="cfd-vtk-canvas"
        role="img"
        aria-label={`3D CFD surface, ${field.toUpperCase()} field. Click the surface to sample p, U and T.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div ref={containerRef} className="cfd-vtk-surface" />
        {probe && (
          <>
            <span className="cfd-probe-dot" style={{ left: probe.left, top: probe.top }} aria-hidden="true" />
            <div className="cfd-probe" role="status">
              <div className="cfd-probe-head">
                <strong>Probe</strong>
                <button type="button" className="cfd-probe-close" onClick={() => { setProbe(null); probeWorldRef.current = null; onProbe?.(null); }} aria-label="Clear probe">×</button>
              </div>
              <dl>
                {(probe.readings && probe.readings.length > 0
                  ? probe.readings
                  : [
                      { name: 'p', label: 'p', value: probe.p },
                      { name: 'U', label: 'U', value: probe.u },
                      { name: 'T', label: 'T', value: probe.t },
                    ]
                ).map((r) => (
                  <Fragment key={r.name}>
                    <dt>{r.name}</dt><dd>{fmtProbe(r.value)}</dd>
                  </Fragment>
                ))}
              </dl>
              <p className="cfd-probe-coords">
                ({fmtProbe(probe.x)}, {fmtProbe(probe.y)}, {fmtProbe(probe.z)})
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
