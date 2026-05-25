import express, { Request, Response } from 'express';
import { SessionService } from './services/sessionService';
import { createTeleApi } from './api/teleApi';
import { createAuthMiddleware } from './middleware/auth';
import { ipRateLimiter } from './middleware/rateLimit';

export interface AppConfig {
  serviceToken: string;
  emrApiToken: string;
}

export function createApp(sessionService: SessionService, appConfig: AppConfig) {
  const app = express();
  app.use(express.json());

  // /health is public — no auth, no rate limit
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'telemedicine' });
  });

  // All /api routes: global IP rate limit then auth
  app.use('/api', ipRateLimiter());
  app.use('/api', createAuthMiddleware({ serviceToken: appConfig.serviceToken, emrApiToken: appConfig.emrApiToken }));
  app.use('/api', createTeleApi(sessionService));

  return app;
}
