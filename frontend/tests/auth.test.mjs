import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authenticate, AuthApiError, getApiBaseUrl, parseAuthUser, registerAccount, REGISTRATION_ACK, validateCredentials } from '../src/api/auth.ts';
import { authReducer, canAccessAccount, initialAuthState } from '../src/auth/state.ts';

const credentials = { email: ' Shopper@EXAMPLE.com ', password: 'correct horse battery staple' };
const user = { id: '3381026f-bc0d-466f-bab3-ef735b663c35', email: 'shopper@example.com', role: 'USER', createdAt: '2026-10-21T10:00:00.000Z', updatedAt: '2026-10-21T10:00:00.000Z' };
const token = 'test.payload.signature';
const loginResponse = { accessToken: token, tokenType: 'Bearer', expiresIn: 900, user };
const base = 'http://localhost:3000';
const signal = () => new AbortController().signal;

test('API configuration accepts public HTTP bases and rejects credentials/query/hash/unsafe schemes', () => {
  assert.equal(getApiBaseUrl(base + '/'), base);
  assert.equal(getApiBaseUrl('https://api.example.com/api/'), 'https://api.example.com/api');
  for (const value of ['', 'javascript:alert(1)', 'http://user:password@example.com', base + '?secret=value', base + '#hash']) {
    assert.throws(() => getApiBaseUrl(value), AuthApiError);
  }
});

test('credential validation follows 15–128 character policy, preserves spaces and supports Unicode passwords', () => {
  assert.deepEqual(validateCredentials(credentials), {});
  for (const password of ['x'.repeat(15), 'x'.repeat(128), ' '.repeat(15), '🌿'.repeat(15)]) {
    assert.deepEqual(validateCredentials({ ...credentials, password }), {});
  }
  for (const password of ['', 'x'.repeat(14), 'x'.repeat(129)]) assert.ok(validateCredentials({ ...credentials, password }).password);
  for (const email of ['', 'missing-at.example.com', 'name@', 'name@example', 'a b@example.com', 'é@example.com']) {
    assert.ok(validateCredentials({ ...credentials, email }).email);
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
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), { email: user.email, password: credentials.password });
    return Response.json({ message: REGISTRATION_ACK }, { status: 202 });
  });
  assert.equal(await registerAccount(credentials, signal(), base), REGISTRATION_ACK);
  assert.equal(await registerAccount(credentials, signal(), base), REGISTRATION_ACK);
  assert.equal(calls, 2);
});

test('registration never treats an unexpected success message as a confirmed new account', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => Response.json({ message: 'Account definitely created!' }));
  await assert.rejects(registerAccount(credentials, signal(), base), /unexpected response/);
});

test('login is confirmed by me before returning a memory session, using only a bearer header', async (context) => {
  const urls = [];
  const started = Date.now();
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    urls.push(url);
    assert.equal(options.credentials, 'omit');
    assert.ok(options.signal instanceof AbortSignal);
    if (url.endsWith('/login')) return Response.json(loginResponse);
    assert.deepEqual(options.headers, { Authorization: `Bearer ${token}` });
    assert.equal(options.body, undefined);
    return Response.json({ ...user, role: 'ADMIN', passwordHash: 'not retained' });
  });
  const session = await authenticate(credentials, signal(), base);
  assert.deepEqual(urls, [base + '/auth/login', base + '/auth/me']);
  assert.equal(session.token, token);
  assert.equal(session.user.role, 'ADMIN');
  assert.equal('passwordHash' in session.user, false);
  assert.ok(session.expiresAt >= started + 900000 && session.expiresAt <= Date.now() + 900000);
});

test('malformed login responses cannot populate a session or reach me', async (context) => {
  let response;
  let calls = 0;
  context.mock.method(globalThis, 'fetch', async () => { calls += 1; return Response.json(response); });
  const invalid = [null, {}, { ...loginResponse, tokenType: 'Cookie' }, { ...loginResponse, accessToken: 'malformed' },
    ...[0, -1, 901, 1.5, Infinity].map((expiresIn) => ({ ...loginResponse, expiresIn })),
    { ...loginResponse, user: {} }];
  for (response of invalid) await assert.rejects(authenticate(credentials, signal(), base), /unexpected response/);
  assert.equal(calls, invalid.length);
});

test('invalid/expired bearer tokens rejected by me never produce an authenticated session', async (context) => {
  context.mock.method(globalThis, 'fetch', async (url) => url.endsWith('/login')
    ? Response.json(loginResponse) : Response.json({ message: 'Private server detail' }, { status: 401 }));
  await assert.rejects(authenticate(credentials, signal(), base), (error) => error instanceof AuthApiError
    && error.status === 401 && error.message.includes('Please sign in again') && !error.message.includes('Private'));
});

test('me must return the same user ID as login and a valid public user response', async (context) => {
  let me;
  context.mock.method(globalThis, 'fetch', async (url) => Response.json(url.endsWith('/login') ? loginResponse : me));
  for (me of [{ ...user, id: 'fb1d7a93-2e35-4377-bc1a-287296fca136' }, null, { ...user, role: 'OWNER' }]) {
    await assert.rejects(authenticate(credentials, signal(), base), /unexpected response/);
  }
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

test('auth reducer protects guests, handles pending/login/logout, and rejects expired sessions', (context) => {
  let now = 1000;
  context.mock.method(Date, 'now', () => now);
  const session = { user, token, expiresAt: 2000 };
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
  assert.equal(initialAuthState.session, null); // A fresh provider always starts as guest.
});
