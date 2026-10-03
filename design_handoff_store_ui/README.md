# Handoff: Store app + ordering website UI ("Big buttons", option 1a)

## Overview
A simpler, task-first UI for the Charles App (`charles-app`, Next.js App Router + TypeScript + Tailwind v4 + Supabase). It covers:
- **Store app** (`/store/*`): the home screen is a board of big task buttons; stock changes are numbered steps with tap-to-pick spots and a − / + counter. There are no dropdowns.
- **Ordering website** (`/`, `/shop/wholesale`, `/shop/retail`): Wholesale/Retail pick, age check, catalog with big Add / − / + controls, and a 3-step checkout.

No data model, server action or database function changes. This is a **presentation-layer reskin** of existing pages. Keep every existing data loader, server action (`stockActions.ts`, `products/actions.ts`, …) and RPC (`inv_receive`, `inv_restock`, `inv_move`, `inv_count`, `shop_catalog()`) exactly as it is.

## About the design files
The `.dc.html` files in this folder are **design references built in HTML**. They are prototypes that show the intended look and behavior, not production code. Recreate them in the existing Next.js codebase using its patterns: server components for loading, the client components that already exist, and Tailwind plus the CSS below. Don't ship the HTML. Open `Store A Tasks.dc.html` or `Storefront.dc.html` in a browser to click through them. Sample data comes from `storeData.js`, which is fake data shaped like the real tables.

## Fidelity
**High fidelity.** Colors, type, spacing, borders and interactions are final. Recreate them closely.

---

## 1. Foundation (do this first)

### 1.1 Stylesheet
Copy `code/industry.css` to `src/app/industry.css` and import it in `src/app/layout.tsx` after `globals.css`. Then:
- **Delete the `@import url('https://fonts.googleapis.com/…')` line** at the top of it (fonts are loaded by next/font, see 1.2).
- In `globals.css`, remove the `--background/--foreground` values, the dark-mode media query and the `body` font rule. Map Tailwind to the new tokens instead:
```css
@theme inline {
  --color-background: var(--color-bg);
  --color-foreground: var(--color-text);
}
```
The design is **light only**. Drop the `dark:` variants as you touch each file.

### 1.2 Fonts (must still work offline)
`layout.tsx` currently uses system fonts so the register renders offline. Use `next/font/google`. It **self-hosts the files at build time**, so the offline register keeps working:
```tsx
import { Barlow, Barlow_Condensed } from "next/font/google";
const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const heading = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-heading" });
// <html className={`${body.variable} ${heading.variable} h-full antialiased`}>
```
Then, in `industry.css`, change `--font-heading`/`--font-body` to `var(--font-heading, "Barlow Condensed"), system-ui, sans-serif`. Or remove those two declarations, because the next/font variables set them on `<html>`.

### 1.3 Design tokens (from industry.css)
| Token | Value | Use |
|---|---|---|
| `--color-bg` | #f2f2f3 | page ground |
| `--color-surface` | #e9e9ea | input / search field fill |
| `--color-text` | #1d1f20 | ink |
| `--color-accent` | #5980a6 | the only accent: primary button fill, selected state, icons |
| `--color-divider` | text at 16% alpha | every hairline border |
| accent ramp 100/300/600/700/800/900 | #eef6ff / #b5d9fd / #597ea3 / #416180 / #2c455d / #1d2d3d | 100 = selected/hover fill, 300 = success border, 600 = primary hover, 700 = accent text, 900 = warning text |
| neutral 700 | #5d5d60 | secondary text |
| Fonts | Barlow Condensed 600 (headings, button labels, big numbers), Barlow 400/500/600 (body) | |
| Radius | **0 everywhere** | square corners |
| Shadows | none in the UI | |

Type sizes used: page h1 36px (welcome 40px); tile title 21px (storefront 30px); card title 19–20px; h4 section 20px; body 15px; secondary 13–14px; eyebrow 12px uppercase, letter-spacing .08em.

**No red, green or amber.** Warnings ("Only 0 cases in the warehouse", "Out right now") use `--color-accent-900` + `font-weight:600`. Success notices use an accent-100 fill, accent-300 border and accent-900 text, with a check icon.

