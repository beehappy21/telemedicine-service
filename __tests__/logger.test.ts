import express from 'express';
import request from 'supertest';
import { requestLogger } from '../middleware/logger';

function makeApp(statusCode = 200) {
  const app = express();
  app.use(requestLogger());
  app.get('/test', (_req, res) => res.status(statusCode).json({ ok: true }));
  return app;
}

describe('requestLogger', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('emits a single JSON log line per request', async () => {
    await request(makeApp()).get('/test');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('logs method, path, status, duration_ms, and timestamp', async () => {
    await request(makeApp()).get('/test');

    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logged.method).toBe('GET');
    expect(logged.path).toBe('/test');
    expect(logged.status).toBe(200);
    expect(typeof logged.duration_ms).toBe('number');
    expect(logged.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('records the correct HTTP status code for non-200 responses', async () => {
    await request(makeApp(404)).get('/test');

    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logged.status).toBe(404);
  });

  it('duration_ms is non-negative', async () => {
    await request(makeApp()).get('/test');

    const logged = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(logged.duration_ms).toBeGreaterThanOrEqual(0);
  });
});
