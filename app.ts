import express, { Request, Response } from 'express';
import path from 'path';
import { SessionService } from './services/sessionService';
import { EmrClient } from './services/emrClient';
import { createTeleApi } from './api/teleApi';
import { createAuthMiddleware } from './middleware/auth';
import { ipRateLimiter } from './middleware/rateLimit';

export interface AppConfig {
  serviceToken: string;
  emrApiToken: string;
}

export function createApp(
  sessionService: SessionService,
  appConfig: AppConfig,
  emrClient: EmrClient
) {
  const app = express();
  app.use(express.json());

  // /health is public — no auth, no rate limit
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'telemedicine' });
  });

  // Frontend pages — public, no auth
  const frontendDir = path.join(process.cwd(), 'frontend');
  app.get('/app/patient', (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDir, 'patient.html'));
  });
  app.get('/app/doctor', (_req: Request, res: Response) => {
    res.sendFile(path.join(frontendDir, 'doctor.html'));
  });

  // All /api routes: global IP rate limit then auth
  app.use('/api', ipRateLimiter());
  app.use('/api', createAuthMiddleware({ serviceToken: appConfig.serviceToken, emrApiToken: appConfig.emrApiToken }));
  app.use('/api', createTeleApi(sessionService, emrClient));

  return app;
}