### 1.4 Icons
Lucide at **stroke-width 1.5**. Install `lucide-react` and pass `strokeWidth={1.5}`. Icons used: Search, PackagePlus (Receive), ArrowUpFromLine (Restock), ArrowLeftRight (Move), ClipboardCheck (Count), TriangleAlert (Low stock), Tag (Products), History, Users (Staff), ScanBarcode, Minus, Plus, Check, ChevronLeft, MapPin, Truck (Wholesale), ShoppingCart (Retail), X.

### 1.5 Rewrite `src/components/ui.tsx`
Keep the same exports and props so the existing pages keep compiling. Change only the styling:

| Export | New styling |
|---|---|
| `Button` primary | `btn btn-primary blueprint` + `<Corners/>` inside. Large actions: `min-h-14 text-[19px] w-full` |
| `Button` secondary | `btn btn-secondary`, min-height 44px |
| `Button` danger | `btn btn-secondary` with `text-[var(--color-accent-900)]` (no red in the system) |
| `Input` / `Select` / `Textarea` | `input`, min-height 48px, 16px text |
| `Field` | `field`: 12px label above, 13px neutral-700 hint below |
| `Card` | `blueprint p-4` + `<Corners/>`, transparent background |
| `Notice ok` | accent-100 fill, 1px accent-300 border, accent-900 text, Check icon |
| `Notice !ok` | same shape, transparent fill, 1px accent border, accent-900 text, weight 600 |
| `Badge` neutral / retail / warehouse / warn | `tag tag-neutral` / `tag tag-neutral` / `tag tag-neutral` / `tag tag-accent` |

Add these new shared components:
- **`Corners`**: renders `<i className="corner tl"/><i className="corner tr"/><i className="corner bl"/><i className="corner br"/>`. Every `.blueprint` element needs them.
- **`BigTile`** `{href|onClick, icon, title, body, badge?}`: `blueprint`, flex column, gap 14px, padding 18px, min-height 150px, left-aligned. Icon is 30px in accent. Title is Barlow Condensed 600 21px, line-height 1.1. Body is 13px neutral-700. The optional badge is `tag tag-accent` pushed right on the icon row. Hover: `bg-[var(--color-accent-100)]`.
- **`StepHeading`** `{n, children}`: a 26×26 square with a 1px accent border and accent-700 text (Barlow Condensed 600), then an h4 20px, gap 10px.
- **`ChoiceGrid`** `{options:[{id,name,sub}], value, onChange}`: `grid-template-columns: repeat(auto-fill, minmax(150px,1fr))`, gap 10px. Each option is a button, min-height 56px, padding 10px 12px, 1px divider border, name 600 over a 13px neutral-700 sub. Selected: accent-100 fill + accent border. This **replaces every `<Select>` for storage spots, days and payment methods**.
- **`Stepper`** `{value, onChange, size}`: − button, number, + button, joined with no gaps. Large: 56×56 buttons with a 96px-wide input showing Barlow Condensed 600 28px. Medium (shop): 44×44 buttons with a 40px number at 20px. Small (cart): 36×36 buttons. Buttons are `btn btn-secondary`. The number has top and bottom divider borders only.
- **`HomeBar`**: store header (see 2.1).

---

## 2. Store app (`/store`): reference `Store A Tasks.dc.html`

### 2.1 `store/layout.tsx`: header
Replace the long link list with one 60px bar: padding 12px 20px, bottom divider.
- On `/store`: "Store" (Barlow Condensed 600 22px) on the left.
- On any other page: a `Home` secondary button (ChevronLeft icon + "Home", min-height 44px), then the page title at 22px.
- Right side: staff full name (13px neutral-700) and a ghost "Sign out" button (keep the `signOut` form action).
- Main content: `max-w-[1080px] mx-auto px-5 pt-6 pb-10 flex flex-col gap-6`.
The title can come from a small client component that uses `usePathname()` with a map, or from each page rendering its own heading.

### 2.2 `/store`: home (`store/page.tsx`)
- h1 "What are you doing?" (36px), then the line "Pick a task. Every screen has a Home button to come back here." in neutral-700.
- A **search launcher**: a full-width 56px bar with a surface fill, a divider border, a Search icon and the placeholder "Where is it? Type a product or brand". It links to `/store/inventory` and focuses the search there (use `?focus=1` or autofocus).
- A **BigTile grid**: `repeat(auto-fill, minmax(155px,1fr))`, gap 20px.
  - Register, "Ring up a sale" → `/store/register` (the built page; add it as the first tile)
  - Receive delivery, "A supplier delivery arrived" → `/store/inventory/actions?task=receive`
  - Restock front, "Warehouse cases into a fridge" → `?task=restock`
  - Move stock, "Between two spots" → `?task=move`
  - Count a spot, "Fix the number by hand" → `?task=count`
  - Low stock, "Restock or reorder", with badge "{n} items" (count the two lists the low-stock page already computes) → `/store/low-stock`
