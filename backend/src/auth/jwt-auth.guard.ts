import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { AuthService } from './auth.service';
import type { PublicUser } from './auth.service';
import { JWT_AUDIENCE, JWT_ISSUER } from './auth.config';

export const SESSION_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-shop-session' : 'shop-session';
export type AuthRequest = {
  headers: { authorization?: string; cookie?: string; 'x-shop-session'?: string };
  user?: PublicUser;
  expiresAt?: number;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    // Cookie requests require a custom header. CORS does not allow it cross-origin.
    const cookie = request.headers['x-shop-session'] === 'browser'
      ? request.headers.cookie?.split(';').find((entry) => entry.trim().startsWith(`${SESSION_COOKIE}=`))?.trim().slice(SESSION_COOKIE.length + 1)
      : undefined;
    const header = request.headers.authorization ?? (cookie ? `Bearer ${cookie}` : undefined);
    if (typeof header !== 'string' || header.length > 4096) throw new UnauthorizedException('Unauthorized');
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(header);
    if (!match) throw new UnauthorizedException('Unauthorized');
    let userId: string;
    try {
      const claims = await this.jwt.verifyAsync<Record<string, unknown>>(match[1], {
        algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE,
      });
      if (typeof claims.sub !== 'string' || !isUUID(claims.sub)
        || (claims.role !== 'USER' && claims.role !== 'ADMIN')
        || typeof claims.exp !== 'number' || !Number.isSafeInteger(claims.exp)) {
        throw new Error('Invalid token claims');
      }
      userId = claims.sub;
      request.expiresAt = claims.exp * 1000;
    } catch { throw new UnauthorizedException('Unauthorized'); }
    // The database is authoritative: deleted users and stale role claims are not trusted.
    request.user = await this.auth.currentUser(userId);
    return true;
  }
}
