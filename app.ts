import express, { Request, Response } from 'express';
import { SessionService } from './services/sessionService';
import { createTeleApi } from './api/teleApi';

export function createApp(sessionService: SessionService) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'telemedicine' });
  });

  app.use('/api', createTeleApi(sessionService));

  return app;
}
