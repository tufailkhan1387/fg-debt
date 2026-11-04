# FG Debt Advisor — backend

Node.js + PostgreSQL API for FG Debt Advisor AI. The first module is **Auth**, matching the frontend login, register, forgot-password, and reset-password flows.

## Setup

1. Start PostgreSQL (Docker or local):

```bash
docker compose up -d
```

2. Copy environment variables if needed (`backend/.env` is already set for local development).

3. Install and run:

```bash
npm install
npm run dev
```

On startup the API creates tables and seeds demo users and solicitor matters.

## Auth APIs

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | Create a client account |
| POST | `/api/auth/login` | No | Sign in |
| POST | `/api/auth/logout` | No | Client-side sign-out acknowledgement |
| GET | `/api/auth/me` | Bearer | Current user |
| POST | `/api/auth/forgot-password` | No | Request a reset link |
| POST | `/api/auth/reset-password` | No | Set a new password |
| GET | `/api/health` | No | Liveness check |

## Solicitor APIs

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/solicitor/matters` | Solicitor Bearer | Matter list (summary) for the signed-in solicitor |

### Demo accounts

- Solicitor: `solicitor@gmail.com` / `11223344`
- Customer: `amelia.hartley@example.co.uk` / `11223344`

Each additional registration still creates a new client row in `users` with a unique email.

In development, forgot-password returns `resetUrl` and `token` so the UI can open the reset page without email.
