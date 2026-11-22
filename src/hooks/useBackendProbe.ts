import { useCallback, useEffect, useState } from 'react';
import { backendFetch } from '../lib/backendFetch';

export type BackendStatus = 'probing' | 'online' | 'offline';
export type BackendMode = 'static' | 'cfd';

export interface BackendState {
  status: BackendStatus;
  backendOrigin: string;
  reason: string;
  mode: BackendMode;
  solverAvailable: boolean;
  actionLabel: string;
}

const DEV_BACKENDS = ['http://127.0.0.1:8000', 'http://127.0.0.1:8002'];
const HTTPS_BACKENDS = ['http://127.0.0.1:8002', 'http://127.0.0.1:8000', 'http://localhost:8002'];
const LOCAL_TIMEOUT_MS = 2_500;
const CONSENT_TIMEOUT_MS = 30_000;

const PERMISSION_DENIED =
  'local network permission blocked — allow this site in browser settings';
const PUBLIC_OFFLINE =
  'local backend offline — run: docker compose up -d, then Connect';

type LoopbackPermission = PermissionState | 'unknown';

function pageIsLoopback(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname.replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

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

async function loopbackPermission(): Promise<LoopbackPermission> {
  try {
    if (typeof navigator === 'undefined' || !navigator.permissions) return 'unknown';
    const status = await navigator.permissions.query({
      name: 'loopback-network' as PermissionName,
    });
    return status.state;
  } catch {
    return 'unknown';
  }
}

interface ProbeResult {
  online: boolean;
  reason: string;
  solverAvailable: boolean;
  blocked: boolean;
}

async function probeUrl(base: string, timeoutMs: number): Promise<ProbeResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await backendFetch(`${base}/api/health`, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { online: false, reason: `HTTP ${res.status}`, solverAvailable: false, blocked: false };
    }
    const health = (await res.json()) as { solver_available?: boolean };
    return {
      online: true,
      reason: 'ok',
      solverAvailable: health?.solver_available === true,
      blocked: false,
    };
  } catch (e: unknown) {
    const name = e instanceof Error ? e.name : '';
    const msg = e instanceof Error ? e.message : String(e);
    const blocked =
      name === 'NotAllowedError' ||
      /local network|loopback|private network|local-network/i.test(msg);
    return {
      online: false,
      reason: name === 'AbortError' ? 'timeout' : msg,
      solverAvailable: false,
      blocked,
    };
  } finally {
    clearTimeout(timer);
  }
}

function offlineReason(publicPage: boolean, blocked: boolean, timedOut: boolean): string {
  if (blocked) return PERMISSION_DENIED;
  if (publicPage) return PUBLIC_OFFLINE;
  if (timedOut) return 'backend unreachable — run: docker compose up -d';
  return 'backend unreachable — run: docker compose up -d';
}

function initialState(): BackendState {
  const publicPage = !pageIsLoopback();
  return {
    status: 'probing',
    backendOrigin: '',
    reason: '',
    mode: 'static',
    solverAvailable: false,
    actionLabel: publicPage ? 'Connect local backend' : 'Retry',
  };
}

export function useBackendProbe() {
  const [state, setState] = useState<BackendState>(initialState);

  const probe = useCallback(async () => {
    setState((s) => ({ ...s, status: 'probing', reason: '' }));
    const isHttps =
      typeof window !== 'undefined' && window.location.protocol === 'https:';
    const publicPage = !pageIsLoopback();
    const actionLabel = publicPage ? 'Connect local backend' : 'Retry';

    if (publicPage) {
      const permission = await loopbackPermission();
      if (permission === 'denied') {
        setState({
          status: 'offline',
          backendOrigin: '',
          reason: PERMISSION_DENIED,
          mode: 'static',
          solverAvailable: false,
          actionLabel,
        });
        return;
      }
    }

    let blocked = false;
    let timedOut = false;
    for (const base of candidateBases(isHttps)) {
      const result = await probeUrl(base, publicPage ? CONSENT_TIMEOUT_MS : LOCAL_TIMEOUT_MS);
      if (result.online) {
        setState({
          status: 'online',
          backendOrigin: base,
          reason: 'ok',
          mode: 'cfd',
          solverAvailable: result.solverAvailable,
          actionLabel,
        });
        return;
      }
      blocked = blocked || result.blocked;
      timedOut = timedOut || result.reason === 'timeout';
    }

    setState({
      status: 'offline',
      backendOrigin: '',
      reason: offlineReason(publicPage, blocked, timedOut),
      mode: 'static',
      solverAvailable: false,
      actionLabel,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (pageIsLoopback()) {
        probe();
        return;
      }
      const permission = await loopbackPermission();
      if (cancelled) return;
      if (permission === 'granted') {
        probe();
        return;
      }
      setState((s) => ({
        ...s,
        status: 'offline',
        backendOrigin: '',
        mode: 'static',
        reason: permission === 'denied' ? PERMISSION_DENIED : PUBLIC_OFFLINE,
        actionLabel: 'Connect local backend',
      }));
    };
    start();
    return () => {
      cancelled = true;
    };
  }, [probe]);

  return { ...state, probe };
}
