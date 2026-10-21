import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Set DATABASE_URL in backend/.env before starting the backend.');
    super({ adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 10_000, max: 5 }) });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      await this.$queryRaw`SELECT 1`;
    } catch {
      await this.$disconnect();
      throw new Error('Database connection failed. Check backend/.env and Neon availability.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
