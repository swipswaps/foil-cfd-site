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
// The first paint can block the main thread for several seconds while the 3D
// scene compiles shaders. A 2.5s same-origin probe then aborts after its
// response already arrived (the abort timer runs before the fetch microtask),
// so the badge sticks on "Static mode" until a manual Retry. The same-origin
// proxy is local, so a longer deadline costs nothing when it is healthy.
const SAME_ORIGIN_TIMEOUT_MS = 10_000;

const PERMISSION_DENIED =
  'local network permission blocked — allow this site in browser settings';
const PUBLIC_OFFLINE =
  'local backend offline — run: docker compose up -d, then Connect';

type LoopbackPermission = PermissionState | 'unknown';
type HostClass = 'loopback' | 'private' | 'public';

function classifyHost(rawHost: string): HostClass {
  const host = rawHost.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return 'loopback';
  if (host.endsWith('.local') || host.endsWith('.ts.net')) return 'private';
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return 'private';
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return 'private';
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return 'private';
  if (host.includes(':') && (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'))) {
    return 'private';
  }
  return 'public';
}

function pageHostClass(): HostClass {
  if (typeof window === 'undefined') return 'loopback';
  return classifyHost(window.location.hostname);
}

function pageNeedsConsent(): boolean {
  return pageHostClass() === 'public';
}

function candidateBases(isHttps: boolean, preferSameOrigin: boolean): string[] {
  const env = import.meta.env?.VITE_BACKEND_URL as string | undefined;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  // A public page uses the build-time backend only; a private/tailnet page
  // must try its own origin first, or a baked tailnet-IP URL breaks the moment
  // the app is opened through a different address (for example HTTPS Serve).
  if (!preferSameOrigin && env && env.trim()) return [env.trim().replace(/\/+$/, '')];
  const list: string[] = [];
  if (preferSameOrigin && origin) list.push(origin);
  if (env && env.trim()) list.push(env.trim().replace(/\/+$/, ''));
  list.push(...(isHttps ? HTTPS_BACKENDS : DEV_BACKENDS));
  if (origin) list.push(origin);
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

function offlineReason(needsConsent: boolean, blocked: boolean): string {
  if (blocked) return PERMISSION_DENIED;
  if (needsConsent) return PUBLIC_OFFLINE;
  return 'backend unreachable — run: docker compose up -d';
}

function actionLabelFor(needsConsent: boolean): string {
  return needsConsent ? 'Connect local backend' : 'Retry';
}

function initialState(): BackendState {
  return {
    status: 'probing',
    backendOrigin: '',
    reason: '',
    mode: 'static',
    solverAvailable: false,
    actionLabel: actionLabelFor(pageNeedsConsent()),
  };
}

export function useBackendProbe() {
  const [state, setState] = useState<BackendState>(initialState);

  const probe = useCallback(async () => {
    setState((s) => ({ ...s, status: 'probing', reason: '' }));
    const isHttps =
      typeof window !== 'undefined' && window.location.protocol === 'https:';
    const needsConsent = pageNeedsConsent();
    const preferSameOrigin = pageHostClass() === 'private';
    const actionLabel = actionLabelFor(needsConsent);
    const timeoutMs = needsConsent ? CONSENT_TIMEOUT_MS : LOCAL_TIMEOUT_MS;

    if (needsConsent) {
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

    const sameOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    let blocked = false;
    for (const base of candidateBases(isHttps, preferSameOrigin)) {
      const perBaseTimeout =
        preferSameOrigin && base === sameOrigin ? SAME_ORIGIN_TIMEOUT_MS : timeoutMs;
      const result = await probeUrl(base, perBaseTimeout);
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
    }

    setState({
      status: 'offline',
      backendOrigin: '',
      reason: offlineReason(needsConsent, blocked),
      mode: 'static',
      solverAvailable: false,
      actionLabel,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (!pageNeedsConsent()) {
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