- Below: a row of secondary buttons (min-height 44px, with icons): Products and prices, Sales, History, Staff (managers only, same rule as today).
- Drop the "Coming next" line.

### 2.3 `/store/inventory`: find (`InventoryMap.tsx`)
Keep the current logic: `matchesQuery`, highlight, per-spot list.
- The search is a 56px field: surface fill, **1px accent border**, Search icon, 18px text, placeholder "Type a product or brand, e.g. corona", and a ghost Clear button when there's text.
- Results (only while typing): blueprint rows, padding 14px 16px. Each row has the product name (Barlow Condensed 600 19px) and `tag tag-accent` chips for each spot, "Front Fridge 1 · 38 singles". If there's no stock anywhere, show "None in stock" (accent-900, 600).
- Spot groups: h4 label + `tag tag-neutral` "counted in singles"/"counted in cases". Grid `minmax(150px,1fr)`, gap 12px. Each spot is a button, min-height 84px, padding 14px: name 600, then "{n} items · {total} {unit}" (13px), then hit text in accent-800 600. Matching spots get an accent-100 fill and accent border. Non-matching spots drop to **opacity .4** while searching.
- Tapping a spot opens a blueprint panel below with the spot name and a Close button, plus a `.table` of Item / Singles-or-Cases where quantities are right-aligned, 600, 18px.
- "Edit storage spots" stays as a secondary button.

### 2.4 `/store/inventory/actions`: stock actions (`StockActions.tsx`)
Read `?task=` (receive|restock|move|count) and `?product=` for the starting state. The layout is a single column, max-width 640px.
- A **segmented control** across the top: Receive | Restock front | Move | Count. Each segment is 44px; the selected one has an accent fill and bg-colored text.
- Help text in neutral-700:
  - receive: "A supplier delivery arrived. Add it where you put it."
  - restock: "Bring cases from the warehouse into a front fridge. Cases turn into singles."
  - move: "Move stock between two warehouse spots, or between two front fridges."
  - count: "Counted a spot by hand? Enter the real number and the system will match it."
- Numbered steps (`StepHeading`, 28px gap between steps):
  1. **Product**: an input ("Type a name or brand") + a Scan button (ScanBarcode). Matches show as 48px rows: name on the left, "{front} front · {back} back" on the right. Once picked, a blueprint card shows the name (20px), the stock line and a Change button. Keep the existing barcode scan hook.
  2. **Spots** (`ChoiceGrid`, sub-label "{qty} {unit} here" for the picked product):
     - receive: "Put it in" (all spots)
     - restock: "From (warehouse)" (warehouse spots), then "Into (front fridge)" (retail spots)
     - move: "From" (all), then "To" (same catalog as From, excluding From; shows "Pick “From” first." until then)
     - count: "Spot you counted"
  3. **Quantity** (`Stepper`, large): the label is "How many cases" (restock), "Counted (singles|cases)" (count) or "How many (singles|cases)". Hint to the right: restock shows "= {n × case_size} singles into the fridge"; count shows "System has {current}". Below is a 44px optional note input (receive placeholder: "Note (optional): supplier or invoice #").
- Submit is a full-width primary button, 56px tall, 19px text, labeled with the task name. It stays disabled until the product, every spot and the quantity are set (≥1, or ≥0 for count).
- On success, show the Notice at the top: "Moved 2 cases of Corona Extra 12oz from Warehouse A into Front Fridge 1 (48 singles)." with a Done button that goes to `/store`. Reset the product and quantity, and keep the task.

### 2.5 `/store/low-stock`
Two columns, `repeat(auto-fit, minmax(300px,1fr))`, gap 24px. Intro line: "Items below their low-stock level. Set levels on each product's page."
- **Restock the front fridges** (tag "singles"), sub-line "Bring these from the warehouse." Each item is a blueprint row: name 600, "Front: {on_hand} (low at {min}) · {where}" at 13px, and a shortage line in accent-900 when warehouse stock is short. On the right is a primary "Bring {n} case" button that links to `/store/inventory/actions?task=restock&product={id}`.
- **Reorder for the warehouse** (tag "cases"), sub-line "Order these from the supplier." Rows look the same, with a right-aligned number (Barlow Condensed 600 22px) over "cases to order" (12px).

