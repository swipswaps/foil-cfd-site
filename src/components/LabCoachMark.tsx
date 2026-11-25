import { useState } from 'react';

const DISMISS_KEY = 'foil.coach.dismissed';

/**
 * Dismissible first-run guide for the lab. Orbit, probe, and field are the
 * three actions that make the lab useful and are not obvious on first sight.
 * Dismissal is remembered per browser.
 */
export function LabCoachMark() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode: still hide for this session */
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="cfd-coach" role="note" aria-label="Getting started with the 3D lab">
      <div className="cfd-coach-head">
        <strong>Getting started</strong>
        <button type="button" className="cfd-coach-close" onClick={dismiss} aria-label="Dismiss guide">
          ×
        </button>
      </div>
      <ol>
        <li><b>Orbit</b> — drag the scene, or focus it and use the arrow keys.</li>
        <li><b>Probe</b> — click the surface, or move the probe station slider, to read p, |U|, and T.</li>
        <li><b>Field</b> — switch pressure, velocity, and temperature from the Field menu.</li>
      </ol>
      <button type="button" className="upload-btn cfd-coach-dismiss" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
