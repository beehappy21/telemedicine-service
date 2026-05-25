import { Router, Request, Response } from 'express';
import { SessionService, SessionStatus, ListSessionsInput } from '../services/sessionService';
import { EmrClient } from '../services/emrClient';
import { createEncounterAfterCall } from '../services/createEncounterAfterCall';
import { notifySession } from '../services/notifySession';
import { clinicRateLimiter } from '../middleware/rateLimit';

const VALID_STATUSES: SessionStatus[] = [
  'scheduled',
  'waiting',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
];

function isValidIso8601(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return false;
  return !isNaN(Date.parse(value));
}

function isFuture(isoString: string): boolean {
  return new Date(isoString) > new Date();
}

function computeDurationMinutes(session: { started_at: Date | null; ended_at: Date | null }): number | null {
  if (!session.started_at) return null;
  const start = new Date(session.started_at).getTime();
  const end   = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  return Math.max(0, Math.round((end - start) / 60_000));
}

export function createTeleApi(sessionService: SessionService, emrClient: EmrClient, webhookUrl?: string): Router {
  const router = Router();
  const sessionCreateLimiter = clinicRateLimiter();

  // GET /metrics — session counts by status for today
  router.get('/metrics', async (_req: Request, res: Response) => {
    try {
      const sessionsByStatus = await sessionService.getMetrics();
      res.json({
        sessions_today: sessionsByStatus,
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /sessions — list with optional filters + pagination
  router.get('/sessions', async (req: Request, res: Response) => {
    const { emrClinicId, status, date, page, limit } = req.query as Record<string, string | undefined>;

    const input: ListSessionsInput = {
      emrClinicId,
      status: status as SessionStatus | undefined,
      date,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    try {
      const result = await sessionService.listSessions(input);
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /sessions/:id/join — must be defined before /sessions/:id
  router.get('/sessions/:id/join', async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.query['userId'] as string | undefined;
    const role   = (req.query['role'] as string | undefined) ?? 'patient';

    if (!userId) {
      res.status(400).json({ error: 'Missing required query parameter: userId' });
      return;
    }

    const isHost = role === 'doctor';

    try {
      const result = await sessionService.getJoinToken(id, userId, isHost);
      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /sessions/:id — detail (includes computed duration_minutes)
  router.get('/sessions/:id', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const session = await sessionService.getSession(id);
      res.json({ ...session, duration_minutes: computeDurationMinutes(session) });
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /sessions
  router.post('/sessions', sessionCreateLimiter, async (req: Request, res: Response) => {
    const {
      emr_clinic_id,
      emr_patient_id,
      emr_practitioner_id,
      session_number,
      scheduled_start_at,
      chief_complaint,
    } = req.body as Record<string, string | undefined>;

    if (!emr_clinic_id || !emr_patient_id || !emr_practitioner_id) {
      res.status(400).json({ error: 'Missing required fields: emr_clinic_id, emr_patient_id, emr_practitioner_id' });
      return;
    }

    if (scheduled_start_at !== undefined) {
      if (!isValidIso8601(scheduled_start_at)) {
        res.status(400).json({ error: 'scheduled_start_at must be a valid ISO8601 datetime string' });
        return;
      }
      if (!isFuture(scheduled_start_at)) {
        res.status(400).json({ error: 'scheduled_start_at must be in the future' });
        return;
      }
    }

    try {
      const session = await sessionService.createSession({
        emr_clinic_id,
        emr_patient_id,
        emr_practitioner_id,
        session_number,
        scheduled_start_at,
        chief_complaint,
      });
      res.status(201).json(session);

      // Fire-and-forget: notify patient with join URL
      void notifySession({ session, webhookUrl }).catch(err =>
        console.error('[notifySession] Failed to send session URL:', err)
      );
    } catch (err) {
      if (err instanceof Error && (err as NodeJS.ErrnoException & { code?: string }).code === '23505') {
        res.status(409).json({ error: 'Session number already exists for this clinic' });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PATCH /sessions/:id/status — auto-creates encounter when completed
  router.patch('/sessions/:id/status', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body as { status?: string };

    if (!status || !VALID_STATUSES.includes(status as SessionStatus)) {
      res.status(400).json({ error: `Invalid or missing status. Must be one of: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    try {
      const session = await sessionService.updateStatus(id, status as SessionStatus);
      res.json(session);

      // Fire-and-forget: create EMR encounter after call completes
      if (status === 'completed' && !session.emr_encounter_id) {
        void createEncounterAfterCall(session, emrClient, sessionService);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PATCH /sessions/:id/encounter
  router.patch('/sessions/:id/encounter', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { emr_encounter_id } = req.body as { emr_encounter_id?: string };

    if (!emr_encounter_id) {
      res.status(400).json({ error: 'Missing required field: emr_encounter_id' });
      return;
    }

    try {
      const session = await sessionService.linkEncounter(id, emr_encounter_id);
      res.json(session);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
