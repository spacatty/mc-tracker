# MC Tracker

MC Tracker is a self-hosted Next.js app for tracking recurring and persistent payments across workspaces, categories, invoices, notifications, and optional AI-assisted imports.

## Requirements

- Node.js 26 LTS (see `.nvmrc`), or Docker
- npm
- Persistent disk storage for the SQLite database

## Local Development

Install dependencies and create a local environment file:

```bash
npm install
cp .env.example .env.local
```

Fill `AUTH_SECRET` and `CRON_SECRET` in `.env.local`, then start the development server:

```bash
npm run dev
```

To use a different port, pass Next.js the `-p` flag:

```bash
npm run dev -- -p 3001
```

Open [http://localhost:4271](http://localhost:4271) (the default port). On the first visit, the app redirects to `/setup` so you can create the initial superadmin account.

## Adding and managing entries

- **Quick capture** (press `N` anywhere, or `Ctrl/⌘+K`): type one entry per line, for example
  `hz-fsn-01 #servers @Hetzner/ops 4.51 EUR/mo 01.11.2026 /ip: 95.217.10.4 // spare box`.
  A step bar under the input asks for category → name → vendor → price → billing start in turn and fuzzy-suggests
  values (Tab picks, Esc skips). Prices can be written as `$25`, `25$`, `25 USD`, `2500 rub`; a plain date
  (`03.11.26`, `3/11/2026`, `2026-11-03`) is the billing start and the renewal follows from the period. `/` suggests
  the chosen category's own fields (`#domains @godaddy /domain: sample.com`).
  Tokens are colored as you type and every line turns into a preview card you can adjust by clicking its chips.
  `#category`, `@vendor/account`, `price/period` (`/mo`, `/yr`, `/q`, `/w`, `/90d`, `/once`), a renewal date
  (or `start..end`), `field:value` for category fields, a URL and `// notes` are understood.
  `edit:<id>` and `pay:<id>` change an existing entry or record a payment. Pasting CSV/TSV/JSON converts it to lines;
  free text can be rewritten into lines by the AI parser (`Ctrl/⌘+J`). The syntax lives in `src/lib/capture/syntax.ts`.
- **Inspector**: click an entry in the table to open it in a side panel. Click any value to change it (saved right away),
  mark it paid, duplicate, archive or delete it, and move through entries with `J`/`K`.

## Environment Variables

- `AUTH_SECRET`: required in production for signing session cookies.
- `CRON_SECRET`: required in production for `/api/cron/notifications`; send it as the `x-cron-secret` header.
- `SQLITE_PATH`: optional SQLite database path. Defaults to `data/mc-tracker.sqlite`.
- `AI_API_KEY` (or legacy `OPENROUTER_API_KEY`): optional; enables Premium AI parsing of free-form text on the Import page. CSV/TSV/JSON import works without it.
- `AI_MODEL` (or legacy `OPENROUTER_MODEL`): defaults to `deepseek/deepseek-v4.1-flash`. Any OpenRouter model that supports structured outputs works.
- `AI_BASE_URL`, `AI_STRUCTURED_OUTPUT`: point at another OpenAI-compatible API. For DeepSeek's own API use `AI_BASE_URL=https://api.deepseek.com` with `AI_STRUCTURED_OUTPUT=json_object`.
- `REDACT_KINDS`, `REDACT_DENYLIST`: leak prevention. JSON from `/api` routes and error strings shown in the UI are masked (IPs, domains, emails, credentials in URLs, API keys/tokens/passwords, deny-listed terms). Before free text is sent to the AI provider the same values, plus every known account login and entry name (and vendor names with `AI_REDACT_VENDORS=true`), are swapped for placeholders like `<<IP_1>>` or `<<ACCOUNT_2>>` and restored locally in the answer. See `src/lib/security/redact.ts`.
- `AI_IMPORT_MAX_INPUT_CHARS`, `AI_IMPORT_MAX_OUTPUT_TOKENS`, `OPENROUTER_APP_URL`, `OPENROUTER_APP_NAME`: optional AI tuning.

Generate strong secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Production

Build and run the app:

```bash
npm run build
npm run start
```

To run production on another port:

```bash
npm run start -- -p 3001
```

### Docker

`docker-compose.yml` builds a production image on Node 26 and reads the same `.env` / `.env.local` files as local runs. The host's `./data` folder is mounted at `/app/data`, so an existing database at `SQLITE_PATH=./data/mc-tracker.sqlite` is used as is and survives rebuilds. The port is published on `127.0.0.1:4271` only (set `MC_TRACKER_PORT` to change the host side).

```bash
docker compose up -d --build
```

`AUTH_SECRET` (and `CRON_SECRET` for notifications) must be set in the env file, since the container runs in production mode. Don't run the container and a local server against the same SQLite file at the same time: file locking across a Docker Desktop bind mount isn't reliable.

Use a Node.js host or container with persistent storage mounted at `SQLITE_PATH` or the default `data/` directory. SQLite is the runtime database; PostgreSQL/MySQL support in the settings UI is only a connection test for future expansion.

For recurring notification delivery, schedule a POST request to:

```text
POST /api/cron/notifications
x-cron-secret: <CRON_SECRET>
```

The app is not a good fit for stateless serverless deployments unless the storage layer is moved away from local SQLite first.

## Verification

Run these before deploying:

```bash
npm run typecheck
npm run lint
npm run build
```

