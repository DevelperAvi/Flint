import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Database
  DATABASE_URL: z.string().default('postgresql://flint:flintpassword@localhost:5432/flint_db'),
  DIRECT_URL: z.string().optional(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32).default('c8e763b38198fba3d52684e2098d655f462bb8214197ac7256e6dca18b28ef94'),
  JWT_REFRESH_SECRET: z.string().min(32).default('7f51e4df71ca463d8e67b245059601e4f041f8be65be695d89fef01b3b64faa9'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),

  // S3 / R2 (Has defaults so server can start even before S3 is provisioned)
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('auto'),
  S3_ACCESS_KEY_ID: z.string().default('minioadmin'),
  S3_SECRET_ACCESS_KEY: z.string().default('minioadmin123'),
  S3_BUCKET_NAME: z.string().default('flint-media'),
  S3_PUBLIC_URL: z.string().default('http://localhost:9000/flint-media'),

  // App
  CORS_ORIGIN: z.string().default('*'),
  APP_URL: z.string().default('http://localhost:3000'),

  // BullMQ
  BULL_CONCURRENCY: z.coerce.number().default(5),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
