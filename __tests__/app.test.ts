import request from 'supertest';
import { createApp } from '../app';
import { SessionService } from '../services/sessionService';
import { EmrClient } from '../services/emrClient';

const mockService = {
  createSession: jest.fn(),
  getJoinToken: jest.fn(),
  updateStatus: jest.fn(),
  linkEncounter: jest.fn(),
  getSession: jest.fn(),
  listSessions: jest.fn(),
} as unknown as SessionService;

const mockEmrClient = {} as unknown as EmrClient;
const appConfig = { serviceToken: 'svc-token', emrApiToken: 'emr-token' };
const app = createApp(mockService, appConfig, mockEmrClient);

describe('GET /health', () => {
  it('returns { status: ok, service: telemedicine } without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'telemedicine' });
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
