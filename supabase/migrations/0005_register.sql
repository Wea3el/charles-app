-- Phase 2: register.
-- Sales are written through record_sale(), which is idempotent on
-- sales.client_id so the laptop can resend offline sales as often as it
-- likes. Each line takes singles out of the front fridges and logs a 'sale'
-- movement. Managers can void a sale, which puts the singles back.
-- Card payments go through the Square Terminal; terminal_checkouts tracks
-- each checkout so a paid card can always be matched to its sale.

alter type movement_kind add value if not exists 'sale_void';

create type checkout_status as enum ('pending', 'in_progress', 'cancel_requested', 'canceled', 'completed');

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
-- Store time zone, used for "today" in daily totals (and later the 3 PM cutoff).
alter table settings add column timezone text not null default 'America/New_York';

-- ---------------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------------
alter table sales
  add column sale_number      bigint generated always as identity,   -- printed on receipts
  add column sold_at          timestamptz not null default now(),    -- rung up (laptop clock); created_at = reached the server
  add column cash_tendered    numeric(10,2),
  add column change_given     numeric(10,2),
  add column square_payment_id text,
  add column voided_at        timestamptz,
  add column voided_by        uuid references staff (id),
  add column void_reason      text,
  add constraint sales_total_matches check (total = subtotal - discount_amount),
  add constraint sales_total_not_negative check (total >= 0),
  add constraint sales_void_complete check ((voided_at is null) = (voided_by is null));

-- Snapshots so receipts and voids stay right after pack sizes or prices change.
alter table sale_lines
  add column pack_label     text,
  add column pack_units     integer not null default 1 check (pack_units > 0),  -- singles per pack
  add column discount_kind  discount_kind,
  add column discount_value numeric(10,2),
  add column line_total     numeric(10,2) generated always as (unit_price * quantity - line_discount) stored,
  add constraint sale_lines_discount_range check (line_discount >= 0 and line_discount <= unit_price * quantity);
alter table sale_lines alter column pack_units drop default;

alter table stock_movements
  add constraint stock_movements_sale_id_fkey foreign key (sale_id) references sales (id);

create index if not exists sales_sold_at_idx on sales (sold_at);
create index if not exists sales_staff_id_idx on sales (staff_id);
create index if not exists sales_voided_by_idx on sales (voided_by);
create index if not exists sale_lines_pack_size_id_idx on sale_lines (pack_size_id);
create index if not exists sale_lines_location_id_idx on sale_lines (location_id);
create index if not exists stock_movements_sale_id_idx on stock_movements (sale_id);

-- Sales are append-only: staff ring them up, only managers change them (voids).
drop policy staff_all on sales;
drop policy staff_all on sale_lines;
create policy sales_select on sales for select to authenticated using ((select private.is_staff()));
create policy sales_insert on sales for insert to authenticated with check ((select private.is_staff()));
create policy sales_update on sales for update to authenticated
  using ((select private.is_manager())) with check ((select private.is_manager()));
