export function readAuthConfig(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.JWT_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error('JWT_SECRET must be 64 random hexadecimal characters in backend/.env.');
  }
  const origins = env.FRONTEND_ORIGINS?.split(',').map((origin) => origin.trim());
  if (!origins?.length || !origins.every(isLocalOrigin)) {
    throw new Error('FRONTEND_ORIGINS must contain explicit, comma-separated local frontend origins.');
  }
  return { secret, origins };
}

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.origin === origin && ['http:', 'https:'].includes(url.protocol)
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

export const JWT_ISSUER = '10x-shop';
export const JWT_AUDIENCE = '10x-shop-api';
export const JWT_TTL_SECONDS = 15 * 60;
