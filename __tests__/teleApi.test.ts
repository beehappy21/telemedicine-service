import express from 'express';
import request from 'supertest';
import { createTeleApi } from '../api/teleApi';
import { SessionService } from '../services/sessionService';
import { EmrClient } from '../services/emrClient';

jest.mock('../services/createEncounterAfterCall');
import { createEncounterAfterCall } from '../services/createEncounterAfterCall';
const mockCreateEncounterAfterCall = createEncounterAfterCall as jest.Mock;

jest.mock('../services/notifySession', () => ({
  notifySession: jest.fn().mockResolvedValue(undefined),
}));
import { notifySession } from '../services/notifySession';
const mockNotifySession = notifySession as jest.Mock;

const mockService = {
  createSession: jest.fn(),
  getJoinToken: jest.fn(),
  updateStatus: jest.fn(),
  linkEncounter: jest.fn(),
  getSession: jest.fn(),
  listSessions: jest.fn(),
  getMetrics: jest.fn(),
} as unknown as SessionService;

const mockEmrClient = {} as unknown as EmrClient;

const app = express();
app.use(express.json());
app.use('/api', createTeleApi(mockService, mockEmrClient));

const baseSession = {
  id: 'sess-1',
  emr_clinic_id: 'clinic-1',
  emr_patient_id: 'patient-1',
  emr_practitioner_id: 'dr-1',
  emr_encounter_id: null,
  session_number: null,
  scheduled_start_at: null,
  chief_complaint: null,
  started_at: null,
  ended_at: null,
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

  it('400 — scheduled_start_at is not a valid ISO8601 string', async () => {
    const res = await request(app).post('/api/sessions').send({
      emr_clinic_id: 'clinic-iso',
      emr_patient_id: 'patient-1',
      emr_practitioner_id: 'dr-1',
      scheduled_start_at: 'not-a-date',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ISO8601/i);
  });

  it('400 — scheduled_start_at is in the past', async () => {
    const res = await request(app).post('/api/sessions').send({
      emr_clinic_id: 'clinic-past',
      emr_patient_id: 'patient-1',
      emr_practitioner_id: 'dr-1',
      scheduled_start_at: '2020-01-01T00:00:00Z',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/future/i);
  });

  it('201 — valid scheduled_start_at in the future is accepted', async () => {
    (mockService.createSession as jest.Mock).mockResolvedValueOnce(baseSession);
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();

    const res = await request(app).post('/api/sessions').send({
      emr_clinic_id: 'clinic-future',
      emr_patient_id: 'patient-1',
      emr_practitioner_id: 'dr-1',
      scheduled_start_at: futureDate,
    });
    expect(res.status).toBe(201);
  });

  it('409 — duplicate session_number within the same clinic', async () => {
    const dupError = Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    (mockService.createSession as jest.Mock).mockRejectedValueOnce(dupError);

    const res = await request(app).post('/api/sessions').send({
      emr_clinic_id: 'clinic-dup',
      emr_patient_id: 'patient-1',
      emr_practitioner_id: 'dr-1',
      session_number: 'SN-001',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/session number/i);
  });

  it('201 — calls notifySession fire-and-forget after session creation', async () => {
    (mockService.createSession as jest.Mock).mockResolvedValueOnce(baseSession);
    mockNotifySession.mockResolvedValueOnce(undefined);

    const res = await request(app).post('/api/sessions').send({
      emr_clinic_id: 'clinic-1',
      emr_patient_id: 'patient-1',
      emr_practitioner_id: 'dr-1',
    });

    expect(res.status).toBe(201);
    expect(mockNotifySession).toHaveBeenCalledWith({ session: baseSession, webhookUrl: undefined });
  });

  it('201 — notification failure does not affect session creation response', async () => {
    (mockService.createSession as jest.Mock).mockResolvedValueOnce(baseSession);
    mockNotifySession.mockRejectedValueOnce(new Error('webhook down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app).post('/api/sessions').send({
      emr_clinic_id: 'clinic-1',
      emr_patient_id: 'patient-1',
      emr_practitioner_id: 'dr-1',
    });

    expect(res.status).toBe(201);
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

  it('200 — role=doctor passes isHost=true to getJoinToken', async () => {
    (mockService.getJoinToken as jest.Mock).mockResolvedValueOnce({
      session: baseSession,
      token: 'host-token-xyz',
    });

    const res = await request(app).get('/api/sessions/sess-1/join?userId=dr-1&role=doctor');

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('host-token-xyz');
    expect(mockService.getJoinToken).toHaveBeenCalledWith('sess-1', 'dr-1', true);
  });

  it('200 — role=patient passes isHost=false to getJoinToken', async () => {
    (mockService.getJoinToken as jest.Mock).mockResolvedValueOnce({
      session: baseSession,
      token: 'patient-token-xyz',
    });

    const res = await request(app).get('/api/sessions/sess-1/join?userId=patient-1&role=patient');

    expect(res.status).toBe(200);
    expect(mockService.getJoinToken).toHaveBeenCalledWith('sess-1', 'patient-1', false);
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

  it('200 — status=completed triggers createEncounterAfterCall (fire-and-forget)', async () => {
    const completedSession = { ...baseSession, status: 'completed', emr_encounter_id: null };
    (mockService.updateStatus as jest.Mock).mockResolvedValueOnce(completedSession);
    mockCreateEncounterAfterCall.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .patch('/api/sessions/sess-1/status')
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(mockCreateEncounterAfterCall).toHaveBeenCalledWith(
      completedSession,
      mockEmrClient,
      mockService
    );
  });

  it('200 — skips encounter creation when emr_encounter_id already set', async () => {
    const alreadyLinked = { ...baseSession, status: 'completed', emr_encounter_id: 'enc-existing' };
    (mockService.updateStatus as jest.Mock).mockResolvedValueOnce(alreadyLinked);

    const res = await request(app)
      .patch('/api/sessions/sess-1/status')
      .send({ status: 'completed' });

    expect(res.status).toBe(200);
    expect(mockCreateEncounterAfterCall).not.toHaveBeenCalled();
  });
});

describe('GET /api/sessions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — returns paginated list', async () => {
    (mockService.listSessions as jest.Mock).mockResolvedValueOnce({
      sessions: [baseSession],
      total: 1,
      page: 1,
      limit: 20,
    });

    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('200 — passes emrClinicId, status, date to service', async () => {
    (mockService.listSessions as jest.Mock).mockResolvedValueOnce({
      sessions: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    await request(app).get('/api/sessions?emrClinicId=clinic-1&status=scheduled&date=2026-01-15');

    expect(mockService.listSessions).toHaveBeenCalledWith(
      expect.objectContaining({ emrClinicId: 'clinic-1', status: 'scheduled', date: '2026-01-15' })
    );
  });

  it('500 — propagates service errors', async () => {
    (mockService.listSessions as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/sessions');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/sessions/:id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — returns session detail', async () => {
    (mockService.getSession as jest.Mock).mockResolvedValueOnce(baseSession);

    const res = await request(app).get('/api/sessions/sess-1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('sess-1');
    expect(res.body.emr_encounter_id).toBeNull();
  });

  it('404 — session not found', async () => {
    (mockService.getSession as jest.Mock).mockRejectedValueOnce(
      new Error('Session not found: bad-id')
    );

    const res = await request(app).get('/api/sessions/bad-id');
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

describe('GET /api/metrics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — returns session counts by status for today', async () => {
    (mockService.getMetrics as jest.Mock).mockResolvedValueOnce({
      scheduled: 5,
      in_progress: 1,
      completed: 10,
    });

    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body.sessions_today.scheduled).toBe(5);
    expect(res.body.sessions_today.in_progress).toBe(1);
    expect(res.body.sessions_today.completed).toBe(10);
    expect(res.body.timestamp).toBeDefined();
  });

  it('200 — returns empty object when no sessions today', async () => {
    (mockService.getMetrics as jest.Mock).mockResolvedValueOnce({});

    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body.sessions_today).toEqual({});
  });

  it('500 — propagates service errors', async () => {
    (mockService.getMetrics as jest.Mock).mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(500);
  });
});
