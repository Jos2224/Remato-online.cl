import 'dotenv/config';
import { randomBytes } from 'node:crypto';

const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

// Any secret that has ever been published in this repo, its examples, its compose
// defaults or its docs. Checked in EVERY environment, not just production: a weak
// secret in staging is just as forgeable as one in production.
const KNOWN_WEAK_SECRETS = new Set([
  'development-only-change-me',
  'cambia-esta-clave-en-produccion',
  'cambia-esta-clave-admin',
  'change-this-long-random-secret-before-deploying',
  'demo12345',
  'Admin123456!',
  'Demo123456!',
  'rematoonline_local',
  'postgres',
  'changeme',
  'secret',
]);

const MIN_SECRET_LENGTH = 32;
const MIN_PASSWORD_LENGTH = 12;

const generateSecret = () => randomBytes(48).toString('base64');

function rejectWeak(name, value, { minLength }) {
  if (KNOWN_WEAK_SECRETS.has(value)) {
    throw new Error(
      `${name} is set to a publicly known value from this repository. ` +
        `Generate a fresh one, e.g. \`openssl rand -base64 48\`.`,
    );
  }
  if (value.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters long.`);
  }
  return value;
}

function resolveJwtSecret() {
  const raw = process.env.JWT_SECRET?.trim();
  if (!raw) {
    if (isProduction) {
      throw new Error(
        'JWT_SECRET must be configured in production. Generate one with `openssl rand -base64 48`.',
      );
    }
    // Development convenience: a per-process random secret. Tokens do not survive a
    // restart, which is correct — it also makes an accidental weak default impossible.
    const ephemeral = generateSecret();
    console.warn('[config] JWT_SECRET is unset; using a random per-process secret (development only).');
    return ephemeral;
  }
  return rejectWeak('JWT_SECRET', raw, { minLength: MIN_SECRET_LENGTH });
}

function resolveAdminPassword() {
  const raw = process.env.ADMIN_PASSWORD?.trim();
  if (!raw) {
    throw new Error(
      'ADMIN_PASSWORD must be configured. The admin account holds every platform fee and ' +
        'penalty, so it has no default. Generate one with `openssl rand -base64 24`.',
    );
  }
  return rejectWeak('ADMIN_PASSWORD', raw, { minLength: MIN_PASSWORD_LENGTH });
}

function resolveDemoPassword() {
  const raw = process.env.DEMO_PASSWORD?.trim();
  // Optional by design: with no DEMO_PASSWORD the demo seed refuses to run rather than
  // creating accounts with a guessable password.
  if (!raw) return null;
  return rejectWeak('DEMO_PASSWORD', raw, { minLength: MIN_PASSWORD_LENGTH });
}

export const config = Object.freeze({
  nodeEnv,
  isProduction,
  port: parseInteger(process.env.PORT, 4000),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/rematoonline',
  databaseSsl: parseBoolean(process.env.DATABASE_SSL),
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  adminEmail: (process.env.ADMIN_EMAIL ?? 'admin@rematoonline.cl')
    .trim()
    .toLowerCase(),
  adminPassword: resolveAdminPassword(),
  demoPassword: resolveDemoPassword(),
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  rateLimitWindowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMax: parseInteger(process.env.RATE_LIMIT_MAX, 300),
  // Optional mail transport. When unset, e-mail verification stays switched off and new
  // accounts are created already verified — see lib/mailer.js.
  smtpUrl: process.env.SMTP_URL?.trim() || null,
  mailFrom: process.env.MAIL_FROM?.trim() || 'RematoOnline <no-reply@rematoonline.cl>',
  appUrl: process.env.APP_URL?.trim() || 'http://localhost:4173',
  // Pasarela de pagos. Sin claves configuradas, el abono con tarjeta queda deshabilitado
  // y se conserva el abono simulado sólo fuera de producción.
  flow: Object.freeze({
    apiKey: process.env.FLOW_API_KEY?.trim() || null,
    secretKey: process.env.FLOW_SECRET_KEY?.trim() || null,
    baseUrl: (process.env.FLOW_BASE_URL?.trim() || 'https://sandbox.flow.cl/api').replace(/\/$/, ''),
  }),
  // Trust the reverse proxy in front of us (nginx, and the Tailscale Funnel beyond it).
  // Configurable because getting this wrong silently breaks per-IP rate limiting: too
  // low and every request shares one bucket, too high and clients can spoof their IP.
  trustProxy: parseInteger(process.env.TRUST_PROXY_HOPS, 1),
  chileTimeZone: 'America/Santiago',
});
