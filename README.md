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

## Getting Started

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
