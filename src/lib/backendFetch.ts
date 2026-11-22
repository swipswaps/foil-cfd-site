export type AddressSpace = 'loopback' | 'local' | 'public';

interface AddressSpaceInit extends RequestInit {
  targetAddressSpace?: AddressSpace;
}

function hostOf(url: string): string {
  try {
    const host = new URL(url, window.location.href).hostname;
    return host.replace(/^\[|\]$/g, '');
  } catch {
    return '';
  }
}

export function addressSpaceFor(url: string): AddressSpace | null {
  const host = hostOf(url);
  if (!host) return null;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return 'loopback';
  if (host.endsWith('.local')) return 'local';
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return 'local';
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return 'local';
  return null;
}

export function backendFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const space = addressSpaceFor(url);
  const opts = { ...init } as AddressSpaceInit;
  if (space && window.location.protocol === 'https:') {
    opts.targetAddressSpace = space;
  }
  return fetch(input, opts);
}
