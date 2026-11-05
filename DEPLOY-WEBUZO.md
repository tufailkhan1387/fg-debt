# Auto-deploy to firmsure.co.uk (Webuzo)

Every push to `main` runs `.github/workflows/deploy.yml`, which:

1. Builds the web app with `VITE_API_URL=https://firmsure.co.uk/backend`.
2. Builds the API (TypeScript -> `dist/`).
3. Uploads the API to `~/apps/fg-backend` and runs `deploy/server-deploy.sh` there:
   `npm ci`, **database migrations** (`sql/*.sql`), restart with pm2, health check.
4. Uploads the web app to `~/public_html` and the API proxy to `~/public_html/backend/.htaccess`.

| URL | What |
| --- | --- |
| `https://firmsure.co.uk/` | Web app |
| `https://firmsure.co.uk/backend/api/health` | API (proxied to `127.0.0.1:4000`) |

The server keeps `.env`, `uploads/` and `backups/` in `~/apps/fg-backend` between deploys.

The web upload replaces everything in `~/public_html` (`rsync --delete`) except `backend/`, `.well-known/`,
`cgi-bin/` and `cosguard.co.uk/`. Any other site or folder put in `public_html` must be added as an
`--exclude` in `.github/workflows/deploy.yml`, or the next push deletes it.

## One-time setup

### 1. Webuzo panel

- **Node.js 24**: install it (Webuzo admin -> Apps, or ask the host). Check over SSH with `node -v`.
- **PostgreSQL**: create a database and a user with all privileges on it
  (Webuzo -> Database -> PostgreSQL). Note the full names (Webuzo adds a prefix, e.g. `firm_fgdb`).
  Tables are created by the migrations on every deploy; only the empty database is made here.
- **SSH access**: enabled for user `firm`.
- **SSL** for firmsure.co.uk (Webuzo -> SSL -> Let's Encrypt).
- Apache must allow proxying from `.htaccess` (`mod_proxy` + `mod_proxy_http`, flag `[P]`).
  If `/backend/api/health` gives a 500/404 after the first deploy, ask the host to enable them,
  or create a Webuzo "Node.js application" for URL `/backend` on port 4000 instead.

### 2. SSH key for GitHub

On your own computer:

```bash
ssh-keygen -t rsa -b 4096 -m PEM -f fg-deploy -N "" -C "github-deploy"
```

(Webuzo rejects ed25519 keys.)

- Import `fg-deploy.pub` in Webuzo -> SSH Access (`index.php?act=ssh_access`) and click Authorize.
- Admin panel (port 2004) -> Users -> Manage Shell Access: Normal Shell ON for `firm`.
- GitHub repo -> Settings -> Secrets and variables -> Actions -> New repository secret:

| Secret | Value |
| --- | --- |
| `SSH_HOST` | `2.24.140.105` |
| `SSH_USER` | `firm` |
| `SSH_PORT` | SSH port (leave out if 22) |
| `SSH_PRIVATE_KEY` | full content of `fg-deploy` (the private key) |

### 3. API settings on the server

Over SSH, create `~/apps/fg-backend/.env` (once; never committed):

```bash
mkdir -p ~/apps/fg-backend && nano ~/apps/fg-backend/.env
```

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://DB_USER:DB_PASSWORD@localhost:5432/DB_NAME
FRONTEND_URL=https://firmsure.co.uk
JWT_SECRET=<long random value>
DATA_ENCRYPTION_KEY=<another long random value - keep a copy off the server, never change it>
UPLOAD_DIR=uploads
BACKUP_DIR=backups
# SMTP_*, MAIL_FROM, AI_PROVIDER, OPENAI_API_KEY ... see backend/backend/.env.example
```

Random values: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

Password with special characters in `DATABASE_URL` must be URL-encoded (`@` -> `%40`, `#` -> `%23`).

### 4. First deploy

Push to `main` (or GitHub -> Actions -> "Deploy to firmsure.co.uk" -> Run workflow).
Then create the first Principal once, over SSH:

```bash
cd ~/apps/fg-backend && node dist/db/create-principal.js --email you@firm.co.uk --first Jane --last Smith
```

## Day to day

- `git push` to `main` -> live in a few minutes. Watch progress in GitHub -> Actions.
- New migration: add `backend/backend/sql/0NN_name.sql` (idempotent SQL, like the existing files). It runs on the next push.
- API logs over SSH: `npx pm2@6 logs fg-backend`
- Restart by hand: `npx pm2@6 restart fg-backend`
