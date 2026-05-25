import { Router, Request, Response } from 'express';
import { SessionService, SessionStatus } from '../services/sessionService';
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

export function createTeleApi(sessionService: SessionService): Router {
  const router = Router();
  const sessionCreateLimiter = clinicRateLimiter();

  router.post('/sessions', sessionCreateLimiter, async (req: Request, res: Response) => {
    const {
      emr_clinic_id,
      emr_patient_id,
      emr_practitioner_id,
      session_number,
      scheduled_start_at,
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
      });
      res.status(201).json(session);
    } catch (err) {
      if (err instanceof Error && (err as NodeJS.ErrnoException & { code?: string }).code === '23505') {
        res.status(409).json({ error: 'Session number already exists for this clinic' });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.get('/sessions/:id/join', async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.query['userId'] as string | undefined;

    if (!userId) {
      res.status(400).json({ error: 'Missing required query parameter: userId' });
      return;
    }

    try {
      const result = await sessionService.getJoinToken(id, userId);
      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

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
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) {
        res.status(404).json({ error: err.message });
        return;
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

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
