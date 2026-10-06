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
4. Customer accounts (Phase 3) need sign-ups on: in Supabase > Authentication > Sign In / Providers, turn on **Allow new users to sign up** and keep **Confirm email** on. Sign-ups only ever create customer accounts; staff logins are still made from **Staff**.
5. In Supabase > Authentication > URL Configuration, set **Site URL** to the live site and add `https://<your-site>/auth/callback` (and `http://localhost:3000/auth/callback`) to **Redirect URLs**, so the confirm-email link signs customers in.
6. For order emails, set `EMAIL_API_KEY` (a Resend API key) and `EMAIL_FROM` (an address on a domain verified in Resend). Without them nothing breaks; emails are just skipped and staff see a note to tell the customer.

## Online payments (Square)

Customers can pick **Pay now online** at checkout. They pay the estimated total on Square's secure checkout page (card, Apple Pay, Google Pay, Cash App Pay), so card numbers never touch this site. When staff confirm an order short, the difference is refunded to the card automatically; cancelling refunds it all. Wholesale card payments add the card fee in `settings.card_markup_percent` (retail already pays card prices). The option only shows once Square is set up:

1. In the [Square developer dashboard](https://developer.squareup.com/apps), create an application. Use the **Sandbox** tab while testing (test card `4111 1111 1111 1111`, any future date, any CVV, ZIP 94103).
2. Set `SQUARE_ENVIRONMENT` (`sandbox` or `production`), `SQUARE_ACCESS_TOKEN` and `SQUARE_LOCATION_ID` (Locations page) in `.env.development.local` / Vercel.
3. Set `SUPABASE_SERVICE_ROLE_KEY` (Supabase > Project Settings > API keys, the secret key). Payments are recorded with it, server side only.
4. Webhooks > Subscriptions: add `https://<your-site>/api/square/webhook` for `payment.updated`, and put its signature key in `SQUARE_WEBHOOK_SIGNATURE_KEY`. This marks orders paid even if the customer closes the tab before coming back. (A webhook can't reach `localhost`; locally the return page checks with Square instead.)
5. Set the wholesale card fee: `update settings set card_markup_percent = 3;` (check your state's rules on card surcharges first).

## Dev database (for testing)

There are two Supabase projects: production (`tinlylwpinfojvbqqcyp`) and **charles-app-dev** (`aihuxpwljkwiasyheeqg`), which has the same schema plus test data. `npm run dev` uses the dev one through `.env.development.local` (not committed; it overrides `.env.local`). Ask for the values or copy them from Supabase > charles-app-dev > Project Settings > API. Delete that file to point the dev server at production again.

Test logins on the dev project (password `charles-test-123`; all of them are also in `docs/test-accounts.csv`):

| Login | Where | What it is |
| --- | --- | --- |
| `dev@example.com` | `/login` | Developer account: store app manager with price editing |
| `staff@example.com` | `/login` | Store app manager |
| `wholesale@example.com` | `/shop/signin` | Approved business, 10% standing discount |
| `retail@example.com` | `/shop/signin` | Retail customer |
| `luckys@example.com` | `/shop/signin` | Lucky's Liquor Mart, approved |
| `harbor@example.com` | `/shop/signin` | Harbor Tavern, approved, 5% discount |
| `sunset@example.com` | `/shop/signin` | Sunset Lounge, waiting for approval |

The test catalog has items in stock, low (Modelo in the warehouse, Bud Light up front) and out (White Claw), so partial fills and declines can be tried. `supabase/seed_dev_activity.sql` adds the fuller catalog (beer, seltzer, kegs, wine, liquor, mixers), two weeks of register sales and orders in every state. To top the test data back up, re-run `supabase/seed_dev.sql` then `supabase/seed_dev_activity.sql` in the dev project's SQL editor (it skips what already exists). New migrations go to **both** projects.

## Deploying

Import this repository in Vercel, add the same environment variables, and every push to `main` redeploys automatically.

## Status

Phase 1 (catalog + inventory) is built:

- Staff login, first-manager setup, staff management (only 4 people can change prices)
- Products: case size, cost, wholesale and party case prices, retail pack sizes with cash/card prices, barcodes, low-stock levels, spreadsheet import with a template
- Inventory map of every storage spot, search that highlights where an item is, per-spot item lists
- Receive, restock the front (cases become singles), move, and count, with barcode scanning
- Low-stock tab (restock the front / reorder from supplier) and full stock history

Phase 2 (register) is built:

- Register at `/store/register`: scan or search, pick Single / 4 pack / 6 pack, cash/card price toggle, % or $ discounts per line or on the whole sale
- Cash with change, or card on the Square Terminal (set the `SQUARE_*` variables; until then use "Card paid on terminal")
- Works offline: every sale is saved on the laptop first and synced when the connection is back; the page reloads offline after one online visit (production build only)
- Sales at `/store/sales`: daily totals by cash and card, every sale with its items, voids (managers; stock goes back)

Phase 3 (online ordering) is built:

- Customer accounts at `/shop/signin`: businesses apply with liquor license and tax ID and wait for approval; retail customers (21+) can order right away
- Retail guest checkout: name, phone, email and a 21+ check, no account needed (wholesale always needs an approved account)
- Checkout places real orders: pick a day (today closes at the same-day cutoff, up to 5 days ahead), pick how you'll pay; prices always come from the database
- `/shop/account`: the customer's orders, what was confirmed, short or declined, and the total
- Store app **Orders** (`/store/orders`): new orders first come, first served; confirm each line in full, part, or decline (stock comes out then); take payments; mark delivered / picked up; cancel (stock goes back)
- Store app **Customers** (`/store/customers`): approve, reject or suspend accounts; standing discount per business
- Emails (Resend): order received, order confirmed / short / cancelled, business account approved

Next: Phase 4 (delivery routes and driver view). See docs/PLAN.md.
