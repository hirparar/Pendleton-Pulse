# Pendleton Connect

A full-stack interpreter management platform built for organizations that coordinate sign language and spoken language interpreters. Admins create and staff assignments, interpreters manage their availability and view their job feed — all in one clean, real-time workflow.

Built with **Next.js 15**, **Prisma**, **PostgreSQL**, **Clerk**, and **Tailwind CSS**.

---

## Features

### Admin
- **Assignment management** — create jobs with required start/end times, language pair, type, location, and staffing count
- **Inline interpreter assignment** — search eligible interpreters by name, email, location, or language and assign/remove in one click
- **Auto-status logic** — assignment status automatically flips to `ASSIGNED` when the required number of interpreters is filled, and reverts to `OPEN` if one is removed; runs inside a single DB transaction
- **Visibility control** — toggle assignments between public (all eligible interpreters) and restricted (specific interpreter allowlist)
- **Interpreter management** — approve, deny, activate, deactivate, and bulk-action interpreters with full audit trails
- **Availability overview** — read-only calendar view of each interpreter's concrete availability slots

### Interpreter
- **Calendar-based availability** — set availability day by day on an interactive calendar grid; past days are read-only automatically
- **Weekly templates** — save named recurring patterns (e.g. "Hospital Week") and apply them to any date range; additive, never overwrites existing slots
- **Job feed** — view open and assigned jobs based on visibility rules
- **Upcoming commitments** — see assigned jobs on the dashboard and availability page

### Platform
- **Unified audit log** — every admin action (approvals, status changes, assignments, visibility) is recorded with actor, timestamp, and optional note
- **Role-based access** — Clerk-powered auth with `ADMIN` and `INTERPRETER` roles; interpreters must be approved and active to access protected routes
- **Fully type-safe** — end-to-end TypeScript with Prisma-generated types; no `any` in service layer

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | Clerk |
| UI | Tailwind CSS, shadcn/ui, Radix UI |
| Animations | Framer Motion |
| Notifications | Sonner |

---

## Project Structure

```
app/
├── admin/
│   ├── assignments/        # List, create, detail (assign/status/visibility)
│   ├── availability/       # Read-only interpreter availability calendar
│   ├── approvals/          # Pending interpreter review queue
│   └── interpreters/       # Interpreter directory + profile management
├── interpreter/
│   ├── availability/       # Calendar grid + slot management + templates
│   ├── jobs/               # Job feed
│   └── page.tsx            # Dashboard with snapshot + upcoming commitments
└── api/
    └── admin/assignments/  # REST endpoints (list, create, status, assign, visibility)

lib/
├── assignments/
│   ├── service.ts          # Core assignment business logic + auto-status
│   └── interpreter.ts      # Interpreter-scoped queries with visibility rules
├── availability/
│   └── service.ts          # Slot upsert/delete, template expand, date utils
├── audit/
│   └── write.ts            # Unified audit event helpers
└── admin/
    └── interpreters.ts     # Activate/deactivate, bulk ops
```

---

## Data Model (simplified)

```
UserProfile         — clerk user, role, approval status, active flag
InterpreterProfile  — languages, certifications, experience, timezone

Assignment          — title, client, schedule (start + end required), staffing count, status, visibility
AssignmentInterpreter — link between assignment and interpreter (ASSIGNED | REMOVED)
AssignmentVisibility  — allowlist for RESTRICTED visibility mode

AvailabilitySlot    — concrete per-day time block (date + startMin + endMin)
AvailabilityTemplate — saved weekly pattern, expanded into slots on demand

AuditEvent          — unified log for both interpreter and assignment events
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- [Clerk](https://clerk.com) account

### Installation

```bash
git clone https://github.com/your-org/pendleton-connect
cd pendleton-connect
npm install
```

### Environment

Create a `.env` file:

```env
DATABASE_URL="postgresql://..."

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

### Database

```bash
npx prisma migrate dev
npx prisma generate
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Roles & Access

| Route prefix | Required |
|---|---|
| `/admin/*` | `ADMIN` role |
| `/interpreter/*` | `INTERPRETER` role + `APPROVED` status + `isActive: true` |
| `/api/admin/*` | `ADMIN` role |

Admins are set directly in the database or via a seed script by setting `role = 'ADMIN'` on a `UserProfile`. All new signups default to `INTERPRETER` with `PENDING` status and must be approved by an admin before they can access interpreter routes.

## License

MIT