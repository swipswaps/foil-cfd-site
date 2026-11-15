import { useCallback, useEffect, useState } from 'react';

export type SketchForgeStatus = 'probing' | 'online' | 'offline';

const EDITOR_URL = 'http://127.0.0.1:8090';

async function probe(timeoutMs = 1500): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(EDITOR_URL, {
      method: 'GET',
      mode: 'no-cors',
      signal: ctrl.signal,
      cache: 'no-store',
    });
    return res.type === 'opaque' || res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export function useSketchForgeProbe() {
  const [status, setStatus] = useState<SketchForgeStatus>('probing');
  const [url] = useState(EDITOR_URL);

  const run = useCallback(async () => {
    setStatus('probing');
    const ok = await probe();
    setStatus(ok ? 'online' : 'offline');
  }, []);

  useEffect(() => { run(); }, [run]);

  return { status, url, probe: run };
}
