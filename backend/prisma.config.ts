import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

const envFile = resolve(__dirname, '.env');
if (existsSync(envFile)) loadEnvFile(envFile);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generation/validation work offline; database commands require a direct URL.
  datasource: { url: process.env.DIRECT_URL ?? '' },
});
