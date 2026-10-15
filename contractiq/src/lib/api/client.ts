import type { ApiErrorBody } from '@/types/api';

// Browser fetch helper: parses the error envelope into ApiError and
// sends unauthenticated users to /login (api-conventions.md §5).
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
    public readonly retryAfter?: number,
    public readonly reason?: string,
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(input: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (typeof init.body === 'string' && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const res = await fetch(input, { ...init, headers, credentials: 'same-origin' });

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      body = null;
    }
    if (res.status === 401 && typeof window !== 'undefined') {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.assign(`/login?next=${next}`);
    }
    const retryAfter = Number(res.headers.get('Retry-After')) || undefined;
    throw new ApiError(
      body?.error.code ?? 'INTERNAL',
      res.status,
      body?.error.message ?? 'Something went wrong. Please try again.',
      body?.error.fieldErrors,
      retryAfter,
      body?.error.reason,
      body?.error.detail,
    );
  }

  return (await res.json()) as T;
}
