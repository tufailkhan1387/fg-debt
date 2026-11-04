# FG Compliance — deployment and go-live guide

This guide is for whoever installs and runs FG Compliance for the firm. The system has two parts:

- **API** (`backend/backend`): Node.js + Express, PostgreSQL. Serves `/api/...`.
- **Web app** (`fg-debt`): the screens, built with Vite into static files.

## 1. What the server needs

| Item | Notes |
| --- | --- |
| Node.js 24 | The version the system was built and tested on. |
| PostgreSQL 16 or later | One database for the system. The database user must be able to create tables. |
| HTTPS | A reverse proxy (for example Caddy or nginx) in front of the API and the web app. Required by spec section 14. |
| Storage | Space for uploaded documents (`UPLOAD_DIR`) and backups (`BACKUP_DIR`). Put backups on different storage from the data if possible. |
| Outgoing email | An SMTP account for reminder emails and password-reset links. |

## 2. API settings (environment variables)

Set these for the API process. Values marked *secret* must never be shared or committed.

| Variable | Required | What it is |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` on a live server. |
| `PORT` | no | Port the API listens on (default 4000). |
| `DATABASE_URL` | yes | PostgreSQL connection string. *secret* |
| `JWT_SECRET` | yes | Long random value (at least 32 characters) that signs sign-in sessions. *secret* |
| `DATA_ENCRYPTION_KEY` | yes in production | Long random value that encrypts documents, two-factor secrets and backups. *secret* **Keep a copy somewhere safe, away from the server, and never change it**: without it no document or backup can be read. |
| `FRONTEND_URL` | yes | The web app's address, e.g. `https://compliance.firm.co.uk` (used for links in emails and for CORS). |
| `UPLOAD_DIR` | no | Where encrypted documents are stored (default `./uploads`). |
| `BACKUP_DIR` | no | Where backups are written (default `./backups`). Prefer separate storage. |
| `BACKUP_HOUR` | no | Hour after which the daily backup runs (default 2). |
| `BACKUP_KEEP` | no | How many backups to keep (default 14). |
| `BACKUP_SCHEDULE` | no | `off` turns the daily backup off (not recommended). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | for email | Mail server for reminder emails. Without `SMTP_HOST`, emails are written to the server log instead. `SMTP_PASS` is *secret*. |
| `REMINDER_HOUR`, `REMINDER_TIMEZONE` | no | When the daily reminder email goes (default 08:00, `Europe/London`). |
| `JWT_EXPIRES_IN`, `RESET_TOKEN_MINUTES` | no | Session length (default 7 days) and password-reset link life (default 30 minutes). |
| `SEED_DEMO_ACCOUNTS` | no | Leave unset in production. Demo accounts have a published password. |
| `AI_PROVIDER` | for AI | `openai` or `anthropic`. |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | for AI | The chosen provider's API key; the provider account must have credit. *secret* |
| `AI_MODEL`, `AI_EFFORT` | no | Model (default `gpt-5.5` for OpenAI, `claude-opus-5-5` for Anthropic) and effort (`low`, `medium`, `high`). |

Generate random secrets with, for example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 3. Web app settings

Set these when building the web app (`fg-debt`):

| Variable | What it is |
| --- | --- |
| `VITE_API_URL` | The API's public address, e.g. `https://compliance.firm.co.uk` or `https://api.compliance.firm.co.uk`. |
| `VITE_COMPLIANCE_ONLY` | Leave unset (or `true`) so only FG Compliance is shown. |

## 4. Installing

```bash
cd backend/backend
npm ci
npm start
```

On start the API brings the database schema up to date by itself. In production it creates **no** demo accounts.

```bash
cd fg-debt
npm ci
npm run build
```

Serve the built web app through the same HTTPS proxy as the API.

## 5. First sign-in

Create the firm's Principal once, on the server:

```bash
npm run create-principal -- --email principal@firm.co.uk --first Jane --last Smith
```

It prints a one-time password. The Principal then:

1. Signs in, opens **Two-Factor Security**, changes the password and turns on two-factor sign-in.
2. Opens **System Status** and fixes anything marked *Must fix*.
3. Uses **Send test email** on System Status to confirm reminder emails arrive.
4. Adds the other users under **Users & Access** (each gets a temporary password to change on first sign-in).

## 6. Backups and recovery

- A backup of the whole database and every document is taken every day and kept encrypted in `BACKUP_DIR`. The **Backups** page lists them, checks them and downloads them.
- Keep copies away from the server too (download them, or point `BACKUP_DIR` at other storage), and keep the `DATA_ENCRYPTION_KEY` safe separately.
- To recover, create a new, empty database and run, with the same `DATA_ENCRYPTION_KEY`:

  ```bash
  DATABASE_URL=postgres://.../new_database npm run db:restore -- path/to/fg-backup-....fgbak
  ```

  Add `--dry-run` first to check the backup without changing anything. The restore refuses a database that already has users, so live data is never overwritten. Start the API only after the restore.

## 7. Go-live checklist

- [ ] Site served over HTTPS only.
- [ ] `NODE_ENV=production`, `DATA_ENCRYPTION_KEY` and a long `JWT_SECRET` set; a copy of the key stored safely off the server.
- [ ] SMTP set and the test email received.
- [ ] First Principal created, password changed, two-factor on.
- [ ] System Status shows nothing under *Must fix*.
- [ ] First backup taken, checked, and a copy stored off the server.
- [ ] Real data loaded (Master Register import, policies, SQM requirements from the official wording) only after the steps above.
- [ ] AI provider key set, account has credit, and one AI document review completed.
