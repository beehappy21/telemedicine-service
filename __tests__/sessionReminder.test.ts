import { runReminderTick } from '../services/sessionReminder';
import { Session } from '../services/sessionService';

jest.mock('../services/notifySession');
import { notifySession } from '../services/notifySession';
const mockNotify = notifySession as jest.Mock;

const mockQuery = jest.fn();
const mockPool = { query: mockQuery } as never;

const scheduledSession: Session = {
  id: 'sess-2',
  emr_clinic_id: 'clinic-1',
  emr_patient_id: 'patient-2',
  emr_practitioner_id: 'dr-1',
  emr_encounter_id: null,
  session_number: null,
  scheduled_start_at: new Date(Date.now() + 15 * 60 * 1000),
  chief_complaint: null,
  started_at: null,
  ended_at: null,
  provider_room_name: 'room-xyz',
  provider_meeting_url: 'https://test.daily.co/room-xyz',
  status: 'scheduled',
  created_at: new Date(),
  updated_at: new Date(),
};

describe('runReminderTick', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queries sessions scheduled ~15 min from now and notifies each', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [scheduledSession] });
    mockNotify.mockResolvedValueOnce(undefined);

    await runReminderTick(mockPool, 'https://hook.example.com');

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("status = 'scheduled'");
    expect(sql).toContain('scheduled_start_at');
    expect(mockNotify).toHaveBeenCalledWith({
      session: scheduledSession,
      webhookUrl: 'https://hook.example.com',
    });
  });

  it('passes the 15-min window boundaries as query params', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const before = Date.now();
    await runReminderTick(mockPool, undefined);
    const after = Date.now();

    const params = mockQuery.mock.calls[0][1] as Date[];
    expect(params).toHaveLength(2);
    const [windowStart, windowEnd] = params;
    expect(windowStart.getTime()).toBeGreaterThanOrEqual(before + 14 * 60 * 1000 - 50);
    expect(windowEnd.getTime()).toBeLessThanOrEqual(after + 16 * 60 * 1000 + 50);
    expect(windowEnd.getTime()).toBeGreaterThan(windowStart.getTime());
  });

  it('does nothing when no sessions are in the reminder window', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await runReminderTick(mockPool, 'https://hook.example.com');

    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('notifies all sessions when multiple are in the window', async () => {
    const session2 = { ...scheduledSession, id: 'sess-3' };
    mockQuery.mockResolvedValueOnce({ rows: [scheduledSession, session2] });
    mockNotify.mockResolvedValue(undefined);

    await runReminderTick(mockPool, 'https://hook.example.com');

    expect(mockNotify).toHaveBeenCalledTimes(2);
  });

  it('continues to next session when one notification fails', async () => {
    const session2 = { ...scheduledSession, id: 'sess-3' };
    mockQuery.mockResolvedValueOnce({ rows: [scheduledSession, session2] });
    mockNotify
      .mockRejectedValueOnce(new Error('webhook down'))
      .mockResolvedValueOnce(undefined);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await runReminderTick(mockPool, 'https://hook.example.com');

    expect(mockNotify).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does not throw when a notification fails (swallows error)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [scheduledSession] });
    mockNotify.mockRejectedValueOnce(new Error('webhook down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runReminderTick(mockPool, 'https://hook.example.com')).resolves.toBeUndefined();
  });

  it('does not throw when the DB query fails (swallows error)', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(runReminderTick(mockPool, undefined)).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
