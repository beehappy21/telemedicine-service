import express from 'express';
import request from 'supertest';
import { createTeleApi } from '../api/teleApi';
import { SessionService } from '../services/sessionService';

const mockService = {
  createSession: jest.fn(),
  getJoinToken: jest.fn(),
  updateStatus: jest.fn(),
  linkEncounter: jest.fn(),
} as unknown as SessionService;

const app = express();
app.use(express.json());
app.use('/api', createTeleApi(mockService));

const baseSession = {
  id: 'sess-1',
  emr_clinic_id: 'clinic-1',
  emr_patient_id: 'patient-1',
  emr_practitioner_id: 'dr-1',
  emr_encounter_id: null,
  provider_room_name: 'room-abc',
  provider_meeting_url: 'https://test.daily.co/room-abc',
  status: 'scheduled',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('POST /api/sessions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('201 — creates a session', async () => {
    (mockService.createSession as jest.Mock).mockResolvedValueOnce(baseSession);

    const res = await request(app).post('/api/sessions').send({
      emr_clinic_id: 'clinic-1',
      emr_patient_id: 'patient-1',
      emr_practitioner_id: 'dr-1',
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('sess-1');
  });

  it('400 — missing emr_patient_id', async () => {
    const res = await request(app).post('/api/sessions').send({ emr_clinic_id: 'clinic-1' });
    expect(res.status).toBe(400);
  });

  it('500 — service throws unexpected error', async () => {
    (mockService.createSession as jest.Mock).mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app).post('/api/sessions').send({
      emr_clinic_id: 'c',
      emr_patient_id: 'p',
      emr_practitioner_id: 'dr',
    });

    expect(res.status).toBe(500);
  });
});

describe('GET /api/sessions/:id/join', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — returns session and token', async () => {
    (mockService.getJoinToken as jest.Mock).mockResolvedValueOnce({
      session: baseSession,
      token: 'join-token-xyz',
    });

    const res = await request(app).get('/api/sessions/sess-1/join?userId=user-1');

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('join-token-xyz');
  });

  it('400 — missing userId', async () => {
    const res = await request(app).get('/api/sessions/sess-1/join');
    expect(res.status).toBe(400);
  });

  it('404 — session not found', async () => {
    (mockService.getJoinToken as jest.Mock).mockRejectedValueOnce(
      new Error('Session not found: bad-id')
    );

    const res = await request(app).get('/api/sessions/bad-id/join?userId=user-1');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/sessions/:id/status', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — updates status', async () => {
    const updated = { ...baseSession, status: 'in_progress' };
    (mockService.updateStatus as jest.Mock).mockResolvedValueOnce(updated);

    const res = await request(app)
      .patch('/api/sessions/sess-1/status')
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('400 — invalid status value', async () => {
    const res = await request(app)
      .patch('/api/sessions/sess-1/status')
      .send({ status: 'invalid_status' });
    expect(res.status).toBe(400);
  });

  it('400 — missing status', async () => {
    const res = await request(app).patch('/api/sessions/sess-1/status').send({});
    expect(res.status).toBe(400);
  });

  it('404 — session not found', async () => {
    (mockService.updateStatus as jest.Mock).mockRejectedValueOnce(
      new Error('Session not found: bad-id')
    );

    const res = await request(app)
      .patch('/api/sessions/bad-id/status')
      .send({ status: 'completed' });
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/sessions/:id/encounter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — links encounter', async () => {
    const updated = { ...baseSession, emr_encounter_id: 'enc-1' };
    (mockService.linkEncounter as jest.Mock).mockResolvedValueOnce(updated);

    const res = await request(app)
      .patch('/api/sessions/sess-1/encounter')
      .send({ emr_encounter_id: 'enc-1' });

    expect(res.status).toBe(200);
    expect(res.body.emr_encounter_id).toBe('enc-1');
  });

  it('400 — missing emr_encounter_id', async () => {
    const res = await request(app).patch('/api/sessions/sess-1/encounter').send({});
    expect(res.status).toBe(400);
  });

  it('404 — session not found', async () => {
    (mockService.linkEncounter as jest.Mock).mockRejectedValueOnce(
      new Error('Session not found: bad-id')
    );

    const res = await request(app)
      .patch('/api/sessions/bad-id/encounter')
      .send({ emr_encounter_id: 'enc-1' });
    expect(res.status).toBe(404);
  });
});
