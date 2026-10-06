-- Phase 3: online ordering.
-- Customers sign up on the website (a trigger makes their customers row:
-- retail is approved right away, wholesale waits for staff). They place
-- orders through place_order(), which prices every line from the database.
-- Staff confirm, partly fill or decline each line with confirm_order(); that
-- is when stock comes out (warehouse cases for wholesale, front-fridge
-- singles for retail). cancel_order() puts it back.

alter type movement_kind add value if not exists 'order_cancel';

-- How many days ahead customers can order (today counts as day 1).
alter table settings add column order_days_ahead integer not null default 5 check (order_days_ahead between 1 and 60);

alter table orders
  add column client_id       text unique,            -- from the browser; a double-click never makes two orders
  add column payment_method  payment_method,         -- how the customer said they'd pay
  add column price_mode      price_mode,             -- retail: cash or card prices
  add column discount_amount numeric(10,2) not null default 0,
  add column confirmed_at    timestamptz,
  add column confirmed_by    uuid references staff (id),
  add column cancelled_at    timestamptz,
  add column cancel_reason   text;

-- Snapshots so an order reads the same after products or prices change.
alter table order_lines
  add column product_name text,
  add column option_label text,                      -- 'Case of 24', '6 pack', ...
  add column pack_units   integer check (pack_units > 0);  -- retail: singles per pack

create index if not exists orders_status_idx on orders (status, fulfillment_date);
create index if not exists orders_confirmed_by_idx on orders (confirmed_by);
create index if not exists orders_entered_by_staff_idx on orders (entered_by_staff);
create index if not exists order_lines_pack_size_id_idx on order_lines (pack_size_id);
create index if not exists stock_movements_order_id_idx on stock_movements (order_id);
create index if not exists payments_received_by_idx on payments (received_by);
create index if not exists customers_approved_by_idx on customers (approved_by);
create index if not exists customers_created_by_staff_idx on customers (created_by_staff);
create index if not exists customers_status_idx on customers (status);

alter table stock_movements
  add constraint stock_movements_order_id_fkey foreign key (order_id) references orders (id);

-- ---------------------------------------------------------------------------
-- Customer sign-up
-- ---------------------------------------------------------------------------
-- The website signs people up with user metadata {customer_kind, ...}. Staff
-- logins are made without it, so they never get a customers row.
create or replace function private.handle_new_customer() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_kind text := m->>'customer_kind';
  v_name text := coalesce(nullif(trim(m->>'contact_name'), ''), split_part(new.email, '@', 1));
  v_expires text := m->>'license_expires_on';
begin
  if v_kind is null or v_kind not in ('wholesale', 'retail') then
    return new;
  end if;
  insert into customers (
    auth_user_id, kind, status, business_name, contact_name, email, phone,
    address_line, city, state, postal_code, liquor_license_no, license_expires_on, tax_id
  ) values (
    new.id,
    v_kind::customer_kind,
    case when v_kind = 'retail' then 'approved' else 'pending' end::account_status,
    case when v_kind = 'wholesale' then coalesce(nullif(trim(m->>'business_name'), ''), v_name) end,
    v_name,
    new.email,
    nullif(trim(m->>'phone'), ''),
    nullif(trim(m->>'address_line'), ''),
    nullif(trim(m->>'city'), ''),
    nullif(trim(m->>'state'), ''),
    nullif(trim(m->>'postal_code'), ''),
    nullif(trim(m->>'liquor_license_no'), ''),
    case when v_expires ~ '^\d{4}-\d{2}-\d{2}$' then v_expires::date end,
    nullif(trim(m->>'tax_id'), '')
  );
  return new;
end;
$$;
revoke execute on function private.handle_new_customer() from public, anon, authenticated;

create trigger on_auth_user_created_customer
  after insert on auth.users
  for each row execute function private.handle_new_customer();

-- ---------------------------------------------------------------------------
-- Settings the shop pages need (the settings table is staff-only)
-- ---------------------------------------------------------------------------
create or replace function shop_settings()
returns table (same_day_cutoff time, order_days_ahead integer, timezone text)
language sql stable security definer set search_path = public as $$
  select same_day_cutoff, order_days_ahead, timezone from settings;
$$;
revoke execute on function shop_settings() from public;
grant execute on function shop_settings() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Order totals
-- ---------------------------------------------------------------------------
-- Pending lines count what was asked for; confirmed/partial lines count what
-- staff confirmed; declined lines count nothing.
create or replace function private.refresh_order_totals(p_order uuid) returns void
language plpgsql set search_path = public as $$
declare
  v_sub numeric(10,2);
  v_disc numeric(10,2);
  o record;
