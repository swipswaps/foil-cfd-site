import createPlotlyComponentImport from 'react-plotly.js/factory';
import Plotly from 'plotly.js/lib/core';
import * as scatterTrace from 'plotly.js/lib/scatter';
import { SAMPLE_LOWER, SAMPLE_UPPER, type CpPoint } from '../lib/cp';

const scatterModule =
  (scatterTrace as unknown as { default?: unknown }).default ?? scatterTrace;

Plotly.register([scatterModule] as unknown as Parameters<typeof Plotly.register>[0]);

const factory =
  (createPlotlyComponentImport as unknown as { default?: typeof createPlotlyComponentImport })
    .default ?? createPlotlyComponentImport;

const Plot = (factory as (p: unknown) => React.ComponentType<Record<string, unknown>>)(Plotly);

export type { CpPoint } from '../lib/cp';

interface Props {
  upper?: CpPoint[];
  lower?: CpPoint[];
  title?: string;
}

/** A chordwise pressure-coefficient distribution (Cp vs x/c), not a polar. */
export function CpDistributionChart({
  upper = SAMPLE_UPPER, lower = SAMPLE_LOWER,
  title = 'Pressure coefficient distribution (Cp vs x/c)',
}: Props) {
  return (
    <section className="cfd-chart">
      <Plot
        data={[
          { x: upper.map((p) => p.x), y: upper.map((p) => p.cp), type: 'scatter', mode: 'lines+markers', name: 'Upper', line: { width: 3, color: '#5BC0EB' } },
          { x: lower.map((p) => p.x), y: lower.map((p) => p.cp), type: 'scatter', mode: 'lines+markers', name: 'Lower', line: { width: 3, color: '#F4A261' } },
        ]}
        layout={{
          autosize: true,
          title: { text: title, font: { color: '#E2F4FF', size: 13 } },
          paper_bgcolor: '#0B1A24',
          plot_bgcolor: '#06121A',
          font: { color: '#C9DDE8', size: 11 },
          xaxis: { title: { text: 'x/c' }, range: [0, 1], gridcolor: '#1E3A4A' },
          yaxis: { title: { text: 'Cp' }, autorange: 'reversed', gridcolor: '#1E3A4A' },
          legend: { orientation: 'h', y: -0.2, font: { size: 10 } },
          margin: { l: 55, r: 20, t: 40, b: 50 },
        }}
        config={{ responsive: true, displaylogo: false }}
        style={{ width: '100%', height: 360 }}
        useResizeHandler
      />
    </section>
  );
}