### 2.6 `/store/products`
- Top row: search input (48px) + primary "New product" + secondary "Import spreadsheet".
- A card grid, `minmax(280px,1fr)`, gap 16px. Each blueprint card has the name at 19px, then "{brand} · {category} · case of {n}". Below that is a 3-column grid of Cost / Wholesale / Party, each with an 11px uppercase label over a 600 value. Last is a row of `tag tag-neutral` chips "{pack} ${cash} / ${card}". Each card links to `/store/products/[id]`.
- Footnote: "Retail packs show cash / card price."
- The product form (`ProductForms.tsx`) only needs the `ui.tsx` restyle.

### 2.7 `/store/inventory/history`
A list, not a table: rows with padding 14px 0 and a bottom divider. When (130px, 13px neutral-700) | **{what}** {item} with the detail underneath at 13px | who (13px). They wrap on phones.

### 2.8 Register, Sales, Staff, Login, Driver
These weren't redesigned. Apply the `ui.tsx` restyle and the new header only. Keep all register logic (offline, Square) unchanged.

---

## 3. Ordering website: reference `Storefront.dc.html`

### 3.1 `ShopShell.tsx`: header
A 60px bar, padding 10px 20px, bottom divider: "Charles" (Barlow Condensed 600 22px, links to `/`), then tabs **Wholesale | Retail** (44px, 500 weight, active = 2px accent bottom border + accent-800 text, inactive neutral-700). On the right: the signed-in business name (13px neutral-700), or a secondary "Sign in" button when signed out on wholesale. Remove the amber preview banner until checkout opens, or restyle it as the accent-100 Notice. Main content: `max-w-[1180px] mx-auto px-5 pt-7 pb-10`.

### 3.2 `/`: welcome (`app/page.tsx`)
- h1 "Welcome" (40px) and "Are you ordering as a business or as a regular customer?" (17px neutral-700).
- Two big blueprint tiles (`repeat(auto-fit,minmax(260px,1fr))`, gap 20px, max-width 880px, padding 24px, min-height 200px). Each has a 36px accent icon (Truck / ShoppingCart), a 30px title and 15px body text. Keep the current copy exactly.
- "Staff? Open the store app" (14px, link to `/store`).

### 3.3 `AgeGate.tsx`
A blueprint box, max-width 480px, padding 28px: h2 32px "Are you 21 or older?", "We check ID at pickup or delivery.", then two equal 56px buttons, primary "Yes, I'm 21+" and secondary "No". The under-21 message is 20px. The logic is unchanged.

### 3.4 `ShopCatalog.tsx`: catalog
Keep the logic: `useCart` localStorage, `matchesQuery`, categories, availability, `earliestDate`.
- Page h1 at 36px and the lead paragraph (current copy) in neutral-700, max-width 720px.
- Layout: `grid-template-columns: minmax(0,1fr) 330px`, gap 28px, at **≥760px container width** (Tailwind: `md:grid-cols-[minmax(0,1fr)_330px]`). Below that, one column.
- Search is a 56px field with a surface fill, Search icon and 18px text, placeholder "Search, e.g. corona".
- Chips: one horizontally scrolling row (gap 8px, 44px tall, padding 0 14px, 1px divider border). The first chip is **"In stock only"** (it replaces the checkbox), then the categories. Tapping the active chip clears it. Active chip: accent fill, bg-colored text.
- Product grid `minmax(250px,1fr)`, gap 16px. Each blueprint card has padding 16px and gap 10px:
  - The name (Barlow Condensed 600 20px) and "{brand} · {category}" (13px), with the availability tag on the right: In stock = `tag-neutral`, Low = `tag-accent`, Out = `tag-outline`.
  - One row per option, divided by a top border, min-height 48px: label (14px), price (600 17px), then "${card} card" (12px neutral-700) when it differs. Wholesale label: "Case of {case_size}" ("Each" if the case size is 1). Signed-out wholesale shows "Sign in for price".
  - Right side: "Add" (secondary, 44px, padding 0 18px). Once in the cart it becomes a medium `Stepper`; going to 0 removes the item.
  - Wholesale + prices visible: "Party price ${x} / case" (13px).
