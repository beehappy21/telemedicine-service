import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { SessionService } from './services/sessionService';
import { EmrClient } from './services/emrClient';
import { createTeleApi } from './api/teleApi';
import { createAuthMiddleware } from './middleware/auth';
import { ipRateLimiter } from './middleware/rateLimit';
import { requestLogger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';

export interface AppConfig {
  serviceToken: string;
  emrApiToken: string;
  notifyWebhookUrl?: string;
  dailyApiKey: string;
}

async function checkDailyCo(apiKey: string): Promise<boolean> {
  try {
    await fetch('https://api.daily.co/v1/rooms', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return true;
  } catch {
    return false;
  }
}

export function createApp(
  sessionService: SessionService,
  appConfig: AppConfig,
  emrClient: EmrClient
) {
  const app = express();
  app.use(requestLogger());
  app.use(express.json());

  // /health is public — no auth, no rate limit
  app.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [dbOk, dailyOk] = await Promise.all([
        sessionService.checkDb(),
        checkDailyCo(appConfig.dailyApiKey),
      ]);

      const healthy = dbOk && dailyOk;
      res.status(healthy ? 200 : 503).json({
        status: healthy ? 'ok' : 'degraded',
        service: 'telemedicine',
        checks: {
          database: dbOk ? 'ok' : 'error',
          dailyCo: dailyOk ? 'ok' : 'error',
        },
      });
    } catch (err) {
      next(err);
    }
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
  app.use('/api', createTeleApi(sessionService, emrClient, appConfig.notifyWebhookUrl));

  // Global error handler — must be last
  app.use(errorHandler());

  return app;
}
