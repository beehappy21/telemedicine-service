import { createDailyRoom, createMeetingToken } from '../services/createDailyRoom';

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

describe('createDailyRoom', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a room and returns name and url', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: 'test-room', url: 'https://test.daily.co/test-room' }),
    });

    const room = await createDailyRoom('test-api-key');

    expect(room).toEqual({ name: 'test-room', url: 'https://test.daily.co/test-room' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.daily.co/v1/rooms',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }),
      })
    );
  });

  it('throws when API returns error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Unauthorized' });

    await expect(createDailyRoom('bad-key')).rejects.toThrow('Failed to create Daily.co room');
  });
});

describe('createMeetingToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a meeting token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'token-abc-123' }),
    });

    const token = await createMeetingToken('test-api-key', 'test-room', 'user-1');

    expect(token).toBe('token-abc-123');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.daily.co/v1/meeting-tokens',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }),
      })
    );
  });

  it('throws when API returns error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, statusText: 'Forbidden' });

    await expect(createMeetingToken('bad-key', 'room', 'user')).rejects.toThrow(
      'Failed to create meeting token'
    );
  });

  it('includes is_owner=true in body when isOwner=true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'host-token-xyz' }),
    });

    const token = await createMeetingToken('key', 'room', 'dr-1', true);

    expect(token).toBe('host-token-xyz');
    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.properties.is_owner).toBe(true);
  });

  it('does not include is_owner when isOwner=false (default)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'patient-token' }),
    });

    await createMeetingToken('key', 'room', 'patient-1');

    const callBody = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(callBody.properties.is_owner).toBeUndefined();
  });
});
