import express from 'express';
import request from 'supertest';
import { createRateLimiter, ipRateLimiter, clinicRateLimiter } from '../middleware/rateLimit';

describe('createRateLimiter', () => {
  let mockTime: number;
  const getClock = () => mockTime;

  function makeApp(maxRequests: number) {
    mockTime = 0;
    const limiter = createRateLimiter(
      { windowMs: 60_000, maxRequests, keyFn: () => 'fixed-key' },
      getClock
    );
    const app = express();
    app.use(express.json());
    app.use(limiter);
    app.get('/test', (_req, res) => res.json({ ok: true }));
    return app;
  }

  it('allows requests up to the limit', async () => {
    const app = makeApp(2);
    expect((await request(app).get('/test')).status).toBe(200);
    expect((await request(app).get('/test')).status).toBe(200);
  });

  it('429 on the request that exceeds the limit', async () => {
    const app = makeApp(2);
    await request(app).get('/test');
    await request(app).get('/test');
    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/rate limit/i);
  });

  it('resets counter after the window expires', async () => {
    const app = makeApp(1);
    await request(app).get('/test'); // 1st — ok

    // advance past window
    mockTime = 60_001;
    const res = await request(app).get('/test'); // should reset
    expect(res.status).toBe(200);
  });
});

describe('ipRateLimiter factory', () => {
  it('creates a limiter using req.ip as key', () => {
    // just verify it returns a function without throwing
    const middleware = ipRateLimiter(60_000, 60);
    expect(typeof middleware).toBe('function');
  });
});

describe('clinicRateLimiter factory', () => {
  it('creates a limiter using emr_clinic_id as key', () => {
    const middleware = clinicRateLimiter(60_000, 10);
    expect(typeof middleware).toBe('function');
  });

  it('429 when the same clinic exceeds 10 req/min', async () => {
    let time = 0;
    const limiter = createRateLimiter(
      { windowMs: 60_000, maxRequests: 10, keyFn: (req) => `clinic:${(req.body as Record<string, string>).emr_clinic_id}` },
      () => time
    );
    const app = express();
    app.use(express.json());
    app.use(limiter);
    app.post('/test', (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 10; i++) {
      const res = await request(app).post('/test').send({ emr_clinic_id: 'clinic-x' });
      expect(res.status).toBe(200);
    }
    const res = await request(app).post('/test').send({ emr_clinic_id: 'clinic-x' });
    expect(res.status).toBe(429);
  });
});
