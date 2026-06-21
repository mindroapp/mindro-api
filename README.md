# Mindro API

Backend REST API for the Mindro platform — a clinical practice management system for mental health professionals. Built with NestJS, Prisma ORM, and PostgreSQL.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Modules & Features](#modules--features)
- [Authentication & Authorization](#authentication--authorization)
- [Database Schema](#database-schema)
- [Development Setup](#development-setup)
- [Environment Variables](#environment-variables)
- [Docker](#docker)
- [API Conventions](#api-conventions)
- [Scripts Reference](#scripts-reference)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 (TypeScript) |
| Database | PostgreSQL 15 |
| ORM | Prisma 7.8 |
| Authentication | Passport.js + JWT |
| Validation | class-validator + class-transformer |
| Security | Helmet, bcrypt, httpOnly cookies |
| Rate Limiting | @nestjs/throttler (200 req / 60 s) |
| Scheduling | @nestjs/schedule |
| Testing | Jest + Supertest |

---

## Architecture

The API follows NestJS's **feature-module pattern**: every domain concern lives in its own self-contained module under `src/modules/`. Each module owns its controller, service, DTOs, and any module-specific guards or decorators.

```
src/
├── main.ts                  # Bootstrap (CORS, pipes, Helmet, cookie-parser)
├── app.module.ts            # Root module — global guards registered here
├── database/
│   ├── prisma.module.ts
│   └── prisma.service.ts    # Prisma client with migration-on-startup
└── modules/
    ├── auth/                # JWT auth, refresh token, guards, decorators
    ├── users/               # User profiles, roles, approval workflow
    ├── patients/            # Patient records
    ├── schedule/            # Appointments, availability, public booking
    ├── financial/           # Payments, revenue reports
    ├── dashboard/           # Aggregated analytics
    └── messaging/           # Reminders and notifications
```

### Global Middleware & Pipes

Configured in `main.ts`:

- **Cookie Parser** — parses `httpOnly` auth cookies on every request
- **Helmet** — sets security-hardened HTTP response headers
- **Body size limit** — 50 MB (supports document uploads)
- **ValidationPipe** — `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`; unknown fields are stripped and DTOs are auto-cast to their TypeScript types

### Global Guard Stack

Applied in order on every protected request (configured in `app.module.ts`):

```
JwtAuthGuard → RolesGuard → ThrottlerGuard
```

Routes decorated with `@Public()` bypass `JwtAuthGuard` entirely.

---

## Modules & Features

### Auth (`/auth`)

| Endpoint | Description |
|---|---|
| `POST /auth/login` | Authenticates user; sets `access_token` and `refresh_token` in httpOnly cookies |
| `POST /auth/register` | Creates a professional account (pending admin approval) |
| `POST /auth/refresh` | Issues a new access token from a valid refresh cookie |
| `POST /auth/logout` | Clears auth cookies |
| `POST /auth/reset-password` | Triggers password reset e-mail |

### Users (`/users`)

- Profile management (view and update own profile)
- Admin endpoints to list, approve, suspend, and delete professionals
- Approval workflow: professionals are created with `PENDING` status and must be `APPROVED` by an admin before they can log in

### Patients (`/patients`)

- Full CRUD for patient records scoped to the authenticated professional
- Each patient is linked to exactly one professional (multi-tenancy at data level)

### Schedule (`/schedule`)

- **Schedule Events** — arbitrary calendar entries (appointments, blocks, notes)
- **Availability** — professionals define recurring available time slots
- **Public Booking** — unauthenticated endpoint (`/schedule/public/:professionalId`) for clients to view a professional's public profile and book appointments
- Appointment status workflow: `PENDING → CONFIRMED → COMPLETED / CANCELLED`

### Financial (`/financial`)

- Payment records linked to patients
- Multiple payment methods: `CREDIT_CARD`, `DEBIT_CARD`, `PIX`, `CASH`, `BANK_TRANSFER`, `INSURANCE`
- Payment status tracking: `PENDING → PAID / OVERDUE / CANCELLED`
- Monthly revenue aggregation endpoint

### Dashboard (`/dashboard`)

- Returns aggregated metrics for the authenticated professional:
  - Total active patients
  - Sessions this month
  - Revenue this month
  - Upcoming appointments

### Messaging

- Reminder service that fires scheduled jobs (`@nestjs/schedule`) to send appointment reminders
- Reminder types: `EMAIL`, `SMS`, `WHATSAPP`

---

## Authentication & Authorization

### Flow

```
1. POST /auth/login
   → Validates credentials, checks ApprovalStatus (APPROVED required for professionals)
   → Signs access_token (short-lived) + refresh_token (long-lived)
   → Sets both as httpOnly, Secure, SameSite=Strict cookies

2. Subsequent requests
   → JwtAuthGuard extracts access_token from cookie
   → Passport JWT strategy validates signature and expiry
   → @CurrentUser() decorator injects the decoded user payload

3. POST /auth/refresh
   → Reads refresh_token cookie
   → Issues new access_token cookie (rotation)

4. POST /auth/logout
   → Clears both cookies (Max-Age=0)
```

### Decorators

| Decorator | Purpose |
|---|---|
| `@Public()` | Marks a route as unauthenticated (bypasses JwtAuthGuard) |
| `@Roles(UserRole.ADMIN)` | Restricts route to specified roles (enforced by RolesGuard) |
| `@CurrentUser()` | Injects the authenticated user object from the JWT payload |

### Role Model

| Role | Description |
|---|---|
| `ADMIN` | Full platform access; manages professionals and configuration |
| `PROFESSIONAL` | Accesses own patients, schedule, and financial data |

---

## Database Schema

### Core Models

| Model | Purpose |
|---|---|
| `User` | Professionals and admins — includes role, approval status, and public profile settings |
| `Patient` | Client records scoped to a professional |
| `Session` | Therapy session notes and clinical records per patient |
| `ScheduleEvent` | Calendar entries (appointments, blocks) |
| `Availability` | Recurring available slots defined by a professional |
| `TimeSlot` | Individual bookable slots derived from an Availability rule |
| `PublicAppointment` | Bookings submitted via the public booking page |
| `Payment` | Financial transactions linked to patients |
| `Reminder` | Scheduled notification records |
| `ProfessionalPublicProfile` | Public-facing professional profile (bio, photo, services) |

### Key Enums

```
UserRole              ADMIN | PROFESSIONAL
ApprovalStatus        PENDING | APPROVED | REJECTED | SUSPENDED
AppointmentStatus     PENDING | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW
PaymentMethod         CREDIT_CARD | DEBIT_CARD | PIX | CASH | BANK_TRANSFER | INSURANCE
PaymentStatus         PENDING | PAID | OVERDUE | CANCELLED | REFUNDED
ReminderType          EMAIL | SMS | WHATSAPP
```

---

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 15 (or use Docker Compose)

### Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file and fill in values
cp .env.example .env

# 3. Run database migrations and generate Prisma client
npm run prisma:migrate
npm run prisma:generate

# 4. Start in watch mode
npm run start:dev
```

The API will be available at `http://localhost:4002`.

### Using Docker Compose (recommended)

```bash
# Start PostgreSQL + API + backup service
docker compose up -d

# View logs
docker compose logs -f app
```

On first start the app container runs pending Prisma migrations automatically before accepting connections.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `production` |
| `PORT` | `4002` | HTTP server port |
| `BASE_URL` | `http://localhost:4002` | Used for cookie domain and links in e-mails |
| `CORS_ORIGIN` | `http://localhost:3002,...` | Comma-separated list of allowed origins |
| `JWT_SECRET` | — | Secret for signing JWT tokens (required) |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime |
| `DATABASE_URL` | — | Prisma connection string (required) |
| `POSTGRES_USER` | `mindro` | PostgreSQL user |
| `POSTGRES_PASSWORD` | — | PostgreSQL password |
| `POSTGRES_DB` | `mindro` | PostgreSQL database name |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded files |

---

## Docker

The `docker-compose.yml` defines three services:

| Service | Image | Notes |
|---|---|---|
| `app` | Node 24-slim (multi-stage build) | 512 MB memory limit; health check on `/health` |
| `postgres` | PostgreSQL 15 | 1 GB memory limit; data persisted in named volume |
| `backup` | pg_dump cron | Nightly backups, 7-day retention |

---

## API Conventions

- **Base path:** `/api` — all routes are prefixed
- **Authentication:** httpOnly cookie (`access_token`); no `Authorization` header required from the browser client
- **Validation errors:** `400 Bad Request` with an array of messages from class-validator
- **Authorization errors:** `401 Unauthorized` (missing/expired token), `403 Forbidden` (insufficient role)
- **Not found:** `404 Not Found`
- **Rate limit exceeded:** `429 Too Many Requests`
- **Response for no content:** `204 No Content` (e.g. DELETE endpoints)
- **Pagination:** cursor or offset depending on endpoint (documented per route)

---

## Scripts Reference

```bash
npm run start:dev        # Watch mode (tsx)
npm run start:prod       # Run compiled output
npm run build            # Compile TypeScript

npm run prisma:generate  # Regenerate Prisma client after schema change
npm run prisma:migrate   # Apply pending migrations (dev)
npm run prisma:studio    # Open Prisma Studio GUI

npm run test             # Unit tests
npm run test:e2e         # End-to-end tests
npm run test:cov         # Coverage report

npm run lint             # ESLint with auto-fix
npm run format           # Prettier format
```
