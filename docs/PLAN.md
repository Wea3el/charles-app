# Plan summary

The full living plan is the Claude Docs document "Store System Plan: Deliverables & Feasibility". This file is a snapshot of the decisions the code is built around (as of 2026-09-26).

## Inventory

- Two stock pools:
  - **Retail**: the front commercial fridges, counted in **singles**. Register sales come out of here.
  - **Warehouse**: the 2 warehouse areas and 2 industrial fridges (assumed), counted in **cases**. Wholesale and party orders come out of here.
- Restocking the front moves cases out of the warehouse and adds singles to a front fridge (1 case = `products.case_size` singles).
- Each commercial fridge is its own location.
- Low-stock tab: restock-the-front list and reorder-from-supplier list (`stock_thresholds`).

## Register

- Scan a single, then pick Single / 4 pack / 6 pack; 12s and 24s scan their own barcode (`pack_sizes`).
- Cash vs card price toggle flips every line (`src/lib/pricing.ts`). State rules on cash/card pricing still need checking.
- Manual discounts, % or $, per line or whole sale, logged by staff member.
- Total goes to the Square Terminal via the Terminal API (needs internet).
- Must work offline: sales are stored on the laptop and synced later; `sales.client_id` prevents duplicates.
- Only 4 manager accounts can change prices (`staff.can_edit_prices`).

## Online ordering

- Website asks **Wholesale** or **Retail** up front.
  - Wholesale: licensed account (online sign-up waits for approval; in-store sign-up is approved on the spot), warehouse stock, wholesale/party prices.
  - Retail: regular customers, front-fridge stock, retail prices, 21+ check.
- Customers see In stock / Low / Out (`product_availability` view), not exact counts.
- First-come priority by `orders.placed_at`; quantity added later is tracked by `order_lines.requested_at`.
- Online same-day orders close at 3 PM (`settings.same_day_cutoff`); later same-day orders come in by phone.
- Out-of-stock lines can be confirmed, partially filled or declined; customers get email updates (no SMS).
- Payments: cash, check, card, Zelle, invoice.

## Delivery

- 1 truck, 1 driver, 15–20 stops, multiple trips a day (`delivery_trips`).
- Ice orders first, then fastest route from the store.
- Staff can reorder stops until the driver leaves; `delivery_trips.departed_at` locks the order.
- Status: Prepared → En route → Heading to customer → Delivered; customers see their stop number.
- Unpaid bills: acting manager signs and prints their name on the driver's phone.
- Empties collected are credited on the bill at delivery (`settings.empty_credit_rate`).

## Phases

0. Decide and gather: pricing rules check, export old POS data, type up paper records, store layout, accounts.
1. Catalog + inventory. **Built** (2026-09-26): see README "Status".
2. Register (with offline mode and Square Terminal). **Built** (2026-09-28).
3. Online ordering (wholesale + retail). **Built** (2026-10-05).
4. Delivery routes and driver view.

## Still open

1. Do the industrial fridges belong to warehouse (assumed) or retail?
2. Name of the old POS, and can it export?
3. Should discounts be limited to certain staff?
4. Credit per empty, and does it vary by container?
5. How many days ahead can customers order? Set to 5 (today + 4) for now: `settings.order_days_ahead`.
6. Payment terms for invoice customers; flag overdue balances?
7. Retail online orders: pickup or delivery, pay online or in store, cash or card price? Built as: pickup only, pay at pickup, cash or card price picked at checkout.
8. Sales tax: are shelf prices tax-included, and if not, what rate? The register does not add tax yet.
9. Voids are managers only. Should cashiers be able to void their own sale for a few minutes?

## Phase 1 notes

- Stock changes go through database functions (`inv_receive`, `inv_restock`, `inv_move`, `inv_count`) so each change is atomic and logged in `stock_movements`.
- Access checks live in the `private` schema (not exposed through the API). Row level security: any active staff member can view and move stock; only price editors can change products and prices; only managers manage staff.
- Starting storage spots were seeded (Industrial Fridge 1–2, Warehouse A–B, Front Fridge 1–4). Rename, add or delete them under Inventory > Edit storage spots.

## Phase 2 notes

- Sales are written only through `record_sale()`. The laptop gives each sale a `client_id`, so resending never duplicates it. Prices come from the laptop (what the customer paid, even if prices changed while offline); the database checks the sums.
- A sale is never refused for stock. Singles come out of front fridges that have them, in map order; a shortfall makes the first fridge go negative with a "count this spot" note.
- Sales can't be edited or deleted. Managers void with a reason (`void_sale()`), which puts the singles back. Refund card payments in Square.
- `terminal_checkouts` records every Square Terminal checkout so a paid card can always be matched to its sale.
- Customers never read products or stock directly: the shop pages use `shop_catalog()`, which returns In stock / Low / Out and only shows wholesale prices to approved accounts and staff.

## Phase 3 notes

- Customers sign up on the website. A trigger on new logins makes the `customers` row from the sign-up form: retail is approved right away, wholesale is `pending` until staff approve it in Customers. Staff logins carry no sign-up data, so they never get one.
- Orders are written only through `place_order()`. It checks the account (approved, right kind), the day (store time zone, same-day cutoff, `order_days_ahead`) and prices every line from the database. The browser's `client_id` makes a double-click or resend return the same order.
- Stock is not held when an order is placed. Staff confirm each line with `confirm_order()` (full, part, or 0 to decline), first come first served; that is when stock comes out (fullest spot first) and it refuses to confirm more than is on hand. `cancel_order()` puts picked stock back.
- Order lines keep a snapshot of the product name, option label and price, so orders read the same after the catalog changes.
- Retail customers can also check out as a guest through `place_guest_order()`. A guest is a retail `customers` row with no login, reused by email (latest name and phone kept). Guests get the same emails but have no "My orders" page. Signing up later with the same email starts a separate account; past guest orders are not moved over.
- A business's standing discount (`customers.default_discount_*`) is copied onto each new order.
- Emails go through Resend when `EMAIL_API_KEY` / `EMAIL_FROM` are set and are skipped otherwise.
- Not built yet: uploading license / tax documents (staff check them in person for now), staff entering phone or in-store orders for a customer, customers changing or cancelling an order online (they call the store).
