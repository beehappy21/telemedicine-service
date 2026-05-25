import { Pool } from 'pg';
import { Session } from './sessionService';
import { notifySession } from './notifySession';

export async function runReminderTick(pool: Pool, webhookUrl: string | undefined): Promise<void> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 14 * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + 16 * 60 * 1000);

    const result = await pool.query<Session>(
      `SELECT * FROM telemedicine_sessions
       WHERE status = 'scheduled'
         AND scheduled_start_at >= $1
         AND scheduled_start_at < $2`,
      [windowStart, windowEnd]
    );

    for (const session of result.rows) {
      try {
        await notifySession({ session, webhookUrl });
      } catch (err) {
        console.error('[sessionReminder] Failed to notify session:', session.id, err);
      }
    }
  } catch (err) {
    console.error('[sessionReminder] Error during reminder tick:', err);
  }
}

export function startSessionReminder(
  pool: Pool,
  webhookUrl?: string,
  intervalMs = 60_000
): NodeJS.Timeout {
  return setInterval(() => void runReminderTick(pool, webhookUrl), intervalMs);
}