create policy sale_lines_select on sale_lines for select to authenticated using ((select private.is_staff()));
create policy sale_lines_insert on sale_lines for insert to authenticated with check ((select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Square Terminal checkouts
-- ---------------------------------------------------------------------------
-- One row per checkout sent to the terminal. sale_client_id is the client_id
-- the sale will be recorded under once the card goes through.
create table terminal_checkouts (
  id                 uuid primary key default gen_random_uuid(),  -- also the Square idempotency key
  sale_client_id     text not null,
  amount             numeric(10,2) not null check (amount > 0),
  square_checkout_id text unique,
  square_payment_id  text,
  status             checkout_status not null default 'pending',
  staff_id           uuid references staff (id) default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on terminal_checkouts (sale_client_id);
create index on terminal_checkouts (staff_id);

alter table terminal_checkouts enable row level security;
create policy terminal_checkouts_select on terminal_checkouts for select to authenticated using ((select private.is_staff()));
create policy terminal_checkouts_insert on terminal_checkouts for insert to authenticated with check ((select private.is_staff()));
create policy terminal_checkouts_update on terminal_checkouts for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

-- ---------------------------------------------------------------------------
-- record_sale
-- ---------------------------------------------------------------------------
-- p_sale (money in cents, as the register keeps it):
-- {
--   "client_id": "…", "price_mode": "cash" | "card", "sold_at": "…",
--   "recorded_offline": false, "staff_id": "…" (optional, defaults to caller),
--   "subtotal_cents": 0, "discount_cents": 0, "total_cents": 0,
--   "discount": {"kind": "percent" | "flat", "value": 10} | null,
--   "cash_tendered_cents": 0, "square_checkout_id": "…", "square_payment_id": "…",
--   "lines": [{"pack_size_id": "…", "quantity": 1, "unit_price_cents": 0,
--              "discount_cents": 0, "discount": {…} | null}]
-- }
-- Prices come from the laptop (they are what the customer was charged, even
-- if a price changed while offline); the sums are checked here.
-- Returns the sale id. Sending the same client_id again returns the same id.
create or replace function record_sale(p_sale jsonb)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_client_id text := nullif(trim(p_sale->>'client_id'), '');
  v_staff uuid := coalesce((p_sale->>'staff_id')::uuid, (select auth.uid()));
  v_sale_id uuid;
  v_line jsonb;
  v_pack record;
  v_qty integer;
  v_unit_cents bigint;
  v_line_disc bigint;
  v_subtotal bigint := 0;
  v_order_disc bigint := coalesce((p_sale->>'discount_cents')::bigint, 0);
  v_total bigint;
  v_tendered bigint := (p_sale->>'cash_tendered_cents')::bigint;
  v_need integer;
  v_take integer;
  v_first_loc uuid;
  v_loc record;
begin
  perform private.require_staff();
  if v_client_id is null then
    raise exception 'Sale is missing its client_id';
  end if;
  if p_sale->>'price_mode' is null then
    raise exception 'Pick cash or card';
  end if;

  -- Already synced: nothing to do.
  select id into v_sale_id from sales where client_id = v_client_id;
  if v_sale_id is not null then
    return v_sale_id;
  end if;

  if jsonb_typeof(p_sale->'lines') is distinct from 'array' or jsonb_array_length(p_sale->'lines') = 0 then
    raise exception 'Sale has no items';
  end if;
  if not exists (select 1 from staff where id = v_staff) then
    raise exception 'Unknown staff member';
  end if;

  -- Check the arithmetic before writing anything.
  for v_line in select * from jsonb_array_elements(p_sale->'lines') loop
    v_qty := (v_line->>'quantity')::integer;
    v_unit_cents := (v_line->>'unit_price_cents')::bigint;
    v_line_disc := coalesce((v_line->>'discount_cents')::bigint, 0);
    if v_qty is null or v_qty <= 0 then
      raise exception 'Quantity must be more than 0';
    end if;
    if v_unit_cents is null or v_unit_cents < 0 then
      raise exception 'Price is missing';
    end if;
    if v_line_disc < 0 or v_line_disc > v_unit_cents * v_qty then
      raise exception 'Line discount is more than the line';
    end if;
    v_subtotal := v_subtotal + v_unit_cents * v_qty - v_line_disc;
  end loop;
  if v_order_disc < 0 or v_order_disc > v_subtotal then
    raise exception 'Discount is more than the sale';
  end if;
  v_total := v_subtotal - v_order_disc;
  if (p_sale->>'subtotal_cents')::bigint is distinct from v_subtotal
     or (p_sale->>'total_cents')::bigint is distinct from v_total then
    raise exception 'Sale totals do not add up (expected subtotal %, total %)', v_subtotal, v_total;
  end if;
  if v_tendered is not null and v_tendered < v_total then
    raise exception 'Cash given is less than the total';
  end if;

  insert into sales (
    client_id, staff_id, price_mode, sold_at, recorded_offline,
    subtotal, discount_kind, discount_value, discount_amount, total,
    cash_tendered, change_given, square_checkout_id, square_payment_id
  ) values (
    v_client_id, v_staff, (p_sale->>'price_mode')::price_mode,
    least(coalesce((p_sale->>'sold_at')::timestamptz, now()), now()),
    coalesce((p_sale->>'recorded_offline')::boolean, false),
    v_subtotal / 100.0,
    (p_sale->'discount'->>'kind')::discount_kind,
    (p_sale->'discount'->>'value')::numeric,
    v_order_disc / 100.0,
    v_total / 100.0,
    v_tendered / 100.0,
    (v_tendered - v_total) / 100.0,
    p_sale->>'square_checkout_id',
    p_sale->>'square_payment_id'
  )
  on conflict (client_id) do nothing
  returning id into v_sale_id;

  -- Lost a race with another sync of the same sale.
  if v_sale_id is null then
    select id into v_sale_id from sales where client_id = v_client_id;
    return v_sale_id;
  end if;

  for v_line in select * from jsonb_array_elements(p_sale->'lines') loop
    select ps.id, ps.product_id, ps.label, ps.units, p.cost_per_case, p.case_size
      into v_pack
      from pack_sizes ps join products p on p.id = ps.product_id
      where ps.id = (v_line->>'pack_size_id')::uuid;
    if v_pack.id is null then
      raise exception 'Unknown pack size %', v_line->>'pack_size_id';
    end if;
    v_qty := (v_line->>'quantity')::integer;

    -- Take singles from the front fridges, ones that have it first, in map
    -- order. A sale is never refused for stock (it already happened); any
    -- shortfall comes off the first fridge, which then shows negative until
    -- someone counts it. The lock keeps two sales of one product in line.
    perform pg_advisory_xact_lock(hashtext('retail_stock'), hashtext(v_pack.product_id::text));
    v_need := v_pack.units * v_qty;
    v_first_loc := null;
    for v_loc in
      select l.id, coalesce(s.quantity, 0) as qty
      from locations l
      left join stock s on s.location_id = l.id and s.product_id = v_pack.product_id
      where l.catalog = 'retail'
      order by (coalesce(s.quantity, 0) > 0) desc, l.sort_order, l.name
    loop
      exit when v_need = 0;
      v_first_loc := coalesce(v_first_loc, v_loc.id);
      v_take := least(v_need, greatest(v_loc.qty, 0));
      if v_take > 0 then
        perform private.add_stock(v_loc.id, v_pack.product_id, -v_take);
        insert into stock_movements (kind, product_id, from_location, quantity_out, staff_id, sale_id)
        values ('sale', v_pack.product_id, v_loc.id, v_take, v_staff, v_sale_id);
        v_need := v_need - v_take;
      end if;
    end loop;
    if v_first_loc is null then
      raise exception 'There are no front fridges to sell from';
    end if;
    if v_need > 0 then
      perform private.add_stock(v_first_loc, v_pack.product_id, -v_need);
      insert into stock_movements (kind, product_id, from_location, quantity_out, staff_id, sale_id, note)
      values ('sale', v_pack.product_id, v_first_loc, v_need, v_staff, v_sale_id, 'Sold more than on hand; count this spot');
    end if;

    -- location_id is the main fridge it came from; stock_movements has the full split.
    insert into sale_lines (
      sale_id, product_id, pack_size_id, location_id, pack_label, pack_units, quantity,
      unit_price, unit_cost, line_discount, discount_kind, discount_value
    ) values (
      v_sale_id, v_pack.product_id, v_pack.id, v_first_loc, v_pack.label, v_pack.units, v_qty,
      (v_line->>'unit_price_cents')::bigint / 100.0,
      round(v_pack.cost_per_case * v_pack.units / v_pack.case_size, 2),
      coalesce((v_line->>'discount_cents')::bigint, 0) / 100.0,
      (v_line->'discount'->>'kind')::discount_kind,
      (v_line->'discount'->>'value')::numeric
    );
  end loop;

  return v_sale_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- void_sale (managers only)
-- ---------------------------------------------------------------------------
-- Puts every single back where it came from. Card refunds are done on Square.
create or replace function void_sale(p_sale uuid, p_reason text)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_voided timestamptz;
  v_found boolean;
  v_move record;
begin
  if not private.is_manager() then
    raise exception 'Only a manager can void a sale';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for the void';
  end if;
  select true, voided_at into v_found, v_voided from sales where id = p_sale for update;
  if v_found is null then
    raise exception 'Sale not found';
  end if;
  if v_voided is not null then
    raise exception 'Sale was already voided';
  end if;

  update sales set voided_at = now(), voided_by = (select auth.uid()), void_reason = trim(p_reason)
  where id = p_sale;

  for v_move in
    select product_id, from_location, quantity_out
    from stock_movements where sale_id = p_sale and kind = 'sale'
  loop
    perform private.add_stock(v_move.from_location, v_move.product_id, v_move.quantity_out);
    insert into stock_movements (kind, product_id, to_location, quantity_in, staff_id, sale_id, note)
    values ('sale_void', v_move.product_id, v_move.from_location, v_move.quantity_out,
            (select auth.uid()), p_sale, trim(p_reason));
  end loop;
end;
$$;

revoke execute on function record_sale(jsonb), void_sale(uuid, text) from public, anon;
grant execute on function record_sale(jsonb), void_sale(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Daily totals (end-of-day report), store time zone, voids left out.
-- ---------------------------------------------------------------------------
create or replace view register_daily with (security_invoker = true) as
select
  (s.sold_at at time zone st.timezone)::date as sale_date,
  s.price_mode,
  count(*)::integer                   as sales_count,
  sum(s.subtotal + coalesce(l.line_discounts, 0))                     as gross,
  sum(s.discount_amount + coalesce(l.line_discounts, 0))              as discounts,
  sum(s.total)                        as total,
  count(*) filter (where s.recorded_offline)::integer as offline_count
from sales s
cross join settings st
left join (
  select sale_id, sum(line_discount) as line_discounts from sale_lines group by sale_id
) l on l.sale_id = s.id
where s.voided_at is null
group by 1, 2;