begin
  select discount_kind, discount_value, empties_credit into o from orders where id = p_order;
  select coalesce(sum(unit_price * case status
                                     when 'pending' then requested_qty
                                     when 'declined' then 0
                                     else coalesce(confirmed_qty, 0)
                                   end), 0)
    into v_sub from order_lines where order_id = p_order;
  v_disc := case o.discount_kind
              when 'percent' then round(v_sub * least(o.discount_value, 100) / 100, 2)
              when 'flat' then least(o.discount_value, v_sub)
              else 0
            end;
  update orders
     set subtotal = v_sub,
         discount_amount = v_disc,
         total = greatest(v_sub - v_disc - empties_credit, 0)
   where id = p_order;
end;
$$;
revoke execute on function private.refresh_order_totals(uuid) from public, anon;
grant execute on function private.refresh_order_totals(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- place_order (customers)
-- ---------------------------------------------------------------------------
-- p_order:
-- {
--   "client_id": "…", "kind": "wholesale" | "retail", "fulfillment_date": "YYYY-MM-DD",
--   "payment_method": "cash" | "check" | "card" | "zelle" | "invoice", "notes": "…",
--   "lines": [{"option_id": "…", "quantity": 2}]
-- }
-- option_id is a product id (wholesale, one case) or a pack size id (retail).
-- Prices always come from the database. Returns {id, order_number}.
create or replace function place_order(p_order jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_client_id text := nullif(trim(p_order->>'client_id'), '');
  v_kind customer_kind;
  v_method payment_method;
  v_date date;
  v_cust customers%rowtype;
  v_set settings%rowtype;
  v_now timestamp;
  v_order orders%rowtype;
  v_line record;
begin
  begin
    v_kind := (p_order->>'kind')::customer_kind;
    v_method := (p_order->>'payment_method')::payment_method;
    v_date := (p_order->>'fulfillment_date')::date;
  exception when others then
    raise exception 'Order is missing its kind, day or payment';
  end;
  if v_kind is null or v_method is null or v_date is null then
    raise exception 'Order is missing its kind, day or payment';
  end if;
  if v_client_id is null then
    raise exception 'Order is missing its client_id';
  end if;

  select * into v_cust from customers where auth_user_id = (select auth.uid());
  if v_cust.id is null then
    raise exception 'Sign in with a customer account to order';
  end if;
  if v_cust.kind <> v_kind then
    raise exception 'This is a % account. Order from the % shop.', v_cust.kind, v_cust.kind;
  end if;
  if v_cust.status = 'pending' then
    raise exception 'Your account is waiting for approval. We''ll email you once it''s approved.';
  end if;
  if v_cust.status <> 'approved' then
    raise exception 'This account can''t order online right now. Call the store.';
  end if;

  -- Already placed (double-click or resend): hand back the same order.
  select * into v_order from orders where client_id = v_client_id;
  if v_order.id is not null then
    if v_order.customer_id <> v_cust.id then
      raise exception 'Something went wrong. Place the order again.';
    end if;
    return jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number);
  end if;

  select * into v_set from settings;
  v_now := now() at time zone v_set.timezone;
  if v_date < v_now::date or v_date >= v_now::date + v_set.order_days_ahead then
    raise exception 'Pick a day from today to % days ahead', v_set.order_days_ahead - 1;
  end if;
  if v_date = v_now::date and v_now::time >= v_set.same_day_cutoff then
    raise exception 'Same-day online orders are closed for today. Call the store, or pick another day.';
  end if;
  if v_kind = 'retail' and v_method not in ('cash', 'card') then
    raise exception 'Pay at pickup with cash or card';
  end if;
  if jsonb_typeof(p_order->'lines') is distinct from 'array' or jsonb_array_length(p_order->'lines') = 0 then
    raise exception 'Add something to your order first';
  end if;

  insert into orders (
    client_id, customer_id, customer_kind, channel, fulfillment_date, payment_method, price_mode,
    discount_kind, discount_value, notes
  ) values (
    v_client_id, v_cust.id, v_kind, 'online', v_date, v_method,
    case when v_kind = 'retail' then (case when v_method = 'card' then 'card' else 'cash' end)::price_mode end,
    v_cust.default_discount_kind, v_cust.default_discount_value,
    nullif(left(trim(p_order->>'notes'), 1000), '')
  )
  on conflict (client_id) do nothing
  returning * into v_order;
  if v_order.id is null then
    -- Lost a race with the same order sent twice.
    select * into v_order from orders where client_id = v_client_id;
    return jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number);
  end if;

  -- Same option twice in the payload counts once, with the quantities added.
  for v_line in
    select (l->>'option_id')::uuid as option_id, sum((l->>'quantity')::integer)::integer as qty
    from jsonb_array_elements(p_order->'lines') l
    group by 1
  loop
    if v_line.qty is null or v_line.qty <= 0 or v_line.qty > 999 then
      raise exception 'Quantities must be between 1 and 999';
    end if;
    if v_kind = 'wholesale' then
      insert into order_lines (order_id, product_id, requested_qty, unit_price, product_name, option_label)
      select v_order.id, p.id, v_line.qty, p.wholesale_case_price, p.name,
             case when p.case_size = 1 then 'Each' else 'Case of ' || p.case_size end
      from products p
      where p.id = v_line.option_id and p.active and p.wholesale_case_price is not null;
    else
      insert into order_lines (order_id, product_id, pack_size_id, requested_qty, unit_price, product_name, option_label, pack_units)
      select v_order.id, p.id, ps.id, v_line.qty,
             case when v_method = 'card' then ps.card_price else ps.cash_price end,
             p.name, ps.label, ps.units
      from pack_sizes ps join products p on p.id = ps.product_id
      where ps.id = v_line.option_id and p.active;
    end if;
    if not found then
      raise exception 'Something in your order is no longer sold. Refresh the page and try again.';
    end if;
  end loop;

  perform private.refresh_order_totals(v_order.id);
  return jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number);
