import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './env';
import { health } from './routes/health';
import { tenants } from './routes/tenants';
import { botconversa } from './routes/botconversa';
import { errorHandler } from './middlewares/error-handler';
import { auth } from './routes/auth';
import { onboarding } from './routes/onboarding';
import pinoHttp from 'pino-http';
import { logger } from './logger';
import { evolution } from './routes/evolution';
import { evolutionWebhook } from './routes/evolution.webhook';
import { evolutionWebhookSet } from './routes/evolution.webhook.set';

export function buildServer() {
  const app = express();

  // HTTP request logging (opcional via env)
  if (process.env.LOG_HTTP === 'true') {
    app.use(
      pinoHttp({
        logger,
        customLogLevel: (_req, res, err) => {
          if (err) return 'error';
          const s = res.statusCode;
          if (s >= 500) return 'error';
          if (s >= 400) return 'warn';
          return 'info';
        },
      })
    );
  }

app.use('/evolution', evolutionWebhook);
app.use('/api/evolution', evolutionWebhook); // recebe tenant instance


  app.use(helmet());
  app.use(express.json());

  app.use(
    cors({
      origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : true,
      credentials: true,
    })
  );

app.use('/evolution', evolutionWebhookSet);      // ✅ router de SET correto
app.use('/api/evolution', evolutionWebhookSet);  // idem com prefixo /api

  // monta rotas em um "base path" ('' e '/api')
  const mount = (base = '') => {
    app.use(base, health);                 // GET /health
    app.use(base + '/tenants', tenants);   // /tenants/*
    app.use(base + '/botconversa', botconversa);
    app.use(base + '/evolution', evolution);
    app.use(base, auth);                   // /auth/*
    app.use(base, onboarding);             // /onboarding
  };

  // expõe sem prefixo e com /api
  mount('');
  mount('/api');

  app.use(errorHandler);

  return app;
}
