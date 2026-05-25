/**
 * End-to-end seed script — creates a test session and prints ready-to-use URLs.
 *
 * Usage:
 *   npx ts-node scripts/seed-test-session.ts
 *
 * Reads SERVICE_TOKEN and PORT from .env (via dotenv).
 * The service must already be running.
 */

import dotenv from 'dotenv';
dotenv.config();

const BASE_URL    = `http://localhost:${process.env['PORT'] ?? '3001'}`;
const TOKEN       = process.env['SERVICE_TOKEN'] ?? '';
const CLINIC_ID   = 'test-clinic-1';
const PATIENT_ID  = 'test-patient-1';
const DOCTOR_ID   = 'test-doctor-1';

if (!TOKEN) {
  console.error('❌  SERVICE_TOKEN is not set in .env');
  process.exit(1);
}

async function main() {
  const scheduledStartAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const body = {
    emr_clinic_id:       CLINIC_ID,
    emr_patient_id:      PATIENT_ID,
    emr_practitioner_id: DOCTOR_ID,
    session_number:      'TELE-TEST-001',
    scheduled_start_at:  scheduledStartAt,
    chief_complaint:     'ทดสอบระบบ video call',
  };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/sessions`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`❌  Cannot reach ${BASE_URL} — is the service running?`);
    console.error(`    ${(err as Error).message}`);
    process.exit(1);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    console.error(`❌  POST /api/sessions failed (HTTP ${res.status}): ${errBody.error}`);
    process.exit(1);
  }

  const session = await res.json() as { id: string };
  const sid     = session.id;
  const enc     = encodeURIComponent;

  const doctorUrl  = `${BASE_URL}/app/doctor?sessionId=${sid}&token=${enc(TOKEN)}`;
  const patientUrl = `${BASE_URL}/app/patient?sessionId=${sid}&token=${enc(TOKEN)}`;
  const adminUrl   = `${BASE_URL}/app/admin?token=${enc(TOKEN)}&clinicId=${enc(CLINIC_ID)}`;

  const hr = '─────────────────────────────────────────────';
  console.log();
  console.log('✅  Session สร้างแล้ว');
  console.log(hr);
  console.log(`Session ID  : ${sid}`);
  console.log(hr);
  console.log(`👨‍⚕️  หมอเปิด   : ${doctorUrl}`);
  console.log(`👤  ผู้ป่วยเปิด : ${patientUrl}`);
  console.log(`🖥  Admin     : ${adminUrl}`);
  console.log(hr);
  console.log();
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
