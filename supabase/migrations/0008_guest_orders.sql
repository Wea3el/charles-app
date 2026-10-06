-- Retail guest checkout: order with a name, phone and email, no account.
-- A guest is a retail customers row with no login (auth_user_id is null),
-- reused by email so repeat guests don't pile up. Wholesale still needs an
-- approved account.
-- place_order() and place_guest_order() share private.insert_order(), which
-- now also returns what the "order received" email needs (guests can't read
-- their order back).

create or replace function private.insert_order(p_customer uuid, p_order jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_client_id text := nullif(trim(p_order->>'client_id'), '');
  v_kind customer_kind;
  v_method payment_method;
  v_date date;
  v_set settings%rowtype;
  v_now timestamp;
  v_order orders%rowtype;
  v_line record;
  v_cust customers%rowtype;
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
  select * into v_cust from customers where id = p_customer;

  -- Already placed (double-click or resend): hand back the same order.
  select * into v_order from orders where client_id = v_client_id;
  if v_order.id is not null then
    if v_order.customer_id <> p_customer then
      raise exception 'Something went wrong. Place the order again.';
    end if;
    return private.order_summary(v_order.id);
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
    v_client_id, p_customer, v_kind, 'online', v_date, v_method,
    case when v_kind = 'retail' then (case when v_method = 'card' then 'card' else 'cash' end)::price_mode end,
    v_cust.default_discount_kind, v_cust.default_discount_value,
    nullif(left(trim(p_order->>'notes'), 1000), '')
  )
  on conflict (client_id) do nothing
  returning * into v_order;
  if v_order.id is null then
    -- Lost a race with the same order sent twice.
    select * into v_order from orders where client_id = v_client_id;
    return private.order_summary(v_order.id);
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
  return private.order_summary(v_order.id);
end;
$$;

-- {id, order_number, kind, fulfillment_date, total, email, lines: [{name, label, qty}]}
create or replace function private.order_summary(p_order uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'order_number', o.order_number, 'kind', o.customer_kind,
    'fulfillment_date', o.fulfillment_date, 'total', o.total, 'email', c.email,
    'lines', (select jsonb_agg(jsonb_build_object('name', l.product_name, 'label', l.option_label, 'qty', l.requested_qty)
                               order by l.requested_at, l.id)
              from order_lines l where l.order_id = o.id))
  from orders o join customers c on c.id = o.customer_id
  where o.id = p_order;
$$;

revoke execute on function private.insert_order(uuid, jsonb), private.order_summary(uuid) from public, anon, authenticated;

-- Signed-in customers.
create or replace function place_order(p_order jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_cust customers%rowtype;
begin
  select * into v_cust from customers where auth_user_id = (select auth.uid());
  if v_cust.id is null then
    raise exception 'Sign in with a customer account to order';
  end if;
  if v_cust.kind::text <> p_order->>'kind' then
    raise exception 'This is a % account. Order from the % shop.', v_cust.kind, v_cust.kind;
  end if;
  if v_cust.status = 'pending' then
    raise exception 'Your account is waiting for approval. We''ll email you once it''s approved.';
  end if;
  if v_cust.status <> 'approved' then
    raise exception 'This account can''t order online right now. Call the store.';
  end if;
  return private.insert_order(v_cust.id, p_order);
end;
$$;

-- Guests (retail only). p_guest: {"name": "…", "email": "…", "phone": "…", "age_21": true}
create or replace function place_guest_order(p_order jsonb, p_guest jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(trim(p_guest->>'name'), '');
  v_email text := lower(nullif(trim(p_guest->>'email'), ''));
  v_phone text := nullif(trim(p_guest->>'phone'), '');
  v_cust uuid;
begin
  if p_order->>'kind' is distinct from 'retail' then
    raise exception 'Wholesale orders need an approved business account';
  end if;
  if (select auth.uid()) is not null and exists (select 1 from customers where auth_user_id = (select auth.uid())) then
    raise exception 'You''re signed in. Your order goes on your account.';
  end if;
  if v_name is null or v_phone is null or v_email is null then
    raise exception 'Enter your name, phone and email';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Check your email address';
  end if;
  if (p_guest->>'age_21')::boolean is not true then
    raise exception 'You must be 21 or older to order';
  end if;

  -- One guest record per email; keep the latest name and phone.
  perform pg_advisory_xact_lock(hashtext('guest_customer'), hashtext(v_email));
  select id into v_cust from customers
  where auth_user_id is null and created_by_staff is null and kind = 'retail' and lower(email) = v_email
  order by created_at limit 1;
  if v_cust is null then
    insert into customers (kind, status, contact_name, email, phone)
    values ('retail', 'approved', left(v_name, 200), v_email, left(v_phone, 40))
    returning id into v_cust;
  else
    if (select status from customers where id = v_cust) <> 'approved' then
      raise exception 'Online ordering isn''t available for this email. Call the store.';
    end if;
    update customers set contact_name = left(v_name, 200), phone = left(v_phone, 40) where id = v_cust;
  end if;
  return private.insert_order(v_cust, p_order);
end;
$$;

revoke execute on function place_guest_order(jsonb, jsonb) from public;
grant execute on function place_guest_order(jsonb, jsonb) to anon, authenticated;
