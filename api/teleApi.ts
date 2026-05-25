import { Router, Request, Response } from 'express';
import { SessionService, SessionStatus } from '../services/sessionService';

const VALID_STATUSES: SessionStatus[] = [
  'scheduled',
  'waiting',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
];

export function createTeleApi(sessionService: SessionService): Router {
  const router = Router();

  router.post('/sessions', async (req: Request, res: Response) => {
    const { emr_clinic_id, emr_patient_id, emr_practitioner_id } = req.body as Record<string, string>;

    if (!emr_clinic_id || !emr_patient_id || !emr_practitioner_id) {
      res.status(400).json({ error: 'Missing required fields: emr_clinic_id, emr_patient_id, emr_practitioner_id' });
      return;
    }

    try {
      const session = await sessionService.createSession({
        emr_clinic_id,
        emr_patient_id,
        emr_practitioner_id,
      });
      res.status(201).json(session);
    } catch {
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
