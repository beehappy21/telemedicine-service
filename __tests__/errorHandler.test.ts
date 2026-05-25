import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler';

function makeApp(nodeEnv: string) {
  const app = express();
  app.get('/boom', (_req: Request, _res: Response, next: NextFunction) => {
    next(new Error('Something broke'));
  });
  app.use(errorHandler(nodeEnv));
  return app;
}

describe('errorHandler', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('returns 500 with a generic error field', async () => {
    const res = await request(makeApp('test')).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });

  it('logs the error as JSON with message and stack', async () => {
    await request(makeApp('test')).get('/boom');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged.level).toBe('error');
    expect(logged.error).toBe('Something broke');
    expect(logged.stack).toBeDefined();
    expect(logged.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('logs method and path for context', async () => {
    await request(makeApp('test')).get('/boom');

    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged.method).toBe('GET');
    expect(logged.path).toBe('/boom');
  });

  it('includes message and stack in the response body in development', async () => {
    const res = await request(makeApp('development')).get('/boom');
    expect(res.body.message).toBe('Something broke');
    expect(res.body.stack).toBeDefined();
  });

  it('hides message and stack from the client in production', async () => {
    const res = await request(makeApp('production')).get('/boom');
    expect(res.body.message).toBeUndefined();
    expect(res.body.stack).toBeUndefined();
    expect(res.body.error).toBe('Internal server error');
  });
});
