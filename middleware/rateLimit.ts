import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyFn: (req: Request) => string;
}

export function createRateLimiter(
  options: RateLimitOptions,
  getClock: () => number = Date.now
) {
  const store = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = options.keyFn(req);
    const now = getClock();
    const entry = store.get(key);

    if (!entry || now >= entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (entry.count >= options.maxRequests) {
      res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
      return;
    }

    entry.count++;
    next();
  };
}

export function ipRateLimiter(windowMs = 60_000, maxRequests = 60) {
  return createRateLimiter({
    windowMs,
    maxRequests,
    keyFn: (req) => `ip:${req.ip ?? 'unknown'}`,
  });
}

export function clinicRateLimiter(windowMs = 60_000, maxRequests = 10) {
  return createRateLimiter({
    windowMs,
    maxRequests,
    keyFn: (req) => `clinic:${(req.body as Record<string, string>)?.emr_clinic_id ?? 'unknown'}`,
  });
}