end;
$$;
revoke execute on function place_order(jsonb) from public, anon;
grant execute on function place_order(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- confirm_order (staff)
-- ---------------------------------------------------------------------------
-- p_lines: [{"id": "<order line id>", "quantity": 3}]. Every line of the order
-- must be listed: quantity = requested confirms it, less fills part of it,
-- 0 declines it. Stock comes out now: cases from warehouse spots (wholesale)
-- or singles from the front fridges (retail), fullest spot first. Refuses to
-- confirm more than is on hand. Returns the new order status.
create or replace function confirm_order(p_order uuid, p_lines jsonb)
returns order_status
language plpgsql security invoker set search_path = public as $$
declare
  o orders%rowtype;
  v_catalog catalog_kind;
  v_line record;
  v_qty integer;
  v_need integer;
  v_have integer;
  v_take integer;
  v_loc record;
  v_unit text;
  v_status order_status;
  v_me uuid := (select auth.uid());
begin
  perform private.require_staff();
  select * into o from orders where id = p_order for update;
  if o.id is null then
    raise exception 'Order not found';
  end if;
  if o.status <> 'submitted' then
    raise exception 'Order #% was already %', o.order_number, replace(o.status::text, '_', ' ');
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'Say how many of each line to confirm';
  end if;

  v_catalog := case when o.customer_kind = 'wholesale' then 'warehouse' else 'retail' end;
  v_unit := case when v_catalog = 'warehouse' then 'cases' else 'singles' end;

  for v_line in
    select ol.id, ol.product_id, ol.requested_qty, coalesce(ol.pack_units, 1) as pack_units,
           coalesce(ol.product_name, p.name) as name, x.quantity
    from order_lines ol
    join products p on p.id = ol.product_id
    left join lateral (
      select (e->>'quantity')::integer as quantity
      from jsonb_array_elements(p_lines) e where (e->>'id')::uuid = ol.id limit 1
    ) x on true
    where ol.order_id = p_order
    order by ol.requested_at, ol.id
  loop
    v_qty := v_line.quantity;
    if v_qty is null then
      raise exception 'Say how many % to confirm', v_line.name;
    end if;
    if v_qty < 0 or v_qty > v_line.requested_qty then
      raise exception 'Confirm between 0 and % of %', v_line.requested_qty, v_line.name;
    end if;

    if v_qty > 0 then
      v_need := case when v_catalog = 'warehouse' then v_qty else v_qty * v_line.pack_units end;
      -- Same lock as the register, so a sale and an order never take the same singles.
      perform pg_advisory_xact_lock(hashtext(v_catalog || '_stock'), hashtext(v_line.product_id::text));
      select coalesce(sum(greatest(s.quantity, 0)), 0) into v_have
      from stock s join locations l on l.id = s.location_id
      where l.catalog = v_catalog and s.product_id = v_line.product_id;
      if v_have < v_need then
        raise exception 'Only % % of % on hand (need %)', v_have, v_unit, v_line.name, v_need;
      end if;

      for v_loc in
        select s.location_id, s.quantity
        from stock s join locations l on l.id = s.location_id
        where l.catalog = v_catalog and s.product_id = v_line.product_id and s.quantity > 0
        order by s.quantity desc, l.sort_order, l.name
      loop
        exit when v_need = 0;
        v_take := least(v_need, v_loc.quantity);
        perform private.take_stock(v_loc.location_id, v_line.product_id, v_take);
        insert into stock_movements (kind, product_id, from_location, quantity_out, staff_id, order_id)
        values ('order_pick', v_line.product_id, v_loc.location_id, v_take, v_me, p_order);
        v_need := v_need - v_take;
      end loop;
    end if;

    update order_lines
       set confirmed_qty = v_qty,
           status = case when v_qty = 0 then 'declined'
                         when v_qty < requested_qty then 'partial'
                         else 'confirmed' end::line_status
     where id = v_line.id;
  end loop;

  select case
           when bool_and(status = 'declined') then 'cancelled'
           when bool_and(status = 'confirmed') then 'confirmed'
           else 'partially_confirmed'
         end::order_status
    into v_status
    from order_lines where order_id = p_order;

  update orders
     set status = coalesce(v_status, 'cancelled'),
         confirmed_at = now(), confirmed_by = v_me,
         cancelled_at = case when v_status = 'cancelled' then now() end,
         cancel_reason = case when v_status = 'cancelled' then 'Nothing could be filled' end
   where id = p_order;
  perform private.refresh_order_totals(p_order);
  return coalesce(v_status, 'cancelled');
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_order (staff): puts anything already picked back where it came from
-- ---------------------------------------------------------------------------
create or replace function cancel_order(p_order uuid, p_reason text)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  o orders%rowtype;
  v_move record;
begin
  perform private.require_staff();
  if nullif(trim(p_reason), '') is null then
    raise exception 'Give a reason for cancelling';
  end if;
  select * into o from orders where id = p_order for update;
  if o.id is null then
    raise exception 'Order not found';
  end if;
  if o.status in ('cancelled', 'completed') then
    raise exception 'Order #% is already %', o.order_number, o.status;
  end if;
  if exists (select 1 from payments where order_id = p_order) then
    raise exception 'Order #% has payments. Refund them first.', o.order_number;
  end if;

  for v_move in
    select product_id, from_location, sum(quantity_out)::integer as qty
    from stock_movements where order_id = p_order and kind = 'order_pick'
    group by 1, 2
  loop
    perform private.add_stock(v_move.from_location, v_move.product_id, v_move.qty);
    insert into stock_movements (kind, product_id, to_location, quantity_in, staff_id, order_id, note)
    values ('order_cancel', v_move.product_id, v_move.from_location, v_move.qty,
            (select auth.uid()), p_order, trim(p_reason));
  end loop;

  update orders
     set status = 'cancelled', cancelled_at = now(), cancel_reason = trim(p_reason)
   where id = p_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_order (staff): picked up, or handed over on delivery
-- ---------------------------------------------------------------------------
create or replace function complete_order(p_order uuid)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  o orders%rowtype;
begin
  perform private.require_staff();
  select * into o from orders where id = p_order for update;
  if o.id is null then
    raise exception 'Order not found';
  end if;
  if o.status not in ('confirmed', 'partially_confirmed') then
    raise exception 'Confirm order #% first', o.order_number;
  end if;
  update orders
     set status = 'completed',
         delivered_at = coalesce(delivered_at, now()),
         delivery_status = case when customer_kind = 'wholesale' then 'delivered' else delivery_status end
   where id = p_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_order_payment (staff)
-- ---------------------------------------------------------------------------
create or replace function record_order_payment(p_order uuid, p_method payment_method, p_amount numeric, p_reference text default null)
returns payment_status
language plpgsql security invoker set search_path = public as $$
declare
  o orders%rowtype;
  v_paid numeric(10,2);
  v_status payment_status;
begin
  perform private.require_staff();
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be more than 0';
  end if;
  select * into o from orders where id = p_order for update;
  if o.id is null then
    raise exception 'Order not found';
  end if;
  if o.status in ('submitted', 'cancelled') then
    raise exception 'Confirm order #% before taking payment', o.order_number;
  end if;

  insert into payments (order_id, method, amount, received_by, reference)
  values (p_order, p_method, round(p_amount, 2), (select auth.uid()), nullif(trim(p_reference), ''));

  select coalesce(sum(amount), 0) into v_paid from payments where order_id = p_order;
  v_status := case when v_paid >= o.total then 'paid' when v_paid > 0 then 'partial' else 'unpaid' end;
  update orders set payment_status = v_status where id = p_order;
  return v_status;
end;
$$;

revoke execute on function confirm_order(uuid, jsonb), cancel_order(uuid, text), complete_order(uuid),
  record_order_payment(uuid, payment_method, numeric, text) from public, anon;
grant execute on function confirm_order(uuid, jsonb), cancel_order(uuid, text), complete_order(uuid),
  record_order_payment(uuid, payment_method, numeric, text) to authenticated;
