-- Pay online at checkout with Square's hosted checkout page.
-- The customer is charged the estimated total when they order. When staff
-- confirm short or cancel, the app refunds the difference through Square and
-- records it here as a negative payment. Wholesale card payments add the
-- settings.card_markup_percent card fee (retail already pays card prices).
-- Online payments are written only by the server (service role) after it has
-- checked them with Square, never by the browser.

alter table orders
  add column pay_online             boolean not null default false,
  add column card_fee_percent       numeric(5,2),       -- snapshot of the fee rate, wholesale online only
  add column card_fee               numeric(10,2) not null default 0,
  add column square_order_id        text unique,        -- the Square order behind the payment link
  add column square_payment_link_id text,
  add column square_payment_link_url text,
  add column square_payment_link_amount numeric(10,2); -- a link is for one amount; a new total gets a new link

alter table payments
  add column square_payment_id text unique,           -- online card payment
  add column square_refund_id  text unique;           -- refunds are negative amounts

-- Totals now include the card fee: fee = rate x (subtotal - discount - empties).
create or replace function private.refresh_order_totals(p_order uuid) returns void
language plpgsql set search_path = public as $$
declare
  v_sub numeric(10,2);
  v_disc numeric(10,2);
  v_base numeric(10,2);
  v_fee numeric(10,2);
  o record;
begin
  select discount_kind, discount_value, empties_credit, pay_online, card_fee_percent into o from orders where id = p_order;
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
  v_base := greatest(v_sub - v_disc - o.empties_credit, 0);
  v_fee := case when o.pay_online and o.card_fee_percent > 0 then round(v_base * o.card_fee_percent / 100, 2) else 0 end;
  update orders
     set subtotal = v_sub,
         discount_amount = v_disc,
         card_fee = v_fee,
         total = v_base + v_fee
   where id = p_order;
end;
$$;

-- Same as before, plus "pay_online": true (card only; wholesale gets the card fee rate).
create or replace function private.insert_order(p_customer uuid, p_order jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_client_id text := nullif(trim(p_order->>'client_id'), '');
  v_kind customer_kind;
  v_method payment_method;
  v_date date;
  v_online boolean := coalesce((p_order->>'pay_online')::boolean, false);
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
  if v_online and v_method <> 'card' then
    raise exception 'Online payment is by card';
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
    discount_kind, discount_value, notes, pay_online, card_fee_percent
  ) values (
    v_client_id, p_customer, v_kind, 'online', v_date, v_method,
    case when v_kind = 'retail' then (case when v_method = 'card' then 'card' else 'cash' end)::price_mode end,
    v_cust.default_discount_kind, v_cust.default_discount_value,
    nullif(left(trim(p_order->>'notes'), 1000), ''),
    v_online,
    case when v_online and v_kind = 'wholesale' then v_set.card_markup_percent end
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

-- The summary now says whether to send the customer to pay.
create or replace function private.order_summary(p_order uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'order_number', o.order_number, 'kind', o.customer_kind,
    'fulfillment_date', o.fulfillment_date, 'total', o.total, 'card_fee', o.card_fee, 'email', c.email,
    'pay_online', o.pay_online, 'payment_status', o.payment_status,
    'lines', (select jsonb_agg(jsonb_build_object('name', l.product_name, 'label', l.option_label, 'qty', l.requested_qty)
                               order by l.requested_at, l.id)
              from order_lines l where l.order_id = o.id))
  from orders o join customers c on c.id = o.customer_id
  where o.id = p_order;
$$;
revoke execute on function private.insert_order(uuid, jsonb), private.order_summary(uuid) from public, anon, authenticated;

-- The shop shows the wholesale card fee at checkout.
drop function shop_settings();
create function shop_settings()
returns table (same_day_cutoff time, order_days_ahead integer, timezone text, card_fee_percent numeric)
language sql stable security definer set search_path = public as $$
  select same_day_cutoff, order_days_ahead, timezone, coalesce(card_markup_percent, 0) from settings;
$$;
revoke execute on function shop_settings() from public;
grant execute on function shop_settings() to anon, authenticated;

-- payment_status from the net of payments and refunds.
create or replace function private.refresh_payment_status(p_order uuid) returns payment_status
language plpgsql set search_path = public as $$
declare
  v_paid numeric(10,2);
  v_total numeric(10,2);
  v_status payment_status;
begin
  select coalesce(sum(amount), 0) into v_paid from payments where order_id = p_order;
  select total into v_total from orders where id = p_order;
  v_status := case when v_paid > 0 and v_paid >= v_total then 'paid' when v_paid > 0 then 'partial' else 'unpaid' end;
  update orders set payment_status = v_status where id = p_order;
  return v_status;
end;
$$;
revoke execute on function private.refresh_payment_status(uuid) from public, anon;
grant execute on function private.refresh_payment_status(uuid) to authenticated;

-- Server only (service role), after checking the payment with Square.
-- Recording the same Square payment twice does nothing.
create or replace function record_online_payment(p_order uuid, p_square_payment_id text, p_amount numeric)
returns payment_status
language plpgsql security definer set search_path = public as $$
begin
  if nullif(trim(p_square_payment_id), '') is null or p_amount is null or p_amount <= 0 then
    raise exception 'Payment is missing its id or amount';
  end if;
  perform 1 from orders where id = p_order for update;
  if not found then
    raise exception 'Order not found';
  end if;
  insert into payments (order_id, method, amount, reference, square_payment_id)
  values (p_order, 'card', round(p_amount, 2), 'Paid online (Square)', p_square_payment_id)
  on conflict (square_payment_id) do nothing;
  return private.refresh_payment_status(p_order);
end;
$$;
revoke execute on function record_online_payment(uuid, text, numeric) from public, anon, authenticated;
grant execute on function record_online_payment(uuid, text, numeric) to service_role;

-- Staff, after Square has accepted the refund.
create or replace function record_order_refund(p_order uuid, p_amount numeric, p_square_refund_id text, p_reason text)
returns payment_status
language plpgsql security invoker set search_path = public as $$
begin
  perform private.require_staff();
  if p_amount is null or p_amount <= 0 then
    raise exception 'Refund must be more than 0';
  end if;
  perform 1 from orders where id = p_order for update;
  if not found then
    raise exception 'Order not found';
  end if;
  insert into payments (order_id, method, amount, received_by, reference, square_refund_id)
  values (p_order, 'card', -round(p_amount, 2), (select auth.uid()), left(coalesce(nullif(trim(p_reason), ''), 'Refund'), 200), p_square_refund_id)
  on conflict (square_refund_id) do nothing;
  return private.refresh_payment_status(p_order);
end;
$$;
revoke execute on function record_order_refund(uuid, numeric, text, text) from public, anon;
grant execute on function record_order_refund(uuid, numeric, text, text) to authenticated;

-- record_order_payment now also counts refunds when working out the status.
create or replace function record_order_payment(p_order uuid, p_method payment_method, p_amount numeric, p_reference text default null)
returns payment_status
language plpgsql security invoker set search_path = public as $$
declare
  o orders%rowtype;
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
  return private.refresh_payment_status(p_order);
end;
$$;

-- Cancelling is allowed once any money taken has been refunded.
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
  if (select coalesce(sum(amount), 0) from payments where order_id = p_order) <> 0 then
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
