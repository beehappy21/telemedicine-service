import { EmrClient } from '../services/emrClient';

const mockFetch = jest.fn();
global.fetch = mockFetch as typeof fetch;

const client = new EmrClient('http://emr-core:3000', 'test-token');

describe('EmrClient', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getPatient', () => {
    it('fetches a patient by id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'p1', name: 'John Doe' }),
      });

      const patient = await client.getPatient('p1');

      expect(patient).toEqual({ id: 'p1', name: 'John Doe' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://emr-core:3000/patients/p1',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        })
      );
    });

    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' });

      await expect(client.getPatient('unknown')).rejects.toThrow('EMR API error: 404 Not Found');
    });
  });

  describe('listPractitioners', () => {
    it('returns practitioner list for a clinic', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'dr1', name: 'Dr. Smith' }],
      });

      const practitioners = await client.listPractitioners('clinic-1');

      expect(practitioners).toEqual([{ id: 'dr1', name: 'Dr. Smith' }]);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://emr-core:3000/clinics/clinic-1/practitioners',
        expect.any(Object)
      );
    });
  });

  describe('createEncounter', () => {
    it('creates an encounter and returns it', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'enc1', patientId: 'p1' }),
      });

      const encounter = await client.createEncounter('p1', 'dr1', { type: 'video' });

      expect(encounter).toEqual({ id: 'enc1', patientId: 'p1' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://emr-core:3000/encounters',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
