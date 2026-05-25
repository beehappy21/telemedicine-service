# telemedicine-service

Standalone Node.js + TypeScript service for managing telemedicine video sessions via Daily.co.

## Architecture

- **Runtime**: Node.js 20 + TypeScript
- **HTTP Server**: Express on port 3001 (configurable via `PORT`)
- **Database**: PostgreSQL (own schema, no shared DB with emr-core-system)
- **Video Provider**: Daily.co (room creation + meeting tokens via REST API)
- **EMR Integration**: HTTP-only via `EmrClient` — no shared database

### Key Boundaries
- Does **not** share a database with `emr-core-system`
- References EMR IDs (`emr_clinic_id`, `emr_patient_id`, etc.) as plain strings — no FK constraints
- All EMR data fetched at runtime via `EMR_CORE_BASE_URL`

## Project Layout

```
api/            Express router (teleApi.ts)
services/
  createDailyRoom.ts   Daily.co room + token creation
  emrClient.ts         HTTP client for emr-core API
  sessionService.ts    Business logic (CRUD on sessions)
scripts/
  start.ts             Entry point — boots the HTTP server
database/
  migrations/          SQL migration files
__tests__/             Jest unit tests (all external deps mocked)
```

## Commands

```bash
npm install        # install dependencies
npm test           # run all tests (jest --forceExit)
npm run build      # compile TypeScript → dist/
npm run dev        # run with ts-node (requires .env)
npm start          # run compiled output (requires dist/ + .env)
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

| Variable            | Description                              |
|---------------------|------------------------------------------|
| `DAILY_API_KEY`     | Daily.co API key                         |
| `EMR_CORE_BASE_URL` | Base URL of the emr-core-system HTTP API |
| `EMR_CORE_API_TOKEN`| Bearer token for emr-core-system API     |
| `DATABASE_URL`      | PostgreSQL connection string             |
| `PORT`              | HTTP port (default: 3001)                |

## Database Migration

Run the migration manually or integrate with your migration tool:

```bash
psql $DATABASE_URL -f database/migrations/0001_telemedicine_sessions.up.sql
```

## API Endpoints

| Method | Path                          | Description                        |
|--------|-------------------------------|------------------------------------|
| POST   | /api/sessions                 | Create session + Daily.co room     |
| GET    | /api/sessions/:id/join        | Get join token (`?userId=`)        |
| PATCH  | /api/sessions/:id/status      | Update session status              |
| PATCH  | /api/sessions/:id/encounter   | Link EMR encounter ID to session   |

### Session Statuses
`scheduled` → `waiting` → `in_progress` → `completed` | `cancelled` | `no_show`
