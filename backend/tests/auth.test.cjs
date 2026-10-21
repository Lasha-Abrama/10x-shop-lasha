const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { Test } = require('@nestjs/testing');
const { JwtService } = require('@nestjs/jwt');
const argon2 = require('argon2');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/database/prisma.service');
const { Prisma } = require('../dist/generated/prisma/client');
const { configureApp } = require('../dist/configure-app');
const { readAuthConfig, JWT_ISSUER, JWT_AUDIENCE } = require('../dist/auth/auth.config');

// Test-only key and storage. Never load .env or instantiate the real Prisma provider.
const testSecret = 'a'.repeat(64);
const origin = 'http://localhost:5173';
const credentials = { email: 'shopper@example.com', password: 'correct horse battery staple' };

async function fixture(context) {
  process.env.JWT_SECRET = testSecret;
  process.env.FRONTEND_ORIGINS = origin;
  const users = new Map();
  const calls = { create: [], find: [] };
  const failure = { create: false, find: false };
  const prisma = { user: {
    create: async (args) => {
      calls.create.push(args);
      if (failure.create) throw new Error('Private database diagnostic must not escape');
      if ([...users.values()].some((user) => user.email === args.data.email)) {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '7.10.1' });
      }
      const user = { ...args.data, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      users.set(user.id, user);
      return { id: user.id };
    },
    findUnique: async (args) => {
      calls.find.push(args);
      if (failure.find) throw new Error('Private database diagnostic must not escape');
      // Deliberately return the hash even for public selects to test response projection.
      return [...users.values()].find((user) => args.where.id ? user.id === args.where.id : user.email === args.where.email) ?? null;
    },
  } };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService).useValue(prisma).compile();
  const app = module.createNestApplication({ logger: false });
  context.after(() => app.close());
  configureApp(app, readAuthConfig().origins);
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  async function request(path, { body, rawBody, headers = {}, method = body === undefined && rawBody === undefined ? 'GET' : 'POST' } = {}) {
    const response = await fetch(`${base}${path}`, {
      method, headers: { ...(body !== undefined || rawBody !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(rawBody !== undefined ? { body: rawBody } : body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
  }
  async function registerAndLogin() {
    assert.equal((await request('/auth/register', { body: credentials })).status, 202);
    const login = await request('/auth/login', { body: credentials });
    assert.equal(login.status, 200);
    return login.body;
  }
  return { users, calls, failure, request, registerAndLogin, jwt: module.get(JwtService) };
}

function assertPublicUser(user) {
  assert.deepEqual(Object.keys(user).sort(), ['createdAt', 'email', 'id', 'role', 'updatedAt']);
  assert.equal(user.email, credentials.email);
}

test('configuration fails closed for missing/weak secrets and invalid frontend origins', () => {
  for (const env of [{}, { JWT_SECRET: 'short', FRONTEND_ORIGINS: origin },
    { JWT_SECRET: testSecret }, { JWT_SECRET: testSecret, FRONTEND_ORIGINS: '*' },
    { JWT_SECRET: testSecret, FRONTEND_ORIGINS: 'http://localhost:5173/path' },
    { JWT_SECRET: testSecret, FRONTEND_ORIGINS: 'https://untrusted.example.com' }]) {
    assert.throws(() => readAuthConfig(env), /JWT_SECRET|FRONTEND_ORIGINS/);
  }
  assert.deepEqual(readAuthConfig({ JWT_SECRET: testSecret, FRONTEND_ORIGINS: `${origin}, http://127.0.0.1:5173` }).origins,
    [origin, 'http://127.0.0.1:5173']);
});

test('compiled server refuses startup with missing JWT configuration before database access', () => {
  const result = spawnSync(process.execPath, [resolve(__dirname, '../dist/main.js')], {
    env: { ...process.env, JWT_SECRET: '', FRONTEND_ORIGINS: origin, DATABASE_URL: 'not-a-database-url' },
    encoding: 'utf8', timeout: 5000,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stderr.includes('JWT_SECRET must be'), true);
  assert.equal(result.stderr.includes('not-a-database-url'), false);
});

test('registration normalizes email, stores salted Argon2id and forces USER', async (context) => {
  const api = await fixture(context);
  const response = await api.request('/auth/register', { body: { ...credentials, email: ' Shopper@EXAMPLE.com ' } });
  assert.equal(response.status, 202);
  assert.deepEqual(Object.keys(response.body), ['message']);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const [user] = api.users.values();
  assert.equal(user.email, credentials.email);
  assert.equal(user.role, 'USER');
  assert.equal(user.passwordHash.startsWith('$argon2id$v=19$'), true);
  assert.deepEqual(user.passwordHash.split('$')[3].split(',').sort(), ['m=19456', 'p=1', 't=2']);
  assert.notEqual(user.passwordHash, credentials.password);
  assert.equal(await argon2.verify(user.passwordHash, credentials.password), true);
  const other = await api.request('/auth/register', { body: { ...credentials, email: 'another@example.com' } });
  assert.equal(other.status, 202);
  assert.notEqual([...api.users.values()][1].passwordHash, user.passwordHash);
  assert.deepEqual(api.calls.create[0].select, { id: true });
});

test('duplicate email and concurrent unique-constraint races have identical acknowledgements', async (context) => {
  const api = await fixture(context);
  const responses = await Promise.all([api.request('/auth/register', { body: credentials }), api.request('/auth/register', { body: credentials })]);
  assert.deepEqual(responses.map((response) => response.status), [202, 202]);
  assert.deepEqual(responses[0].body, responses[1].body);
  assert.equal(api.users.size, 1);
  const original = [...api.users.values()][0].passwordHash;
  const duplicate = await api.request('/auth/register', { body: { ...credentials, password: 'a different valid password' } });
  assert.deepEqual(duplicate.body, responses[0].body);
  assert.equal([...api.users.values()][0].passwordHash, original);
  assert.equal(api.calls.find.length, 0);
});

test('HTTP validation rejects malformed data, short/oversized passwords and client roles', async (context) => {
  for (const [name, body] of [
    ['email', { ...credentials, email: 'not-an-email' }],
    ['short password', { ...credentials, password: 'x'.repeat(14) }],
    ['long password', { ...credentials, password: 'x'.repeat(129) }],
    ['non-string email', { ...credentials, email: {} }],
    ['non-string password', { ...credentials, password: 123456789012345 }],
    ['role injection', { ...credentials, role: 'ADMIN' }],
    ['unknown field', { ...credentials, extra: 'value' }],
    ['array body', [credentials]],
  ]) {
    await context.test(name, async (subcontext) => {
      const api = await fixture(subcontext);
      for (const path of ['/auth/register', '/auth/login']) {
        const response = await api.request(path, { body });
        assert.equal(response.status, 400);
        assert.equal(response.body.message, 'Invalid request body.');
      }
      assert.equal(api.calls.create.length, 0);
      assert.equal(api.calls.find.length, 0);
    });
  }
});

test('password length boundaries are accepted without trimming or truncation', async (context) => {
  const api = await fixture(context);
  for (const [index, password] of [' '.repeat(15), 'x'.repeat(128)].entries()) {
    const input = { email: `boundary${index}@example.com`, password };
    assert.equal((await api.request('/auth/register', { body: input })).status, 202);
    assert.equal((await api.request('/auth/login', { body: input })).status, 200);
  }
});

test('malformed JSON returns a safe validation error without echoing its body', async (context) => {
  const api = await fixture(context);
  const response = await api.request('/auth/login', { rawBody: '{"password":"private-input-example",broken}' });
  assert.equal(response.status, 400);
  assert.equal(JSON.stringify(response.body).includes('private-input-example'), false);
  assert.equal(api.calls.find.length, 0);
});

test('login returns a signed 15-minute JWT with minimal claims and public fields only', async (context) => {
  const api = await fixture(context);
  const login = await api.registerAndLogin();
  assertPublicUser(login.user);
  assert.equal(login.tokenType, 'Bearer');
  assert.equal(login.expiresIn, 900);
  const claims = await api.jwt.verifyAsync(login.accessToken, { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE });
  assert.deepEqual(Object.keys(claims).sort(), ['aud', 'exp', 'iat', 'iss', 'role', 'sub']);
  assert.equal(claims.exp - claims.iat, 900);
  assert.equal(claims.sub, login.user.id);
  assert.equal(claims.role, 'USER');
  const me = await api.request('/auth/me', { headers: { Authorization: `Bearer ${login.accessToken}` } });
  assert.equal(me.status, 200);
  assertPublicUser(me.body);
  assert.equal(me.headers.get('cache-control'), 'no-store');
});

test('unknown email and incorrect password share the same generic error and verification work', async (context) => {
  const api = await fixture(context);
  await api.registerAndLogin();
  const verification = context.mock.method(argon2, 'verify');
  const wrong = await api.request('/auth/login', { body: { ...credentials, password: 'incorrect password value' } });
  const unknown = await api.request('/auth/login', { body: { ...credentials, email: 'unknown@example.com' } });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.body, unknown.body);
  assert.equal(wrong.body.message, 'Invalid email or password.');
  assert.equal(verification.mock.callCount(), 2);
  for (const call of verification.mock.calls) assert.match(call.arguments[0], /^\$argon2id\$/);
});

test('me rejects missing, malformed, expired, inactive, incorrectly signed and invalid-claim tokens', async (context) => {
  const api = await fixture(context);
  const login = await api.registerAndLogin();
  const claims = { sub: login.user.id, role: 'USER' };
  const bareSigner = new JwtService({ secret: testSecret });
  const tokens = [
    await api.jwt.signAsync(claims, { expiresIn: -1 }),
    await api.jwt.signAsync(claims, { notBefore: 60 }),
    await api.jwt.signAsync(claims, { secret: 'b'.repeat(64) }),
    await api.jwt.signAsync(claims, { issuer: 'different-service' }),
    await api.jwt.signAsync(claims, { audience: 'different-client' }),
    await api.jwt.signAsync(claims, { algorithm: 'HS384' }),
    await api.jwt.signAsync({ ...claims, sub: 'not-a-uuid' }),
    await api.jwt.signAsync({ ...claims, role: 'OWNER' }),
    await bareSigner.signAsync({ ...claims, iss: JWT_ISSUER, aud: JWT_AUDIENCE }),
  ];
  const headers = [undefined, 'Basic test', 'Bearer garbage', `Bearer ${login.accessToken} extra`,
    ...tokens.map((token) => `Bearer ${token}`)];
  for (const authorization of headers) {
    const response = await api.request('/auth/me', { headers: authorization ? { Authorization: authorization } : {} });
    assert.equal(response.status, 401);
    assert.equal(response.body.message, 'Unauthorized');
  }
});

test('me reloads the current database role and rejects a deleted user with an otherwise valid JWT', async (context) => {
  const api = await fixture(context);
  const login = await api.registerAndLogin();
  api.users.get(login.user.id).role = 'ADMIN';
  const options = { headers: { Authorization: `Bearer ${login.accessToken}` } };
  assert.equal((await api.request('/auth/me', options)).body.role, 'ADMIN');
  api.users.delete(login.user.id);
  assert.equal((await api.request('/auth/me', options)).status, 401);
});

test('database failures return sanitized errors without private diagnostics', async (context) => {
  const api = await fixture(context);
  const login = await api.registerAndLogin();
  api.failure.create = true;
  api.failure.find = true;
  const responses = [await api.request('/auth/register', { body: credentials }),
    await api.request('/auth/login', { body: credentials }),
    await api.request('/auth/me', { headers: { Authorization: `Bearer ${login.accessToken}` } })];
  for (const response of responses) {
    assert.equal(response.status, 503);
    assert.equal(response.body.message, 'Authentication service is temporarily unavailable.');
    assert.equal(JSON.stringify(response.body).includes('Private database'), false);
  }
});

test('rate limits apply independently to registration and login and ignore spoofed forwarded IPs', async (context) => {
  const api = await fixture(context);
  for (const [path, limit] of [['/auth/register', 5], ['/auth/login', 10]]) {
    for (let count = 0; count < limit; count += 1) assert.equal((await api.request(path, { body: {} })).status, 400);
    const blocked = await api.request(path, { body: {}, headers: { 'X-Forwarded-For': '192.0.2.100' } });
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  }
});

test('CORS permits the configured frontend, withholds other origins and enables no cookies', async (context) => {
  const api = await fixture(context);
  const allowed = await api.request('/health', { headers: { Origin: origin } });
  assert.equal(allowed.status, 200);
  assert.deepEqual(allowed.body, { status: 'ok' });
  assert.equal(allowed.headers.get('access-control-allow-origin'), origin);
  assert.equal(allowed.headers.get('access-control-allow-credentials'), null);
  const blocked = await api.request('/health', { headers: { Origin: 'https://untrusted.example.com' } });
  assert.equal(blocked.headers.get('access-control-allow-origin'), null);
  const preflight = await api.request('/auth/login', { method: 'OPTIONS', headers: {
    Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type',
  } });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/);
});
