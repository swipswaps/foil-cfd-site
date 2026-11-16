import { useCallback, useEffect, useState } from 'react';

export type BackendStatus = 'probing' | 'online' | 'offline';

export interface BackendState {
  status: BackendStatus;
  backendOrigin: string;
  reason: string;
}

const DEV_BACKEND = 'http://127.0.0.1:8000';
const HTTPS_BACKEND = 'http://localhost:8002';

async function probeUrl(base: string, timeoutMs = 2500): Promise<{ online: boolean; reason: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/health`, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { online: false, reason: `HTTP ${res.status}` };
    await res.json();
    return { online: true, reason: 'ok' };
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : '';
    const msg = e instanceof Error ? e.message : String(e);
    return { online: false, reason: name === 'AbortError' ? 'timeout' : msg };
  } finally {
    clearTimeout(timer);
  }
}

export function useBackendProbe() {
  const [state, setState] = useState<BackendState>({
    status: 'probing',
    backendOrigin: '',
    reason: '',
  });

  const probe = useCallback(async () => {
    setState((s) => ({ ...s, status: 'probing' }));
    const isHttps =
      typeof window !== 'undefined' && window.location.protocol === 'https:';

    const candidates = isHttps
      ? [HTTPS_BACKEND, DEV_BACKEND]
      : [DEV_BACKEND, window.location.origin];

    for (const base of candidates) {
      const result = await probeUrl(base);
      if (result.online) {
        setState({ status: 'online', backendOrigin: base, reason: 'ok' });
        return;
      }
    }

    setState({
      status: 'offline',
      backendOrigin: '',
      reason: isHttps
        ? 'no localhost backend — run: docker compose up -d'
        : 'backend unreachable — run: docker compose up -d',
    });
  }, []);

  useEffect(() => {
    probe();
  }, [probe]);

  return { ...state, probe };
}
