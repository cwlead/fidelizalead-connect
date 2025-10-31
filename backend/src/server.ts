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
import { processDueConnectionChecks } from './services/connection.await.service';
import { adminJobs } from './routes/admin.jobs';

import { orgConnectionRouter } from './routes/org.connection';
import { wppGroupsRouter } from './routes/wpp.groups';
import { campaignsRouter } from './routes/campaigns';
import { sequencesRouter } from './routes/sequences';
import { campaignMaterialize } from './routes/campaign.materialize';
import path from 'node:path';
import uploads from './routes/uploads';
import filesRouter from './routes/files';

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

//setInterval(() => {
//  processDueConnectionChecks(10).catch(() => {});
// }, 10_000);

app.use('/api/admin', adminJobs);
app.use('/evolution', evolutionWebhook);
app.use('/api/evolution', evolutionWebhook); // recebe tenant instance


  app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/org', orgConnectionRouter); // → GET /api/org/connection/summary
app.use('/api/wpp', wppGroupsRouter);
app.use('/api', campaignsRouter);
app.use('/api', sequencesRouter);
app.use('/api/campaigns', campaignMaterialize);

// Seta limite de imagem na criacao de sequencia
app.use(
  '/api/sequences',
  express.json({ limit: '15mb' }),
  express.urlencoded({ extended: true, limit: '15mb' })
);


// Rota upload
app.use('/api/files', filesRouter);
const uploadsDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads_public');
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', index: false }));

// **rota de upload**
app.use('/api/uploads', uploads);


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
