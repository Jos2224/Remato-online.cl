import 'dotenv/config';

const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const nodeEnv = process.env.NODE_ENV ?? 'development';
const jwtSecret = process.env.JWT_SECRET ?? 'development-only-change-me';

if (nodeEnv === 'production' && jwtSecret === 'development-only-change-me') {
  throw new Error('JWT_SECRET must be configured in production');
}

export const config = Object.freeze({
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: parseInteger(process.env.PORT, 4000),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/rematoonline',
  databaseSsl: parseBoolean(process.env.DATABASE_SSL),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  adminEmail: (process.env.ADMIN_EMAIL ?? 'admin@rematoonline.cl')
    .trim()
    .toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD ?? 'Admin123456!',
  demoPassword: process.env.DEMO_PASSWORD ?? 'Demo123456!',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  rateLimitWindowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMax: parseInteger(process.env.RATE_LIMIT_MAX, 300),
  chileTimeZone: 'America/Santiago',
});
