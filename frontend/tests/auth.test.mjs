import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authenticate, deleteSession, restoreSession, AuthApiError, getApiBaseUrl, parseAuthUser, registerAccount, REGISTRATION_ACK, validateCredentials } from '../src/api/auth.ts';
import { authReducer, canAccessAccount, initialAuthState } from '../src/auth/state.ts';

const registrationPassword = '🌿'.repeat(12);
const credentials = { email: ' Shopper@EXAMPLE.com ', password: 'correct horse battery staple' };
const user = { id: '3381026f-bc0d-466f-bab3-ef735b663c35', email: 'shopper@example.com', role: 'USER', createdAt: '2026-10-21T10:00:00.000Z', updatedAt: '2026-10-21T10:00:00.000Z' };
const base = 'http://localhost:3000';
const signal = () => new AbortController().signal;

test('API configuration accepts public HTTP bases and rejects credentials/query/hash/unsafe schemes', () => {
  assert.equal(getApiBaseUrl(base + '/'), base);
  assert.equal(getApiBaseUrl('https://api.example.com/api/'), 'https://api.example.com/api');
  for (const value of ['', 'javascript:alert(1)', 'http://user:password@example.com', base + '?secret=value', base + '#hash']) {
    assert.throws(() => getApiBaseUrl(value), AuthApiError);
  }
});

test('login accepts new passwords and preserves previously accepted whitespace and Unicode passwords', () => {
  assert.deepEqual(validateCredentials(credentials), {});
  for (const password of ['x'.repeat(12), 'x'.repeat(128), ' '.repeat(15), '🌿'.repeat(15), '✈️'.repeat(128)]) {
    assert.deepEqual(validateCredentials({ ...credentials, password }), {});
  }
  for (const password of ['', 'x'.repeat(11)]) assert.ok(validateCredentials({ ...credentials, password }).password);
  for (const email of ['', 'missing-at.example.com', 'name@', 'name@example', 'a b@example.com', 'é@example.com']) {
    assert.ok(validateCredentials({ ...credentials, email }).email);
  }
});

test('registration counts Unicode code points and rejects whitespace without composition rules', () => {
  for (const password of ['a'.repeat(12), 'a'.repeat(128), 'lowercasepassphrase', 'MixedCasePassword', registrationPassword, '✈️'.repeat(64)]) {
    assert.deepEqual(validateCredentials({ ...credentials, password }, 'register'), {});
  }
  for (const password of ['', 'a'.repeat(11), 'a'.repeat(129), '🌿'.repeat(129), '✈️'.repeat(65)]) {
    assert.match(validateCredentials({ ...credentials, password }, 'register').password, /characters/);
  }
  for (const password of [' abcdefghijkl', 'abcdefghijkl ', 'abcdef ghijkl', 'abcdef\tghijkl', 'abcdefghijkl\n', 'abcdef\u0085ghijkl', 'abcdef\u00a0ghijkl', 'abcdef\uFEFFghijkl']) {
    assert.match(validateCredentials({ ...credentials, password }, 'register').password, /whitespace/);
  }
});

test('public user parsing validates consumed fields and strips hashes/extra data', () => {
  assert.deepEqual(parseAuthUser({ ...user, passwordHash: 'not retained' }), user);
  for (const invalid of [null, {}, { ...user, id: 'bad' }, { ...user, role: 'OWNER' },
    { ...user, createdAt: 'not-a-date' }, { ...user, email: '' }, { ...user, updatedAt: null }]) {
    assert.throws(() => parseAuthUser(invalid), AuthApiError);
  }
});

test('registration sends normalized credentials only and preserves the neutral duplicate acknowledgement', async (context) => {
  let calls = 0;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    calls += 1;
    assert.equal(url, base + '/auth/register');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), { email: user.email, password: registrationPassword });
    return Response.json({ message: REGISTRATION_ACK }, { status: 202 });
  });
  assert.equal(await registerAccount({ ...credentials, password: registrationPassword }, signal(), base), REGISTRATION_ACK);
  assert.equal(await registerAccount({ ...credentials, password: registrationPassword }, signal(), base), REGISTRATION_ACK);
  assert.equal(calls, 2);
});

test('registration never treats an unexpected success message as a confirmed new account', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Account definitely created!' }));
  await assert.rejects(registerAccount({ ...credentials, password: registrationPassword }, signal(), base), /unexpected response/);
});

test('login verifies the cookie session without exposing the token to React', async (context) => {
  const urls = [];
  const expiresAt = Date.now() + 900_000;
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    urls.push(url);
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.headers['X-Shop-Session'], 'browser');
    assert.equal(options.headers.Authorization, undefined);
    if (url.endsWith('/login')) return Response.json({ user });
    return Response.json({ user: { ...user, role: 'ADMIN', passwordHash: 'not retained' }, expiresAt });
  });
  const session = await authenticate(credentials, signal(), base);
  assert.deepEqual(urls, [base + '/auth/login', base + '/auth/session']);
  assert.deepEqual(session, { user: { ...user, role: 'ADMIN' }, expiresAt });
});

