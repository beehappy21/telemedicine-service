import { EmrClient } from './emrClient';
import { Session, SessionService } from './sessionService';

export async function createEncounterAfterCall(
  session: Session,
  emrClient: EmrClient,
  sessionService: SessionService
): Promise<void> {
  try {
    const encounter = await emrClient.createEncounter(
      session.emr_patient_id,
      session.emr_practitioner_id,
      {
        encounterClass: 'telemedicine',
        chiefComplaint: session.chief_complaint ?? null,
        startedAt: session.started_at ?? null,
        endedAt: session.ended_at ?? null,
      }
    );
    await sessionService.linkEncounter(session.id, encounter.id);
  } catch (err) {
    console.error('[createEncounterAfterCall] Failed to create post-call encounter:', err);
  }
}
