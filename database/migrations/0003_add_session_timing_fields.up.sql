ALTER TABLE telemedicine_sessions
  ADD COLUMN chief_complaint TEXT,
  ADD COLUMN started_at      TIMESTAMPTZ,
  ADD COLUMN ended_at        TIMESTAMPTZ;
