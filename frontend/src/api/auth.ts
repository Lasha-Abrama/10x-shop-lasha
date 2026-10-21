export type AuthUser = {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  updatedAt: string;
};
export type Credentials = { email: string; password: string };
export type AuthSession = { user: AuthUser; token: string; expiresAt: number };
export const REGISTRATION_ACK = 'Registration request processed. You can try signing in.';

export class AuthApiError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) { super(message); this.status = status; }
}

export function validateCredentials(credentials: Credentials): Partial<Record<keyof Credentials, string>> {
  const email = credentials.email.trim().toLowerCase();
  const errors: Partial<Record<keyof Credentials, string>> = {};
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !/^[\x21-\x7e]+$/.test(email.split('@')[0])) errors.email = 'Enter a valid email address.';
  const length = [...credentials.password].length;
  if (length < 15 || length > 128) errors.password = 'Use 15–128 characters. Spaces count and are kept as entered.';
  return errors;
}

export function getApiBaseUrl(value: string = import.meta.env?.VITE_API_BASE_URL ?? 'http://localhost:3000'): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    return url.href.replace(/\/$/, '');
  } catch { throw new AuthApiError('The account service is not configured correctly. Please try again later.'); }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAuthUser(value: unknown): AuthUser {
  if (!record(value) || typeof value.id !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id)
    || typeof value.email !== 'string' || value.email.length === 0
    || (value.role !== 'USER' && value.role !== 'ADMIN')
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))
    || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) throw invalidResponse();
  return { id: value.id, email: value.email, role: value.role, createdAt: value.createdAt, updatedAt: value.updatedAt };
}

function invalidResponse(): AuthApiError {
  return new AuthApiError('The account service returned an unexpected response. Please try again.');
}

async function request(path: string, signal: AbortSignal, options: RequestInit, baseUrl?: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl(baseUrl)}${path}`, {
      ...options, signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      credentials: 'omit', cache: 'no-store', redirect: 'error',
    });
  } catch (error: unknown) {
    if (signal.aborted || error instanceof AuthApiError) throw error;
    throw new AuthApiError('We couldn’t connect to the account service. Check your connection and try again.');
  }
  if (!response.ok) {
    const message = response.status === 401 ? path === '/auth/login' ? 'Invalid email or password.' : 'Your session is no longer valid. Please sign in again.'
      : response.status === 400 ? 'Check your email and password, then try again.'
      : response.status === 429 ? 'Too many attempts. Please wait a minute before trying again.'
      : 'The account service is unavailable. Please try again later.';
    throw new AuthApiError(message, response.status);
  }
  try { return await response.json(); }
  catch (error: unknown) { if (signal.aborted) throw error; throw invalidResponse(); }
}

function credentialsRequest(credentials: Credentials): RequestInit {
  if (Object.keys(validateCredentials(credentials)).length) throw new AuthApiError('Check your email and password, then try again.');
  return {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: credentials.email.trim().toLowerCase(), password: credentials.password }),
  };
}

export async function registerAccount(credentials: Credentials, signal: AbortSignal, baseUrl?: string): Promise<string> {
  const data = await request('/auth/register', signal, credentialsRequest(credentials), baseUrl);
  if (!record(data) || data.message !== REGISTRATION_ACK) throw invalidResponse();
  return REGISTRATION_ACK;
}

export async function authenticate(credentials: Credentials, signal: AbortSignal, baseUrl?: string): Promise<AuthSession> {
  const startedAt = Date.now();
  const data = await request('/auth/login', signal, credentialsRequest(credentials), baseUrl);
  if (!record(data) || typeof data.accessToken !== 'string' || data.accessToken.length > 4096
    || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.accessToken)
    || data.tokenType !== 'Bearer' || typeof data.expiresIn !== 'number'
    || !Number.isSafeInteger(data.expiresIn) || data.expiresIn <= 0 || data.expiresIn > 900) throw invalidResponse();
  const loginUser = parseAuthUser(data.user);
  const user = parseAuthUser(await request('/auth/me', signal, {
    headers: { Authorization: `Bearer ${data.accessToken}` },
  }, baseUrl));
  const expiresAt = startedAt + data.expiresIn * 1000;
  if (user.id !== loginUser.id || expiresAt <= Date.now()) throw invalidResponse();
  // Treat the token as opaque; only the backend verifies its signature and claims.
  return { user, token: data.accessToken, expiresAt };
}
