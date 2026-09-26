# Charles App

One system for the store: register, inventory, wholesale and retail online ordering, and delivery routes. All three front doors share one database, so a sale at the register updates what customers see online.

| Front door | Route | Who uses it |
| --- | --- | --- |
| Store app | `/store` | Staff on the counter laptop (installs as an app) |
| Ordering website | `/` → `/shop/wholesale` or `/shop/retail` | Wholesale businesses and retail customers |
| Driver view | `/driver` | Driver's phone |

Plan and decisions: see [docs/PLAN.md](docs/PLAN.md).

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase: Postgres database, logins, private file storage (licenses, tax IDs, signatures)
- Hosting: Vercel (site) + Supabase (database)
- Integrations: Square Terminal API, Google/Mapbox routing, Resend/Postmark email

## Project layout

```
src/app/            pages (store, shop/wholesale, shop/retail, driver)
src/components/     shared UI
src/lib/pricing.ts  pack sizes, cash vs card, discounts (unit tested)
src/lib/supabase/   Supabase clients for browser and server
supabase/migrations database schema + row level security
docs/PLAN.md        plan summary and open questions
```

## Getting started

1. Install Node.js 20 or newer.
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in the keys (Supabase first; the rest can wait).
4. Create a Supabase project, then run `supabase/migrations/0001_init.sql` in its SQL editor (or `supabase db push` with the Supabase CLI).
5. `npm run dev` and open http://localhost:3000

Other commands: `npm test` (unit tests), `npm run lint`, `npm run build`.

## Deploying

Import this repository in Vercel, add the same environment variables, and every push to `main` redeploys automatically.

## Status

Phase 0 scaffold: database schema, pricing logic, and page shells for each front door. Store sections linked from `/store` are not built yet; see the phase list in docs/PLAN.md.
