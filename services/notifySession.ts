import { Session } from './sessionService';

export interface NotifySessionInput {
  session: Session;
  webhookUrl?: string;
}

export async function notifySession({ session, webhookUrl }: NotifySessionInput): Promise<void> {
  const payload = {
    patientId: session.emr_patient_id,
    sessionId: session.id,
    joinUrl: session.provider_meeting_url,
    scheduledStartAt: session.scheduled_start_at,
  };

  if (webhookUrl) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Webhook failed: ${res.statusText}`);
    }
  } else {
    console.log('[notifySession]', JSON.stringify(payload));
  }
}
