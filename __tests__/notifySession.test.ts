import { notifySession } from '../services/notifySession';
import { Session } from '../services/sessionService';

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

const session: Session = {
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
  created_at: new Date(),
  updated_at: new Date(),
};

describe('notifySession', () => {
  beforeEach(() => jest.clearAllMocks());

  it('logs to console when no webhookUrl is provided', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await notifySession({ session });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith('[notifySession]', expect.stringContaining('sess-1'));
    spy.mockRestore();
  });

  it('POSTs correct payload to webhook when webhookUrl is set', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await notifySession({ session, webhookUrl: 'https://hook.example.com/notify' });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://hook.example.com/notify',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.patientId).toBe('patient-1');
    expect(body.sessionId).toBe('sess-1');
    expect(body.joinUrl).toBe('https://test.daily.co/room-abc');
  });

  it('includes scheduledStartAt in payload', async () => {
    const scheduledAt = new Date('2030-06-01T09:00:00Z');
    const sessionWithTime = { ...session, scheduled_start_at: scheduledAt };
    mockFetch.mockResolvedValueOnce({ ok: true });

    await notifySession({ session: sessionWithTime, webhookUrl: 'https://hook.example.com' });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.scheduledStartAt).toBe(scheduledAt.toISOString());
  });

  it('throws when webhook returns a non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Bad Gateway' });

    await expect(
      notifySession({ session, webhookUrl: 'https://hook.example.com/notify' })
    ).rejects.toThrow('Webhook failed: Bad Gateway');
  });

  it('propagates network errors from fetch', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(
      notifySession({ session, webhookUrl: 'https://hook.example.com/notify' })
    ).rejects.toThrow('ECONNREFUSED');
  });
});
