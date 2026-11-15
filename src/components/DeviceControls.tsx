export type Device = 'phone' | 'tablet' | 'desktop';

interface Props {
  device: Device;
  onDeviceChange: (d: Device) => void;
}

const OPTIONS: { id: Device; label: string; hint: string }[] = [
  { id: 'phone', label: 'Phone', hint: '390px · mobile layout' },
  { id: 'tablet', label: 'Tablet', hint: '768px · two-column layout' },
  { id: 'desktop', label: 'Desktop', hint: 'Full width · default layout' },
];

export function DeviceControls({ device, onDeviceChange }: Props) {
  return (
    <div className="device-controls" role="group" aria-label="Preview device">
      <span className="device-controls-label">Preview</span>
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onDeviceChange(o.id)}
          className={device === o.id ? 'active' : ''}
          aria-pressed={device === o.id}
          title={o.hint}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
