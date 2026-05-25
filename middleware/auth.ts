import { Request, Response, NextFunction } from 'express';

export interface AuthConfig {
  serviceToken: string;
  emrApiToken: string;
}

export function createAuthMiddleware(config: AuthConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization header with Bearer token is required' });
      return;
    }

    const token = authHeader.slice(7);

    if (token !== config.serviceToken && token !== config.emrApiToken) {
      res.status(403).json({ error: 'Invalid token' });
      return;
    }

    next();
  };
}
