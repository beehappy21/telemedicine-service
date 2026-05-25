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
  chief_complaint: string | null;
  started_at: Date | null;
  ended_at: Date | null;
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
  chief_complaint?: string;
}

export interface ListSessionsInput {
  emrClinicId?: string;
  status?: SessionStatus;
  date?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedSessions {
  sessions: Session[];
  total: number;
  page: number;
  limit: number;
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
          session_number, scheduled_start_at, chief_complaint)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.emr_clinic_id,
        input.emr_patient_id,
        input.emr_practitioner_id,
        room.name,
        room.url,
        input.session_number ?? null,
        input.scheduled_start_at ?? null,
        input.chief_complaint ?? null,
      ]
    );

    return result.rows[0];
  }

  async getSession(sessionId: string): Promise<Session> {
    const result = await this.pool.query<Session>(
      'SELECT * FROM telemedicine_sessions WHERE id = $1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return result.rows[0];
  }

  async listSessions(input: ListSessionsInput = {}): Promise<PaginatedSessions> {
    const page = Math.max(1, input.page ?? 1);
    const limit = Math.min(input.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (input.emrClinicId) {
      values.push(input.emrClinicId);
      conditions.push(`emr_clinic_id = $${values.length}`);
    }
    if (input.status) {
      values.push(input.status);
      conditions.push(`status = $${values.length}`);
    }
    if (input.date) {
      values.push(input.date);
      conditions.push(`DATE(scheduled_start_at) = $${values.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM telemedicine_sessions ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    values.push(limit, offset);
    const dataResult = await this.pool.query<Session>(
      `SELECT * FROM telemedicine_sessions ${where}
       ORDER BY created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return { sessions: dataResult.rows, total, page, limit };
  }

  async getJoinToken(
    sessionId: string,
    userId: string,
    isHost = false
  ): Promise<{ session: Session; token: string }> {
    const result = await this.pool.query<Session>(
      'SELECT * FROM telemedicine_sessions WHERE id = $1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const session = result.rows[0];
    const token = await createMeetingToken(this.dailyApiKey, session.provider_room_name, userId, isHost);

    return { session, token };
  }

  async updateStatus(sessionId: string, status: SessionStatus): Promise<Session> {
    let extraFields = '';
    if (status === 'in_progress') {
      extraFields = ', started_at = COALESCE(started_at, NOW())';
    } else if (status === 'completed') {
      extraFields = ', ended_at = NOW()';
    }

    const result = await this.pool.query<Session>(
      `UPDATE telemedicine_sessions
       SET status = $1, updated_at = NOW()${extraFields}
       WHERE id = $2
       RETURNING *`,
      [status, sessionId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return result.rows[0];
  }

  async checkDb(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async getMetrics(): Promise<Record<string, number>> {
    const result = await this.pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*) AS count
       FROM telemedicine_sessions
       WHERE created_at >= CURRENT_DATE
       GROUP BY status`
    );
    return result.rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    }, {});
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
