import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { AuthService } from './auth.service';
import type { PublicUser } from './auth.service';
import { JWT_AUDIENCE, JWT_ISSUER } from './auth.config';

export type AuthRequest = { headers: { authorization?: string }; user?: PublicUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const header = request.headers.authorization;
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
    } catch { throw new UnauthorizedException('Unauthorized'); }
    // The database is authoritative: deleted users and stale role claims are not trusted.
    request.user = await this.auth.currentUser(userId);
    return true;
  }
}
