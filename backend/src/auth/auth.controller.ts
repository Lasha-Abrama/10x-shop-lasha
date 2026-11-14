import { Body, Controller, Get, Header, HttpCode, Post, Req, Res, ForbiddenException, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CredentialsDto, RegistrationCredentialsDto } from './credentials.dto';
import { JwtAuthGuard, SESSION_COOKIE } from './jwt-auth.guard';
import type { AuthRequest } from './jwt-auth.guard';

type CookieResponse = { setHeader(name: string, value: string): void };
const cookieAttributes = 'Path=/; HttpOnly; SameSite=Strict' + (process.env.NODE_ENV === 'production' ? '; Secure' : '');

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Body() credentials: RegistrationCredentialsDto) { return this.auth.register(credentials); }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(ThrottlerGuard)
  async login(@Body() credentials: CredentialsDto, @Req() request: AuthRequest, @Res({ passthrough: true }) response: CookieResponse) {
    const session = await this.auth.login(credentials);
    if (request.headers['x-shop-session'] !== 'browser') return session;
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${session.accessToken}; ${cookieAttributes}; Max-Age=${session.expiresIn}`);
    return { user: session.user };
  }

  @Get('session')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  session(@Req() request: AuthRequest) {
    if (!request.user || !request.expiresAt) throw new UnauthorizedException('Unauthorized');
    return { user: request.user, expiresAt: request.expiresAt };
  }

  @Post('logout')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: CookieResponse) {
    if (request.headers['x-shop-session'] !== 'browser') throw new ForbiddenException();
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; ${cookieAttributes}; Max-Age=0`);
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthRequest) {
    if (!request.user) throw new UnauthorizedException('Unauthorized');
    return request.user;
  }
}
