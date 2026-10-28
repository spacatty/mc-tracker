# MC Tracker

MC Tracker is a self-hosted Next.js app for tracking recurring and persistent payments across workspaces, categories, invoices, notifications, and optional AI-assisted imports.

## Requirements

- Node.js 20+
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

Open [http://localhost:3000](http://localhost:3000). On the first visit, the app redirects to `/setup` so you can create the initial superadmin account.

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
npm run lint
npm run build
```

