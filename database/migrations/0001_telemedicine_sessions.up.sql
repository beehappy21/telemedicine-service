CREATE TYPE session_status AS ENUM (
  'scheduled',
  'waiting',
  'in_progress',
  'completed',
  'cancelled',
  'no_show'
);

CREATE TABLE telemedicine_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emr_clinic_id        VARCHAR(255) NOT NULL,
  emr_patient_id       VARCHAR(255) NOT NULL,
  emr_practitioner_id  VARCHAR(255) NOT NULL,
  emr_encounter_id     VARCHAR(255),
  provider_room_name   VARCHAR(255) NOT NULL,
  provider_meeting_url TEXT NOT NULL,
  status               session_status NOT NULL DEFAULT 'scheduled',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_telemedicine_sessions_emr_clinic_id     ON telemedicine_sessions(emr_clinic_id);
CREATE INDEX idx_telemedicine_sessions_emr_patient_id    ON telemedicine_sessions(emr_patient_id);
CREATE INDEX idx_telemedicine_sessions_emr_encounter_id  ON telemedicine_sessions(emr_encounter_id);
CREATE INDEX idx_telemedicine_sessions_status            ON telemedicine_sessions(status);
