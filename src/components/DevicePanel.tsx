export type DevicePick = 'auto' | 'phone' | 'tablet' | 'desktop';
export type DetectedDevice = 'phone' | 'tablet' | 'desktop';

interface Props {
  pick: DevicePick;
  detected: DetectedDevice;
  onChange: (d: DevicePick) => void;
}

const OPTS: { id: DevicePick; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'phone', label: 'Phone' },
  { id: 'tablet', label: 'Tablet' },
  { id: 'desktop', label: 'Desktop' },
];

export function DevicePanel({ pick, detected, onChange }: Props) {
  return (
    <div className="sidebar-section">
      <div className="sidebar-section-label">
        Preview <span className="sidebar-section-hint">
          {pick === 'auto' ? `following viewport (${detected})` : 'manual'}
        </span>
      </div>
      <div className="device-pick">
        {OPTS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={pick === o.id ? 'active' : ''}
            aria-pressed={pick === o.id}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
