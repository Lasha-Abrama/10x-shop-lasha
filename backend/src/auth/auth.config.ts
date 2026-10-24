export function readAuthConfig(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.JWT_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error('JWT_SECRET must be 64 random hexadecimal characters in the backend environment.');
  }
  const origins = env.FRONTEND_ORIGINS?.split(',').map((origin) => origin.trim());
  if (!origins?.length || !origins.every((origin) => isFrontendOrigin(origin, env.NODE_ENV === 'production'))) {
    throw new Error('FRONTEND_ORIGINS must contain explicit, comma-separated HTTPS origins (HTTP loopback only outside production).');
  }
  return { secret, origins };
}

function isFrontendOrigin(origin: string, production: boolean): boolean {
  try {
    const url = new URL(origin);
    const localHttp = !production && url.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return url.origin === origin && !url.hostname.includes('*')
      && (url.protocol === 'https:' || localHttp);
  } catch { return false; }
}

export const JWT_ISSUER = '10x-shop';
export const JWT_AUDIENCE = '10x-shop-api';
export const JWT_TTL_SECONDS = 15 * 60;
