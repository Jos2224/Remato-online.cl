import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import walletRoutes from './routes/wallet.js';
import auctionRoutes from './routes/auctions.js';
import matchRoutes from './routes/matches.js';
import healthRoutes from './routes/health.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export const app = express();

if (config.isProduction) app.set('trust proxy', 1);
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
app.use(
  '/api',
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.rateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(_request, response) {
      response.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Demasiadas solicitudes. Intenta nuevamente en un momento.',
        },
      });
    },
  }),
);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
