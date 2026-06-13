// Lightweight, dependency-free auth token helpers.
// Tokens are stored in localStorage because the API is stateless (JWT in the
// Authorization header), which keeps us immune to CSRF without cookies.

const TOKEN_KEY = 'ts_access_token';
const ROLE_KEY = 'ts_role';

/** True only in a browser environment (guards against SSR access). */
const isBrowser = (): boolean => typeof window !== 'undefined';

export function getToken(): string | null {
  return isBrowser() ? window.localStorage.getItem(TOKEN_KEY) : null;
}

export function getRole(): string | null {
  return isBrowser() ? window.localStorage.getItem(ROLE_KEY) : null;
}

export function setAuth(token: string, role: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(ROLE_KEY, role);
}

export function clearAuth(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ROLE_KEY);
}

/** Clears the session and forces a full navigation back to the login page. */
export function logout(): void {
  clearAuth();
  if (isBrowser()) {
    window.location.assign('/login');
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
