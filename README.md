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

1. Install Node.js 20 or newer, then `npm install`.
2. Create `.env.local` from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable key): Supabase > Project Settings > API.
   - `SUPABASE_SERVICE_ROLE_KEY` (secret key, same page): only needed so managers can create staff logins. Never commit it.
3. The database is already set up in the Supabase project (migrations in `supabase/migrations/`, applied in order).
4. `npm run dev` and open http://localhost:3000/store

### First sign-in

1. In Supabase > Authentication > Users, click **Add user** and create your own login (email + password, auto-confirm).
2. Sign in at `/login`. The very first person to sign in becomes the first manager (with price editing).
3. Add everyone else from **Staff** in the store app (needs the service role key).
4. Until the wholesale website is built, turn off **Allow new users to sign up** in Supabase > Authentication > Sign In / Providers, so nobody else can create an account.

## Deploying

Import this repository in Vercel, add the same environment variables, and every push to `main` redeploys automatically.

## Status

Phase 1 (catalog + inventory) is built:

- Staff login, first-manager setup, staff management (only 4 people can change prices)
- Products: case size, cost, wholesale and party case prices, retail pack sizes with cash/card prices, barcodes, low-stock levels, spreadsheet import with a template
- Inventory map of every storage spot, search that highlights where an item is, per-spot item lists
- Receive, restock the front (cases become singles), move, and count, with barcode scanning
- Low-stock tab (restock the front / reorder from supplier) and full stock history

Next: Phase 2 (register). See docs/PLAN.md.
