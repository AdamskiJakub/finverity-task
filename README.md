# Capacity Service

A real-time program capacity tracking module for invoice financing. Handles reservations, releases, and external reconciliation via Kafka.

## Quick Start for Reviewers

```bash
# 1. Start everything (PostgreSQL + Redpanda + App)
docker compose up --build -d

# 2. Seed the database with sample data
docker compose exec app node prisma/seed.cjs

# 3. Verify it's running
curl http://localhost:3000/health

# 4. Open in browser
open http://localhost:3000   # Demo UI
open http://localhost:3000/api  # Swagger docs
```

That's it — 3 commands and the service is fully running with sample data.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Demo UI](#demo-ui)
- [API Reference](#api-reference)
- [Swagger / OpenAPI](#swagger--openapi)
- [Architecture Decisions](#architecture-decisions)
- [Assumptions & Trade-offs](#assumptions--trade-offs)
- [If I Had Another 2–3 Days](#if-i-had-another-2-3-days)

## Project Overview

### What was built

A RESTful microservice that manages **financing program capacity** and **invoice reservations** — the core of an invoice financing platform. The service tracks how much of a program's credit limit is currently reserved against invoices, and handles the full lifecycle: reserve → release → re-reserve.

### Why these technologies

| Technology           | Why                                                                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NestJS**           | Opinionated framework with built-in support for guards (JWT), pipes (validation), microservices (Kafka), and OpenAPI (Swagger). Minimal boilerplate for production-grade APIs.                                   |
| **PostgreSQL**       | Transactional integrity with `SELECT FOR UPDATE` pessimistic locking. Financial data consistency is non-negotiable — optimistic locking with retries adds complexity that's not justified at this scale.         |
| **Prisma**           | Type-safe database access. The schema is the single source of truth. Raw query support (`$queryRaw`) allows `SELECT FOR UPDATE` when the ORM API doesn't support it.                                             |
| **Kafka / Redpanda** | Standard event-driven integration pattern for treasury reconciliation. `@nestjs/microservices` provides a clean consumer abstraction. Event versioning handles at-least-once delivery and out-of-order messages. |
| **JWT (Passport)**   | Stateless authentication. Sufficient for MVP — no session store, no OAuth provider setup.                                                                                                                        |

### What was consciously skipped (and why)

| Feature                         | Reason                                                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **WebSockets / real-time push** | Clients poll `GET /capacity`. Push-based updates add complexity (socket lifecycle, reconnection, backpressure) with no benefit for an MVP.   |
| **Full audit log**              | Every reservation/release modifies program state directly. An `audit_log` table with before/after snapshots is straightforward to add later. |
| **OpenTelemetry / metrics**     | NestJS built-in Logger is sufficient for local dev. Distributed tracing and structured metrics belong in production.                         |
| **Rate limiting**               | Not needed for a demo. In production, add `express-rate-limit` or an API gateway.                                                            |
| **DLQ / retry for Kafka**       | Failed reconciliation events are silently logged. A dead letter queue with manual replay is the next thing to add.                           |
| **FX engine**                   | Programs and reservations must match currency. Automatic conversion via external FX rates can be integrated later.                           |
| **Unit tests**                  | Only E2E tests — they cover the full stack (HTTP → controller → service → database). Unit tests would duplicate coverage at this stage.      |
| **React / Next.js frontend**    | The demo UI is vanilla HTML/JS — no build step, no framework, no CSS polish. It exists purely to exercise the API endpoints visually.        |

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Client    │────▶│   REST API       │────▶│  PostgreSQL  │
│             │     │  (NestJS)        │     │  (Prisma)    │
└─────────────┘     │                  │     └──────────────┘
                    │  POST /reservations│         ▲
                    │  POST /releases   │         │
                    │  GET  /capacity   │         │
                    └──────────────────┘         │
                          ▲                      │
                          │                      │
                    ┌─────┴──────┐               │
                    │   Kafka    │───────────────┘
                    │ (Redpanda) │  PROGRAM_RECONCILIATION
                    └────────────┘
```

### Key Components

- **REST API** — NestJS application with JWT-authenticated endpoints
- **PostgreSQL** — Source of truth for program capacity with pessimistic locking
- **Kafka (Redpanda)** — External treasury system integration for bulk reconciliation
- **Prisma** — Type-safe database access with raw query support for `SELECT FOR UPDATE`

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 22+

### Local Development

```bash
# 1. Start infrastructure (PostgreSQL + Redpanda)
docker compose up -d postgres redpanda

# 2. Install dependencies
npm install

# 3. Generate Prisma client
npx prisma generate

# 4. Run database migrations
npx prisma migrate dev --name init

# 5. Seed sample data
npm run prisma:seed

# 6. Start the service
npm run start:dev
```

### Using Docker Compose (full stack)

```bash
# Start everything (PostgreSQL + Redpanda + App)
docker compose up --build -d

# Seed the database with sample data
docker compose exec app node prisma/seed.cjs

# The service will be available at http://localhost:3000
# Demo UI:  http://localhost:3000
# Swagger:  http://localhost:3000/api
```

### Verify It Works

```bash
# 1. Get auth token
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq .

# 2. Check capacity
curl -s http://localhost:3000/programs/prog_001/capacity \
  -H "Authorization: Bearer <TOKEN>" | jq .

# 3. Create a reservation
curl -s -X POST http://localhost:3000/programs/prog_001/reservations \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"invoiceId":"inv_123","amount":50000,"currency":"USD"}' | jq .
```

## Demo UI

A quick vanilla HTML/JS demo UI is available at [`http://localhost:3000`](http://localhost:3000) when the service is running.

![Demo UI](https://img.shields.io/badge/UI-Vanilla_JS-darkgreen)

> **Note:** This is a throwaway demo — no frameworks, no build step, no CSS polish. It exists purely to exercise the API endpoints visually. The real value is in the backend, tests, and architecture decisions documented below.

The demo provides a complete workflow:

1. **Login** — Auto-authenticated on page load with `admin` / `admin`
2. **Capacity** — View program limits, reserved amount, and available capacity
3. **Reserve** — Create a reservation for an invoice
4. **Release** — Release a reservation and free capacity
5. **Activity Log** — Timestamped, color-coded log of all operations

The UI is served as static assets from the [`public/`](capacity-service/public/) directory and communicates with the REST API directly. No build step or framework required.

## Swagger / OpenAPI

Interactive API documentation is available at [`http://localhost:3000/api`](http://localhost:3000/api) when the service is running.

- Auto-generated from `@nestjs/swagger` decorators on all controllers and DTOs
- "Authorize" button to set the JWT Bearer token for authenticated endpoints
- Try-it-out functionality for all endpoints
- Schema definitions for all request/response DTOs

## API Reference

All endpoints except `/auth/login` require a Bearer JWT token.

### `POST /auth/login`

Authenticate and receive a JWT token.

```json
// Request
{ "username": "admin", "password": "admin" }

// Response 201
{ "accessToken": "eyJhbGciOiJIUzI1NiIs..." }
```

### `GET /programs/:id/capacity`

Get current capacity for a financing program.

```json
// Response 200
{
  "programId": "prog_001",
  "currency": "USD",
  "totalLimit": 10000000,
  "reservedAmount": 2500000,
  "availableAmount": 7500000
}
```

### `POST /programs/:id/reservations`

Reserve capacity for an invoice.

```json
// Request
{ "invoiceId": "inv_123", "amount": 50000, "currency": "USD" }

// Response 201
{ "reservationId": "cm8...", "status": "ACTIVE" }

// Response 400 — Insufficient capacity
{ "message": "Insufficient capacity: available 7500000, requested 99999999", "statusCode": 400 }

// Response 409 — Duplicate invoice
{ "message": "Invoice inv_123 already has a reservation in program prog_001", "statusCode": 409 }
```

### `POST /programs/:id/releases`

Release a reservation (e.g., after invoice repayment).

```json
// Request
{ "reservationId": "cm8..." }

// Response 200
{ "status": "RELEASED", "releasedAmount": 50000 }

// Response 404 — Reservation not found
// Response 400 — Already released
```

## Architecture Decisions

### Why REST?

- Simplest contract to document and test
- Sufficient for MVP — WebSockets can be added later for real-time updates
- OpenAPI/Swagger available out of the box with NestJS

### Why PostgreSQL?

- Transactional integrity with pessimistic locking (`SELECT FOR UPDATE`)
- Financial data consistency is the top priority
- Prisma has mature PostgreSQL support

### Why Pessimistic Locking (`SELECT FOR UPDATE`)?

- Race conditions on available capacity are unacceptable in a financial system
- Optimistic locking requires retry logic, complicating business logic
- At low concurrency (single reservations), pessimistic locks are not a bottleneck

### Why Prisma?

- Type safety between schema and application code
- Easy migrations
- Raw query support (`$queryRaw`) for `SELECT FOR UPDATE` when the ORM API doesn't support it

### Why Kafka (@nestjs/microservices)?

- Standard NestJS integration
- Easy migration to production (Confluent, MSK)
- Event versioning allows safe schema evolution

## Assumptions & Trade-offs

### Multi-currency

**Assumption**: Programs and reservations are denominated in the same currency. Exchange rates are provided by the treasury reconciliation message.

**Trade-off**: No built-in FX engine. If a reservation comes in a different currency than the program, it will be rejected. In production, you'd want automatic conversion using a configurable FX rate source.

### Kafka Integration

**Assumption**: Only one event type (`PROGRAM_RECONCILIATION`) is consumed. Events are idempotent via version checking.

**Trade-off**: No DLQ, retry policy, or dead letter queue. If a reconciliation event fails to process, it's silently dropped. In production, you'd want a retry mechanism with exponential backoff and a DLQ for manual inspection.

### Authentication

**Assumption**: Hardcoded credentials for local development.

**Trade-off**: No user store, no role-based access control beyond what's in the JWT. In production, integrate with OAuth2 / Keycloak.

### Real-time Updates

**Assumption**: Clients poll `GET /capacity` for updates.

**Trade-off**: No WebSockets or Server-Sent Events. For a real production system, you'd want push-based updates to avoid polling overhead.

### Audit Log

**Trade-off**: No full audit trail. Every reservation and release modifies the program state directly. In production, you'd want an event-sourced approach or a separate `audit_log` table recording every state change.

### Observability

**Trade-off**: No OpenTelemetry, no structured metrics. Only NestJS built-in Logger. In production, you'd want distributed tracing, metrics (request rate, latency, error rate), and structured logging.

### Rate Limiting

**Trade-off**: No rate limiting. In production, use `express-rate-limit` or an API gateway (nginx, Kong).

### Idempotency

**Assumption**: Idempotency is enforced at the application level — only `ACTIVE` reservations block re-reservation of the same invoice. `RELEASED` reservations can be re-reserved (e.g., if the same invoice is re-submitted after repayment).

**Trade-off**: No TTL-based idempotency keys. If you need to prevent the same request from creating duplicate reservations within a short window (e.g., network retry), you'd want a separate idempotency key with TTL. The current design uses a database index `@@index([programId, invoiceId])` for query performance, not uniqueness enforcement.

### `SELECT FOR UPDATE` via Raw Query

**Trade-off**: Prisma doesn't have a native API for pessimistic locking. We use `$queryRaw` with raw SQL. This bypasses Prisma's type safety for that specific query but is necessary for financial consistency.

## If I Had Another 2–3 Days

1. **DLQ for Kafka** — Implement a dead letter queue for failed reconciliation events with manual replay capability
2. **Retry Policy** — Exponential backoff for transient Kafka consumer failures
3. **Optimistic Locking Alternative** — Add an optimistic locking path for read-heavy scenarios with low contention
4. **FX Service** — Integrate with an external FX rate API (e.g., Open Exchange Rates) for automatic currency conversion
5. **Audit Log** — Add a dedicated `audit_log` table recording every state change with before/after snapshots
6. **OpenTelemetry** — Add distributed tracing and metrics (request rate, latency, error rate, capacity utilization)
7. **Rate Limiting** — Protect endpoints with rate limiting per API key/user
8. **WebSockets** — Push real-time capacity updates to connected clients instead of polling
9. **Partial Releases** — Allow releasing only part of a reservation amount
10. **Frontend polish** — Add loading states, error retry, and responsive design improvements to the demo UI
