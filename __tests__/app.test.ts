import request from 'supertest';
import { createApp } from '../app';
import { SessionService } from '../services/sessionService';
import { EmrClient } from '../services/emrClient';

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

const mockService = {
  createSession: jest.fn(),
  getJoinToken: jest.fn(),
  updateStatus: jest.fn(),
  linkEncounter: jest.fn(),
  getSession: jest.fn(),
  listSessions: jest.fn(),
  checkDb: jest.fn(),
  getMetrics: jest.fn(),
} as unknown as SessionService;

const mockEmrClient = {} as unknown as EmrClient;
const appConfig = { serviceToken: 'svc-token', emrApiToken: 'emr-token', dailyApiKey: 'test-daily-key' };
const app = createApp(mockService, appConfig, mockEmrClient);

describe('GET /health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockService.checkDb as jest.Mock).mockResolvedValue(true);
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('200 ok when DB and Daily.co are both healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('telemedicine');
    expect(res.body.checks.database).toBe('ok');
    expect(res.body.checks.dailyCo).toBe('ok');
  });

  it('does not require an Authorization header', async () => {
    const res = await request(app).get('/health');
    expect(res.status).not.toBe(401);
  });

  it('503 degraded when DB check returns false', async () => {
    (mockService.checkDb as jest.Mock).mockResolvedValue(false);

    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database).toBe('error');
    expect(res.body.checks.dailyCo).toBe('ok');
  });

  it('503 degraded when Daily.co fetch throws a network error', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.dailyCo).toBe('error');
    expect(res.body.checks.database).toBe('ok');
  });

  it('503 degraded when both checks fail', async () => {
    (mockService.checkDb as jest.Mock).mockResolvedValue(false);
    mockFetch.mockRejectedValue(new Error('network error'));

    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.checks.database).toBe('error');
    expect(res.body.checks.dailyCo).toBe('error');
  });
});

describe('/api auth guard (via app)', () => {
  it('401 — no token on /api route', async () => {
    const res = await request(app).get('/api/sessions/x/join?userId=u');
    expect(res.status).toBe(401);
  });

  it('403 — wrong token on /api route', async () => {
    const res = await request(app)
      .get('/api/sessions/x/join?userId=u')
      .set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(403);
  });
});

describe('Frontend pages', () => {
  it('GET /app/patient — serves patient.html without auth', async () => {
    const res = await request(app).get('/app/patient');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('GET /app/doctor — serves doctor.html without auth', async () => {
    const res = await request(app).get('/app/doctor');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});
