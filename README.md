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
- `OPENROUTER_API_KEY`: optional; enables premium AI import features.
- `OPENROUTER_MODEL`, `OPENROUTER_APP_URL`, `OPENROUTER_APP_NAME`, `AI_IMPORT_MAX_INPUT_CHARS`, `AI_IMPORT_MAX_OUTPUT_TOKENS`: optional AI import tuning.

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

