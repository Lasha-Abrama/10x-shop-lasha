import { Injectable, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';
import { Prisma, Role } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CredentialsDto } from './credentials.dto';
import { JWT_TTL_SECONDS } from './auth.config';

const publicUserSelect = { id: true, email: true, role: true, createdAt: true, updatedAt: true } as const;
export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
const hashOptions = { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
const registrationMessage = 'Registration request processed. You can try signing in.';

function publicUser(user: PublicUser): PublicUser {
  return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt };
}

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async onModuleInit(): Promise<void> {
    // Unknown emails still perform a real password verification to reduce timing differences.
    this.dummyHash = await hash(randomBytes(32), hashOptions);
  }

  async register(credentials: CredentialsDto): Promise<{ message: string }> {
    const passwordHash = await hash(credentials.password, hashOptions);
    try {
      await this.prisma.user.create({
        data: { email: credentials.email, passwordHash, role: Role.USER },
        select: { id: true },
      });
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw new ServiceUnavailableException('Authentication service is temporarily unavailable.');
      }
      // A unique-constraint race has the same response as a new registration.
    }
    return { message: registrationMessage };
  }

  async login(credentials: CredentialsDto) {
    let user: (PublicUser & { passwordHash: string }) | null;
    try {
      user = await this.prisma.user.findUnique({
        where: { email: credentials.email }, select: { ...publicUserSelect, passwordHash: true },
      });
    } catch {
      throw new ServiceUnavailableException('Authentication service is temporarily unavailable.');
    }
    const valid = await verify(user?.passwordHash ?? this.dummyHash, credentials.password).catch(() => false);
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password.');
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }),
      tokenType: 'Bearer', expiresIn: JWT_TTL_SECONDS, user: publicUser(user),
    };
  }

  async currentUser(id: string): Promise<PublicUser> {
    let user: PublicUser | null;
    try {
      user = await this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
    } catch {
      throw new ServiceUnavailableException('Authentication service is temporarily unavailable.');
    }
    if (!user) throw new UnauthorizedException('Unauthorized');
    return publicUser(user);
  }
}
