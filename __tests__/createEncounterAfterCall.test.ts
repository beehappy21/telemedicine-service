import { createEncounterAfterCall } from '../services/createEncounterAfterCall';
import { EmrClient } from '../services/emrClient';
import { Session, SessionService } from '../services/sessionService';

const mockEmrClient = {
  createEncounter: jest.fn(),
} as unknown as EmrClient;

const mockSessionService = {
  linkEncounter: jest.fn(),
} as unknown as SessionService;

const completedSession: Session = {
  id: 'sess-1',
  emr_clinic_id: 'clinic-1',
  emr_patient_id: 'patient-1',
  emr_practitioner_id: 'dr-1',
  emr_encounter_id: null,
  session_number: null,
  scheduled_start_at: null,
  chief_complaint: 'headache',
  started_at: new Date('2026-01-01T09:00:00Z'),
  ended_at: new Date('2026-01-01T09:30:00Z'),
  provider_room_name: 'room-abc',
  provider_meeting_url: 'https://test.daily.co/room-abc',
  status: 'completed',
  created_at: new Date(),
  updated_at: new Date(),
};

describe('createEncounterAfterCall', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls createEncounter with correct payload and links returned encounter id', async () => {
    (mockEmrClient.createEncounter as jest.Mock).mockResolvedValueOnce({ id: 'enc-1', patientId: 'patient-1' });
    (mockSessionService.linkEncounter as jest.Mock).mockResolvedValueOnce(completedSession);

    await createEncounterAfterCall(completedSession, mockEmrClient, mockSessionService);

    expect(mockEmrClient.createEncounter).toHaveBeenCalledWith(
      'patient-1',
      'dr-1',
      expect.objectContaining({
        encounterClass: 'telemedicine',
        chiefComplaint: 'headache',
        startedAt: completedSession.started_at,
        endedAt: completedSession.ended_at,
      })
    );
    expect(mockSessionService.linkEncounter).toHaveBeenCalledWith('sess-1', 'enc-1');
  });

  it('logs error and does not throw when emrClient.createEncounter fails', async () => {
    (mockEmrClient.createEncounter as jest.Mock).mockRejectedValueOnce(new Error('EMR down'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      createEncounterAfterCall(completedSession, mockEmrClient, mockSessionService)
    ).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalled();
    expect(mockSessionService.linkEncounter).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('logs error and does not throw when linkEncounter fails', async () => {
    (mockEmrClient.createEncounter as jest.Mock).mockResolvedValueOnce({ id: 'enc-1', patientId: 'patient-1' });
    (mockSessionService.linkEncounter as jest.Mock).mockRejectedValueOnce(new Error('DB error'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      createEncounterAfterCall(completedSession, mockEmrClient, mockSessionService)
    ).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('passes null chief_complaint and timestamps when session has none', async () => {
    const sessionWithoutExtras: Session = {
      ...completedSession,
      chief_complaint: null,
      started_at: null,
      ended_at: null,
    };
    (mockEmrClient.createEncounter as jest.Mock).mockResolvedValueOnce({ id: 'enc-2', patientId: 'p' });
    (mockSessionService.linkEncounter as jest.Mock).mockResolvedValueOnce({});

    await createEncounterAfterCall(sessionWithoutExtras, mockEmrClient, mockSessionService);

    expect(mockEmrClient.createEncounter).toHaveBeenCalledWith(
      'patient-1',
      'dr-1',
      expect.objectContaining({ chiefComplaint: null, startedAt: null, endedAt: null })
    );
  });
});
