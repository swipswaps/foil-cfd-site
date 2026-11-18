import { useCallback, useEffect, useState } from 'react';

export type BackendStatus = 'probing' | 'online' | 'offline';
export type BackendMode = 'static' | 'cfd';

export interface BackendState {
  status: BackendStatus;
  backendOrigin: string;
  reason: string;
  mode: BackendMode;
  solverAvailable: boolean;
}

const DEV_BACKENDS = ['http://127.0.0.1:8000', 'http://127.0.0.1:8002'];
const HTTPS_BACKENDS = ['http://localhost:8002', 'http://127.0.0.1:8000', 'http://127.0.0.1:8002'];

function candidateBases(isHttps: boolean): string[] {
  const env = import.meta.env?.VITE_BACKEND_URL as string | undefined;
  const list: string[] = [];
  if (env && env.trim()) {
    list.push(env.trim().replace(/\/+$/, ''));
  } else {
    list.push(...(isHttps ? HTTPS_BACKENDS : DEV_BACKENDS));
  }
  if (typeof window !== 'undefined') list.push(window.location.origin);
  return Array.from(new Set(list));
}

interface ProbeResult {
  online: boolean;
  reason: string;
  solverAvailable: boolean;
}

async function probeUrl(base: string, timeoutMs = 2500): Promise<ProbeResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/api/health`, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { online: false, reason: `HTTP ${res.status}`, solverAvailable: false };
    const health = (await res.json()) as { solver_available?: boolean };
    return { online: true, reason: 'ok', solverAvailable: health?.solver_available === true };
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : '';
    const msg = e instanceof Error ? e.message : String(e);
    return { online: false, reason: name === 'AbortError' ? 'timeout' : msg, solverAvailable: false };
  } finally {
    clearTimeout(timer);
  }
}

export function useBackendProbe() {
  const [state, setState] = useState<BackendState>({
    status: 'probing',
    backendOrigin: '',
    reason: '',
    mode: 'static',
    solverAvailable: false,
  });

  const probe = useCallback(async () => {
    setState((s) => ({ ...s, status: 'probing' }));
    const isHttps =
      typeof window !== 'undefined' && window.location.protocol === 'https:';

    for (const base of candidateBases(isHttps)) {
      const result = await probeUrl(base);
      if (result.online) {
        setState({
          status: 'online',
          backendOrigin: base,
          reason: 'ok',
          mode: 'cfd',
          solverAvailable: result.solverAvailable,
        });
        return;
      }
    }

    setState({
      status: 'offline',
      backendOrigin: '',
      reason: isHttps
        ? 'no localhost backend — run: docker compose up -d'
        : 'backend unreachable — run: docker compose up -d',
      mode: 'static',
      solverAvailable: false,
    });
  }, []);

  useEffect(() => {
    probe();
  }, [probe]);

  return { ...state, probe };
}
