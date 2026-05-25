import { Pool } from 'pg';
import { createDailyRoom, createMeetingToken } from './createDailyRoom';

export type SessionStatus =
  | 'scheduled'
  | 'waiting'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Session {
  id: string;
  emr_clinic_id: string;
  emr_patient_id: string;
  emr_practitioner_id: string;
  emr_encounter_id: string | null;
  session_number: string | null;
  scheduled_start_at: Date | null;
  provider_room_name: string;
  provider_meeting_url: string;
  status: SessionStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSessionInput {
  emr_clinic_id: string;
  emr_patient_id: string;
  emr_practitioner_id: string;
  session_number?: string;
  scheduled_start_at?: string;
}

export class SessionService {
  constructor(
    private readonly pool: Pool,
    private readonly dailyApiKey: string
  ) {}

  async createSession(input: CreateSessionInput): Promise<Session> {
    const room = await createDailyRoom(this.dailyApiKey);

    const result = await this.pool.query<Session>(
      `INSERT INTO telemedicine_sessions
         (emr_clinic_id, emr_patient_id, emr_practitioner_id, provider_room_name, provider_meeting_url,
          session_number, scheduled_start_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.emr_clinic_id,
        input.emr_patient_id,
        input.emr_practitioner_id,
        room.name,
        room.url,
        input.session_number ?? null,
        input.scheduled_start_at ?? null,
      ]
    );

    return result.rows[0];
  }

  async getJoinToken(
    sessionId: string,
    userId: string
  ): Promise<{ session: Session; token: string }> {
    const result = await this.pool.query<Session>(
      'SELECT * FROM telemedicine_sessions WHERE id = $1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = result.rows[0];
    const token = await createMeetingToken(this.dailyApiKey, session.provider_room_name, userId);

    return { session, token };
  }

  async updateStatus(sessionId: string, status: SessionStatus): Promise<Session> {
    const result = await this.pool.query<Session>(
      `UPDATE telemedicine_sessions
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, sessionId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return result.rows[0];
  }

  async linkEncounter(sessionId: string, emrEncounterId: string): Promise<Session> {
    const result = await this.pool.query<Session>(
      `UPDATE telemedicine_sessions
       SET emr_encounter_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [emrEncounterId, sessionId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return result.rows[0];
  }
}
