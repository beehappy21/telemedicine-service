import request from 'supertest';
import { createApp } from '../app';
import { SessionService } from '../services/sessionService';

const mockService = {
  createSession: jest.fn(),
  getJoinToken: jest.fn(),
  updateStatus: jest.fn(),
  linkEncounter: jest.fn(),
} as unknown as SessionService;

const app = createApp(mockService);

describe('GET /health', () => {
  it('returns { status: ok, service: telemedicine }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'telemedicine' });
  });
});
