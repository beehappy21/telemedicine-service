import express from 'express';
import request from 'supertest';
import { createAuthMiddleware } from '../middleware/auth';

const authConfig = { serviceToken: 'service-secret', emrApiToken: 'emr-secret' };

const app = express();
app.use(express.json());
app.use(createAuthMiddleware(authConfig));
app.get('/test', (_req, res) => res.json({ ok: true }));

describe('createAuthMiddleware', () => {
  it('401 — no Authorization header', async () => {
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Authorization/i);
  });

  it('401 — Authorization header without Bearer prefix', async () => {
    const res = await request(app).get('/test').set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  it('403 — Bearer token does not match either token', async () => {
    const res = await request(app).get('/test').set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Invalid token/i);
  });

  it('200 — valid SERVICE_TOKEN passes', async () => {
    const res = await request(app).get('/test').set('Authorization', 'Bearer service-secret');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('200 — valid EMR_API_TOKEN passes', async () => {
    const res = await request(app).get('/test').set('Authorization', 'Bearer emr-secret');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