- **Order panel (wide)**: a sticky blueprint aside (top 16px, padding 18px).
  - Title "Your order · {n} cases|items".
  - Empty state: "Nothing added yet. Tap Add on any item."
  - Lines: name 600 14px, "{label} · ${line total}" at 12px, plus "Out right now"/"Running low" in accent-900 600, and a small Stepper.
  - "Estimated total" row (600 17px).
  - The low/out note: "Items that are low or out may be partly filled or declined. We'll email you."
  - Primary "Check out" (52px, full width).
  - Signed-out wholesale shows "Sign in with an approved business account to see prices and order." + secondary "Sign in" + ghost "Apply for a business account" instead.
- **Phone**: no aside. When the cart has items, show a sticky bottom bar (padding 12px 16px, bg ground, top divider) with a full-width 56px primary button: "Check out · {n} {unit} · ${total}".

### 3.5 Checkout (new client view, or `/shop/[kind]/checkout`)
A single column, max-width 640px. At the top, a secondary "Keep shopping" button (ChevronLeft), then h1 "Check out".
1. **Your order**: lines with a medium Stepper and the low/out note.
   - Signed-out wholesale: a blueprint box saying "Sign in with an approved business account to see prices and order." + Sign in.
2. **Delivery day** (wholesale) / **Pickup day** (retail): a `ChoiceGrid` (`minmax(104px,1fr)`) of the next 5 days, labeled Today / Tomorrow / weekday, with "Oct 2" underneath. Today is disabled (opacity .45, sub "Closed after 3 PM") once it's past `settings.same_day_cutoff`. Footnote: "Same-day online orders close at 3 PM. After that, call the store."
3. **How you'll pay** (wholesale: Cash, Check, Card, Zelle, Invoice) / **Pay at pickup** (retail: Cash, Card). For retail, picking Card switches line prices and the total to `cardPriceCents`. Note: "Card prices are a little higher than cash. The total updates when you pick."
- "Estimated total" (600 19px), then the full-width 56px primary "Place order". While disabled, a 13px centered reason shows under it: "Add something to your order first." / "Sign in to place a wholesale order." / "Pick a delivery|pickup day." / "Pick how you'll pay."
- After placing: return to the catalog, clear the cart, and show the success Notice: "Order sent: {n} {unit} for delivery|pickup {tomorrow | on Friday}. We'll email you when it's confirmed."
- Placing orders is Phase 3 (the `orders` / `order_lines` tables). Until that server action exists, keep the button disabled with the current note "Online ordering isn't open yet. Call the store to place this order."
- Open question from PLAN.md #7: retail pickup vs delivery. The design shows pickup only.

---

## Interactions & states (all screens)
- Hover: secondary buttons get a 7% ink tint; tiles, rows and choices get an accent-100 fill. The primary button hovers to accent-600 and goes to accent-700 when pressed (already in industry.css).
- Focus: 2px accent `:focus-visible` outline, offset 2px (already in industry.css).
- Disabled: opacity .45, not-allowed cursor.
- Minimum touch target: 44px everywhere, 56px for primary actions.
- No animations or transitions.
- Responsive: every grid uses `auto-fill/auto-fit minmax(...)`, so it reflows from 390px to 1280px. The only hard breakpoint is the shop's order panel at 760px.

## Files in this folder
- `Store A Tasks.dc.html`: store app prototype (home, find, stock actions, low stock, products, history).
- `Storefront.dc.html`: website prototype (welcome, age gate, wholesale/retail catalog, checkout). Props: `kind`, `start`, `signedIn`, `ageConfirmed`, `sampleCart`.
- `storeData.js`: sample data shaped like `products`, `locations`, `stock`, `pack_sizes` and the low-stock lists.
- `code/industry.css`: the stylesheet to copy into `src/app/industry.css` (see 1.1).
- `_ds/…`, `support.js`: only needed to open the prototypes in a browser.

## Suggested order for Claude Code
1. Foundation (1.1–1.5), then run `npm run build` to check nothing broke.
2. Store header + home.
3. Stock actions, inventory, low stock, products, history.
4. Shop header, welcome, age gate, catalog, checkout view.
5. Check each route at 390px and 1280px.
