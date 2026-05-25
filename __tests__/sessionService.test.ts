import { SessionService } from '../services/sessionService';
import * as dailyRoomModule from '../services/createDailyRoom';

jest.mock('../services/createDailyRoom');

const mockCreateDailyRoom = dailyRoomModule.createDailyRoom as jest.Mock;
const mockCreateMeetingToken = dailyRoomModule.createMeetingToken as jest.Mock;

const mockQuery = jest.fn();
const mockPool = { query: mockQuery } as never;

const service = new SessionService(mockPool, 'test-daily-key');

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
  status: 'scheduled' as const,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('SessionService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('createSession', () => {
    it('creates a Daily.co room and inserts a session', async () => {
      mockCreateDailyRoom.mockResolvedValueOnce({
        name: 'room-abc',
        url: 'https://test.daily.co/room-abc',
      });
      mockQuery.mockResolvedValueOnce({ rows: [baseSession] });

      const session = await service.createSession({
        emr_clinic_id: 'clinic-1',
        emr_patient_id: 'patient-1',
        emr_practitioner_id: 'dr-1',
      });

      expect(mockCreateDailyRoom).toHaveBeenCalledWith('test-daily-key');
      expect(session).toEqual(baseSession);
    });

    it('passes session_number and scheduled_start_at to the query', async () => {
      mockCreateDailyRoom.mockResolvedValueOnce({ name: 'room-x', url: 'https://daily.co/room-x' });
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseSession, session_number: 'SN-001' }] });

      await service.createSession({
        emr_clinic_id: 'clinic-1',
        emr_patient_id: 'patient-1',
        emr_practitioner_id: 'dr-1',
        session_number: 'SN-001',
        scheduled_start_at: '2030-01-01T10:00:00Z',
      });

      const queryArgs = mockQuery.mock.calls[0][1] as unknown[];
      expect(queryArgs[5]).toBe('SN-001');
      expect(queryArgs[6]).toBe('2030-01-01T10:00:00Z');
    });

    it('propagates Daily.co errors', async () => {
      mockCreateDailyRoom.mockRejectedValueOnce(new Error('Daily.co error'));

      await expect(
        service.createSession({ emr_clinic_id: 'c', emr_patient_id: 'p', emr_practitioner_id: 'dr' })
      ).rejects.toThrow('Daily.co error');
    });
  });

  describe('getJoinToken', () => {
    it('returns session and patient token (isHost=false by default)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [baseSession] });
      mockCreateMeetingToken.mockResolvedValueOnce('patient-token-xyz');

      const result = await service.getJoinToken('sess-1', 'patient-1');

      expect(result.session).toEqual(baseSession);
      expect(result.token).toBe('patient-token-xyz');
      expect(mockCreateMeetingToken).toHaveBeenCalledWith('test-daily-key', 'room-abc', 'patient-1', false);
    });

    it('requests host token when isHost=true (doctor role)', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [baseSession] });
      mockCreateMeetingToken.mockResolvedValueOnce('host-token-xyz');

      const result = await service.getJoinToken('sess-1', 'dr-1', true);

      expect(result.token).toBe('host-token-xyz');
      expect(mockCreateMeetingToken).toHaveBeenCalledWith('test-daily-key', 'room-abc', 'dr-1', true);
    });

    it('throws when session not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.getJoinToken('bad-id', 'user-1')).rejects.toThrow(
        'Session not found: bad-id'
      );
    });
  });

  describe('updateStatus', () => {
    it('updates and returns updated session', async () => {
      const updated = { ...baseSession, status: 'in_progress' as const };
      mockQuery.mockResolvedValueOnce({ rows: [updated] });

      const session = await service.updateStatus('sess-1', 'in_progress');

      expect(session.status).toBe('in_progress');
    });

    it('throws when session not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.updateStatus('bad-id', 'completed')).rejects.toThrow(
        'Session not found: bad-id'
      );
    });
  });

  describe('updateStatus timing fields', () => {
    it('sets started_at when transitioning to in_progress', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseSession, status: 'in_progress', started_at: new Date() }] });

      await service.updateStatus('sess-1', 'in_progress');

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('started_at');
      expect(sql).toContain('COALESCE');
    });

    it('sets ended_at when transitioning to completed', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...baseSession, status: 'completed', ended_at: new Date() }] });

      await service.updateStatus('sess-1', 'completed');

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('ended_at');
    });
  });

  describe('linkEncounter', () => {
    it('links encounter ID to session', async () => {
      const updated = { ...baseSession, emr_encounter_id: 'enc-1' };
      mockQuery.mockResolvedValueOnce({ rows: [updated] });

      const session = await service.linkEncounter('sess-1', 'enc-1');

      expect(session.emr_encounter_id).toBe('enc-1');
    });

    it('throws when session not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.linkEncounter('bad-id', 'enc-1')).rejects.toThrow(
        'Session not found: bad-id'
      );
    });
  });

  describe('getSession', () => {
    it('returns session by id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [baseSession] });

      const session = await service.getSession('sess-1');
      expect(session).toEqual(baseSession);
    });

    it('throws when session not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.getSession('bad-id')).rejects.toThrow('Session not found: bad-id');
    });
  });

  describe('listSessions', () => {
    it('returns all sessions with defaults when no filters given', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [baseSession] });

      const result = await service.listSessions({});

      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.sessions).toHaveLength(1);
    });

    it('applies emrClinicId filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [baseSession] });

      await service.listSessions({ emrClinicId: 'clinic-1' });

      const countSql = mockQuery.mock.calls[0][0] as string;
      const countParams = mockQuery.mock.calls[0][1] as unknown[];
      expect(countSql).toContain('emr_clinic_id');
      expect(countParams).toContain('clinic-1');
    });

    it('applies status filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [baseSession] });

      await service.listSessions({ status: 'scheduled' });

      const countSql = mockQuery.mock.calls[0][0] as string;
      const countParams = mockQuery.mock.calls[0][1] as unknown[];
      expect(countSql).toContain('status');
      expect(countParams).toContain('scheduled');
    });

    it('applies date filter', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [baseSession] });

      await service.listSessions({ date: '2026-01-15' });

      const countSql = mockQuery.mock.calls[0][0] as string;
      const countParams = mockQuery.mock.calls[0][1] as unknown[];
      expect(countSql).toContain('DATE');
      expect(countParams).toContain('2026-01-15');
    });

    it('passes correct limit and offset for page 3', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.listSessions({ page: 3, limit: 10 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      const dataParams = mockQuery.mock.calls[1][1] as unknown[];
      expect(dataParams).toContain(10);  // limit
      expect(dataParams).toContain(20);  // offset = (3-1)*10
    });

    it('caps limit at 100', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '200' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.listSessions({ limit: 999 });
      expect(result.limit).toBe(100);
    });
  });

  describe('checkDb', () => {
    it('returns true when SELECT 1 succeeds', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

      const result = await service.checkDb();
      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
    });

    it('returns false when query throws', async () => {
      mockQuery.mockRejectedValueOnce(new Error('connection refused'));

      const result = await service.checkDb();
      expect(result).toBe(false);
    });
  });

  describe('getMetrics', () => {
    it('returns session counts by status as numbers', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { status: 'scheduled', count: '3' },
          { status: 'in_progress', count: '1' },
          { status: 'completed', count: '7' },
        ],
      });

      const metrics = await service.getMetrics();
      expect(metrics.scheduled).toBe(3);
      expect(metrics.in_progress).toBe(1);
      expect(metrics.completed).toBe(7);
    });

    it('returns empty object when no sessions today', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const metrics = await service.getMetrics();
      expect(metrics).toEqual({});
    });

    it('queries only sessions created today', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.getMetrics();

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain('CURRENT_DATE');
    });
  });
});
