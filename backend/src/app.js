import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { UPLOAD_DIRECTORY } from './lib/images.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import walletRoutes from './routes/wallet.js';
import auctionRoutes from './routes/auctions.js';
import matchRoutes from './routes/matches.js';
import healthRoutes from './routes/health.js';
import legalRoutes from './routes/legal.js';
import paymentRoutes from './routes/payments.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export const app = express();

// Always trust the configured number of proxy hops, not only in production. Behind
// nginx (and the Tailscale Funnel beyond it) every request otherwise arrives with the
// same source address, which collapses per-IP rate limiting into a single shared bucket.
app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
  }),
);
app.use(express.json({ limit: '100kb' }));

const tooMany = (message) => (_request, response) => {
  response.status(429).json({ error: { code: 'RATE_LIMITED', message } });
};

// Broad ceiling for the whole API. Deliberately loose: it is a flood guard, not a
// credential-stuffing guard. The strict per-endpoint limiters below do that job.
const globalLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  limit: config.rateLimitMax,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: tooMany('Demasiadas solicitudes. Intenta nuevamente en un momento.'),
});

// Credential endpoints get their own strict budget, keyed BOTH by source address and by
// the account being targeted, so one address cannot spray many accounts and many
// addresses cannot converge on one account.
const loginIpLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => `login-ip:${ipKeyGenerator(request.ip)}`,
  handler: tooMany('Demasiados intentos de inicio de sesión. Espera un minuto.'),
});

const loginEmailLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (request) => typeof request.body?.email !== 'string',
  keyGenerator: (request) => `login-email:${String(request.body.email).trim().toLowerCase()}`,
  handler: tooMany('Demasiados intentos para esta cuenta. Espera un minuto.'),
});

// Account creation is the other cheap-to-abuse endpoint: unthrottled it allows building
// an army of accounts for shill bidding.
const registerLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => `register-ip:${ipKeyGenerator(request.ip)}`,
  handler: tooMany('Demasiadas cuentas creadas desde esta conexión. Intenta más tarde.'),
});

// Product images are static files served before the rate limiter: a page showing a grid
// of photos would otherwise burn the caller's whole API budget on images alone.
app.use(
  '/api/uploads',
  express.static(UPLOAD_DIRECTORY, {
    index: false,
    dotfiles: 'deny',
    // File names contain a content hash, so a stored image is immutable.
    maxAge: '365d',
    immutable: true,
  }),
);

app.use('/api', globalLimiter);
app.use('/api/auth/login', loginIpLimiter, loginEmailLimiter);
app.use('/api/auth/register', registerLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/legal', legalRoutes);
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
