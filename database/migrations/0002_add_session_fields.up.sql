ALTER TABLE telemedicine_sessions
  ADD COLUMN session_number     VARCHAR(255),
  ADD COLUMN scheduled_start_at TIMESTAMPTZ;

CREATE UNIQUE INDEX idx_telemedicine_sessions_clinic_session_number
  ON telemedicine_sessions(emr_clinic_id, session_number)
  WHERE session_number IS NOT NULL;
