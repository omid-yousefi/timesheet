import { clearAuth, getToken } from './auth';

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

/**
 * Error thrown for any non-2xx API response. Carries the HTTP status and the
 * server-provided `detail` message (if any) so UI components can surface it.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

function redirectToLogin(): void {
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
}

/**
 * Typed fetch wrapper for the backend API.
 *
 * - Automatically attaches the JWT bearer token from storage when present.
 * - Sets JSON content-type for plain bodies, but leaves FormData untouched.
 * - On 401 (expired/invalid token) it clears the session and redirects to
 *   /login. On 403 *without* a token (FastAPI's "Not authenticated") it does
 *   the same, while genuine role-based 403s are re-thrown for the UI to handle.
 */
export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const { body } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let message = `خطای سرور (${res.status})`;
    try {
      const data = await res.json();
      message = data.detail || message;
    } catch {
      /* response had no JSON body */
    }

    if (res.status === 401 && token) {
      // Token present but rejected → expired/invalid → end the session.
      clearAuth();
      redirectToLogin();
    } else if (res.status === 403 && !token) {
      // No token at all → "403 Not authenticated" from HTTPBearer.
      clearAuth();
      redirectToLogin();
    }

    throw new ApiError(message, res.status);
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return undefined as unknown as T;
}
