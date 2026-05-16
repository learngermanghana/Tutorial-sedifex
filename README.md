# Tutorial Sedifex

Tutorial Sedifex is a Next.js application that serves tutorial content with a dashboard-style experience.

## Tech Stack

- Next.js (App Router)
- React
- TypeScript
- React Query
- React Hook Form + Zod

## Prerequisites

- Node.js **20.9+**
- npm

## Getting Started.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` — start local development server
- `npm run build` — build for production
- `npm run start` — run production build
- `npm run lint` — run lint checks

## Project Structure

```text
app/           Next.js app routes and global app files
components/    Shared UI components
lib/           Core utilities, APIs, and types
data/          Tutorial data sources
```

## Notes

- The root route redirects to `/dashboard`.
- This project uses the Next.js App Router.


## Environment Variables
Copy `.env.example` to `.env.local` and set values as needed.

- `INTEGRATIONS_DB_FILE`: path for persisted integrations store.
- `SENTRY_DSN`: optional error monitoring DSN.
- `OTEL_EXPORTER_OTLP_ENDPOINT`: optional OpenTelemetry endpoint.
- `OTEL_SERVICE_NAME`: service name used in traces/metrics.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: platform admin login credentials for `/admin/login`.
- `STAFF_EMAIL` / `STAFF_PASSWORD`: staff login credentials for `/admin/login` (store-scoped).

## Architecture Notes
- Route groups separate platform pages (`app/(platform)`), store pages (`app/(store)`), and admin pages (`app/admin`).
- Integrations admin APIs live under `/api/admin/integrations/*` and OAuth token issuance under `/api/oauth/token`.
- Integrations now use a typed persistent repository in `lib/integrations-store.ts`.

## Security Model Summary
- Role checks are enforced server-side using `parseAdminContext` + `authorize`.
- `super_admin` and `ops_admin` can manage all integration clients and webhooks.
- `store_admin` is restricted to own `storeId` records; platform-level client creation is blocked.
- Client scopes are constrained to: `engagement:read`, `engagement:write`, `products:resolve`.

## Deployment Guidance
1. Install dependencies and build: `npm ci && npm run build`.
2. Provide environment variables from `.env.example`.
3. Run with `npm start` behind HTTPS and preserve `data/` if using file-backed persistence.
4. Wire Sentry/OpenTelemetry before production traffic.

## Runtime Observability
- Add request correlation IDs and request logging in ingress/middleware.
- Emit admin action metrics for auth failures and integrations API error rates.
- Forward errors to Sentry and traces/metrics to OpenTelemetry collector.
