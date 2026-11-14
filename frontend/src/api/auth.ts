export type AuthUser = {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  updatedAt: string;
};
export type Credentials = { email: string; password: string };
export type AuthSession = { user: AuthUser; expiresAt: number };
export const REGISTRATION_ACK = 'Registration request processed. You can try signing in.';
const timeoutMessage = 'The account service took too long to respond. Please try again.';

export class AuthApiError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) { super(message); this.status = status; }
}

export function validateCredentials(credentials: Credentials, mode: 'login' | 'register' = 'login'): Partial<Record<keyof Credentials, string>> {
  const email = credentials.email.trim().toLowerCase();
  const errors: Partial<Record<keyof Credentials, string>> = {};
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !/^[\x21-\x7e]+$/.test(email.split('@')[0])) errors.email = 'Enter a valid email address.';
  const length = [...credentials.password].length;
  if (mode === 'register') {
    if (length < 12) errors.password = 'Use at least 12 characters.';
    else if (length > 128) errors.password = 'Use no more than 128 characters.';
    else if (/[\s\p{White_Space}]/u.test(credentials.password)) errors.password = 'Spaces and other whitespace are not allowed.';
  } else if (length < 12) {
    errors.password = 'Enter your password.';
  }
  return errors;
}

export const sessionHeaders = { 'X-Shop-Session': 'browser' };

export function getApiBaseUrl(value = '/api'): string {
  if (value === '/api') return typeof location === 'undefined' ? value : `${location.origin}${value}`;
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
  const timeout = AbortSignal.timeout(15_000);
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl(baseUrl)}${path}`, {
      ...options, signal: AbortSignal.any([signal, timeout]),
      credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    });
  } catch (error: unknown) {
    if (signal.aborted || error instanceof AuthApiError) throw error;
    if (timeout.aborted || (error instanceof DOMException && error.name === 'TimeoutError')) {
      throw new AuthApiError(timeoutMessage);
    }
    throw new AuthApiError('We couldn’t connect to the account service. Check your connection and try again.');
  }
  if (!response.ok) {
    const message = response.status === 401 ? path === '/auth/login' ? 'Invalid email or password.' : 'Your session is no longer valid. Please sign in again.'
      : response.status === 400 ? 'Check your email and password, then try again.'
      : response.status === 429 ? 'Too many attempts. Please wait a minute before trying again.'
      : 'The account service is unavailable. Please try again later.';
    throw new AuthApiError(message, response.status);
  }
  if (response.status === 204) return null;
  try { return await response.json(); }
  catch (error: unknown) {
    if (signal.aborted) throw error;
    if (timeout.aborted || (error instanceof DOMException && error.name === 'TimeoutError')) throw new AuthApiError(timeoutMessage);
    throw invalidResponse();
  }
}

function credentialsRequest(credentials: Credentials, mode: 'login' | 'register'): RequestInit {
  if (Object.keys(validateCredentials(credentials, mode)).length) throw new AuthApiError('Check your email and password, then try again.');
  return {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: credentials.email.trim().toLowerCase(), password: credentials.password }),
  };
}

export async function registerAccount(credentials: Credentials, signal: AbortSignal, baseUrl?: string): Promise<string> {
  const data = await request('/auth/register', signal, credentialsRequest(credentials, 'register'), baseUrl);
  if (!record(data) || data.message !== REGISTRATION_ACK) throw invalidResponse();
  return REGISTRATION_ACK;
}

export async function restoreSession(signal: AbortSignal, baseUrl?: string): Promise<AuthSession | null> {
  try {
    const data = await request('/auth/session', signal, { headers: sessionHeaders }, baseUrl);
    if (!record(data) || typeof data.expiresAt !== 'number' || !Number.isSafeInteger(data.expiresAt)) throw invalidResponse();
    return { user: parseAuthUser(data.user), expiresAt: data.expiresAt };
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) return null;
    throw error;
  }
}

export async function authenticate(credentials: Credentials, signal: AbortSignal, baseUrl?: string): Promise<AuthSession> {
  const options = credentialsRequest(credentials, 'login');
  const data = await request('/auth/login', signal, {
    ...options, headers: { ...options.headers, ...sessionHeaders },
  }, baseUrl);
  if (!record(data)) throw invalidResponse();
  const loginUser = parseAuthUser(data.user);
  const session = await restoreSession(signal, baseUrl);
  if (!session) throw new AuthApiError('Your session is no longer valid. Please sign in again.', 401);
  if (session.user.id !== loginUser.id || session.expiresAt <= Date.now()) throw invalidResponse();
  return session;
}

export async function deleteSession(signal: AbortSignal, baseUrl?: string): Promise<void> {
  const data = await request('/auth/logout', signal, { method: 'POST', headers: sessionHeaders }, baseUrl);
  if (data !== null) throw invalidResponse();
}
