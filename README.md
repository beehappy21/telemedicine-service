# telemedicine-service

Standalone Node.js + TypeScript service for managing telemedicine video sessions via Daily.co. Integrates with emr-core-system over HTTP only — no shared database.

## Quick Start

```bash
cp .env.example .env   # fill in required values
npm install
npm test               # run all tests
npm run dev            # start with ts-node (dev)
```

## Environment Variables

| Variable              | Required | Description                                         |
|-----------------------|----------|-----------------------------------------------------|
| `DAILY_API_KEY`       | Yes      | Daily.co API key                                    |
| `DATABASE_URL`        | Yes      | PostgreSQL connection string                        |
| `SERVICE_TOKEN`       | Yes      | Bearer token for server-to-server API calls         |
| `EMR_API_TOKEN`       | Yes      | Bearer token forwarded from emr-core                |
| `EMR_CORE_BASE_URL`   | No       | Base URL of emr-core-system (default: localhost:3000)|
| `EMR_CORE_API_TOKEN`  | No       | Auth token for emr-core API calls                   |
| `NOTIFY_WEBHOOK_URL`  | No       | Webhook URL for patient session notifications       |
| `PORT`                | No       | HTTP port (default: 3001)                           |
| `NODE_ENV`            | No       | Set to `production` to suppress error details       |

## API Endpoints

All `/api` routes require `Authorization: Bearer <token>`.

| Method | Path                          | Description                                    |
|--------|-------------------------------|------------------------------------------------|
| GET    | /health                       | Service health (DB + Daily.co checks)          |
| GET    | /metrics                      | Session counts by status for today (auth req.) |
| POST   | /api/sessions                 | Create session + Daily.co room                 |
| GET    | /api/sessions                 | List sessions (filters: emrClinicId, status, date, page, limit) |
| GET    | /api/sessions/:id             | Get session detail                             |
| GET    | /api/sessions/:id/join        | Get join token (`?userId=&role=patient\|doctor`) |
| PATCH  | /api/sessions/:id/status      | Update session status                          |
| PATCH  | /api/sessions/:id/encounter   | Link EMR encounter ID to session               |

### Session Statuses

`scheduled` → `waiting` → `in_progress` → `completed` | `cancelled` | `no_show`

## Frontend Pages

| Path          | Description                        |
|---------------|------------------------------------|
| /app/patient  | Patient join page (no auth)        |
| /app/doctor   | Doctor room page (no auth)         |

Both pages accept `?sessionId=<id>&token=<bearer>` query parameters.

## Database Migration

```bash
npm run db:migrate
# or manually:
psql $DATABASE_URL -f database/migrations/0001_telemedicine_sessions.up.sql
psql $DATABASE_URL -f database/migrations/0002_add_session_fields.up.sql
psql $DATABASE_URL -f database/migrations/0003_add_session_timing_fields.up.sql
```

## Deploy

### Docker (single container)

```bash
docker build -t telemedicine-service .
docker run -p 3001:3001 --env-file .env telemedicine-service
```

### Docker Compose (service + Postgres)

```bash
cp .env.example .env   # set DAILY_API_KEY, SERVICE_TOKEN, EMR_API_TOKEN
docker compose up -d
```

The compose file automatically applies SQL migrations on first Postgres startup via `docker-entrypoint-initdb.d`.

### Production Checklist

- [ ] `NODE_ENV=production` — suppresses stack traces in error responses
- [ ] `DAILY_API_KEY` set to a valid Daily.co production API key
- [ ] `SERVICE_TOKEN` and `EMR_API_TOKEN` are long random secrets (≥ 32 chars)
- [ ] `DATABASE_URL` points to a managed Postgres instance with SSL
- [ ] `NOTIFY_WEBHOOK_URL` configured if patient SMS/email notifications are needed
- [ ] Health endpoint `/health` monitored by your load balancer or uptime checker
- [ ] Container runs as non-root user (enforced in Dockerfile)
- [ ] Logs (JSON to stdout) shipped to a log aggregator (e.g., CloudWatch, Datadog)
- [ ] Rate limits reviewed (`ipRateLimiter`: 60 req/min, `clinicRateLimiter`: 10 req/min)

## Development Commands

```bash
npm install        # install dependencies
npm test           # run all Jest tests
npm run build      # compile TypeScript → dist/
npm run dev        # start with ts-node (requires .env)
npm start          # start compiled output (requires dist/ + .env)
npm run db:migrate # run database migrations
```