test('restore distinguishes an absent cookie from a failed request and logout requires confirmation', async (context) => {
  let status = 401;
  const fetch = context.mock.method(globalThis, 'fetch', async () => Response.json({}, { status }));
  assert.equal(await restoreSession(signal(), base), null);
  status = 503;
  await assert.rejects(restoreSession(signal(), base), { status: 503 });
  await assert.rejects(deleteSession(signal(), base), { status: 503 });
  fetch.mock.mockImplementation(async (url, options) => {
    assert.equal(url, base + '/auth/logout');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-Shop-Session'], 'browser');
    return new Response(null, { status: 204 });
  });
  await deleteSession(signal(), base);
});

test('malformed login or mismatched cookie session cannot authenticate', async (context) => {
  let data = { user: {} };
  let calls = 0;
  context.mock.method(globalThis, 'fetch', async (url) => {
    calls += 1;
    return Response.json(url.endsWith('/login') ? data : {
      user: { ...user, id: 'fb1d7a93-2e35-4377-bc1a-287296fca136' }, expiresAt: Date.now() + 900_000,
    });
  });
  await assert.rejects(authenticate(credentials, signal(), base), /unexpected response/);
  assert.equal(calls, 1);
  data = { user };
  await assert.rejects(authenticate(credentials, signal(), base), /unexpected response/);
  assert.equal(calls, 3);
});

test('validation, login, throttling and server errors use safe messages instead of backend details', async (context) => {
  let status;
  context.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Private server detail' }, { status }));
  for (status of [400, 401, 429, 500, 503]) {
    await assert.rejects(authenticate(credentials, signal(), base), (error) => error instanceof AuthApiError
      && error.status === status && !error.message.includes('Private'));
  }
});

test('invalid client input makes no network request; network failures and invalid JSON are recoverable', async (context) => {
  const mock = context.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Private network diagnostic'); });
  await assert.rejects(authenticate({ ...credentials, password: 'short' }, signal(), base), AuthApiError);
  assert.equal(mock.mock.callCount(), 0);
  await assert.rejects(authenticate(credentials, signal(), base), /couldn’t connect/);
  mock.mock.mockImplementation(async () => new Response('<html>not JSON</html>'));
  await assert.rejects(authenticate(credentials, signal(), base), /unexpected response/);
});

test('cancellation is forwarded and does not become a misleading network error', async (context) => {
  const controller = new AbortController();
  controller.abort();
  context.mock.method(globalThis, 'fetch', async (_url, options) => { options.signal.throwIfAborted(); });
  await assert.rejects(authenticate(credentials, controller.signal, base), { name: 'AbortError' });
});

test('timeouts before headers and during JSON have distinct messaging without swallowing caller cancellation', async (context) => {
  const timeout = new DOMException('Timed out', 'TimeoutError');
  const mock = context.mock.method(globalThis, 'fetch', async () => { throw timeout; });
  for (const request of [authenticate, registerAccount]) {
    await assert.rejects(request({ ...credentials, password: registrationPassword }, signal(), base), /took too long to respond/);
  }
  mock.mock.mockImplementation(async () => ({ ok: true, json: async () => { throw timeout; } }));
  await assert.rejects(registerAccount({ ...credentials, password: registrationPassword }, signal(), base), /took too long to respond/);
  const expired = new AbortController();
  expired.abort(timeout);
  context.mock.method(AbortSignal, 'timeout', () => expired.signal);
  mock.mock.mockImplementation(async () => ({ ok: true, json: async () => { throw new DOMException('Body aborted', 'AbortError'); } }));
  await assert.rejects(registerAccount({ ...credentials, password: registrationPassword }, signal(), base), /took too long to respond/);
  const controller = new AbortController();
  controller.abort();
  mock.mock.mockImplementation(async (_url, options) => { options.signal.throwIfAborted(); });
  await assert.rejects(registerAccount({ ...credentials, password: registrationPassword }, controller.signal, base), { name: 'AbortError' });
});

test('auth reducer protects guests, handles pending/login/logout, and rejects expired sessions', (context) => {
  let now = 1000;
  context.mock.method(Date, 'now', () => now);
  const session = { user, expiresAt: 2000 };
  assert.equal(canAccessAccount(initialAuthState), false);
  const pending = authReducer(initialAuthState, { type: 'begin' });
  assert.equal(pending.status, 'authenticating');
  assert.equal(canAccessAccount(pending), false);
  const authenticated = authReducer(pending, { type: 'authenticated', session });
  assert.equal(canAccessAccount(authenticated), true);
  const loggedOut = authReducer(authenticated, { type: 'guest', notice: 'You have signed out.' });
  assert.equal(loggedOut.session, null);
  assert.equal(canAccessAccount(loggedOut), false);
  assert.equal(loggedOut.notice, 'You have signed out.');
  assert.equal(authReducer(authenticated, { type: 'begin' }).session, null);
  now = 2000;
  assert.equal(canAccessAccount(authenticated), false);
  const expired = authReducer(pending, { type: 'authenticated', session });
  assert.equal(expired.status, 'guest');
  assert.equal(expired.session, null);
  assert.match(expired.notice, /expired/);
  assert.equal(initialAuthState.session, null);
});
