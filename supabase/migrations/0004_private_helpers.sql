-- Keep internal helpers out of the public API.
-- Access-check helpers and stock helpers live in a `private` schema that
-- PostgREST does not expose. Policies keep working (they reference the
-- functions by id, not by name).

create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.is_staff()        set schema private;
alter function public.is_manager()      set schema private;
alter function public.is_price_editor() set schema private;
alter function public.my_customer_id()  set schema private;

drop function public._require_staff();
drop function public._add_stock(uuid, uuid, integer);
drop function public._take_stock(uuid, uuid, integer);

create or replace function private.require_staff() returns void
language plpgsql stable set search_path = public as $$
begin
  if not private.is_staff() then
    raise exception 'Only staff can change inventory';
  end if;
end;
$$;

create or replace function private.add_stock(p_location uuid, p_product uuid, p_delta integer)
returns integer
language plpgsql set search_path = public as $$
declare
  v_qty integer;
begin
  insert into stock (location_id, product_id, quantity)
  values (p_location, p_product, p_delta)
  on conflict (location_id, product_id)
  do update set quantity = stock.quantity + excluded.quantity, updated_at = now()
  returning quantity into v_qty;
  return v_qty;
end;
$$;

create or replace function private.take_stock(p_location uuid, p_product uuid, p_qty integer)
returns integer
language plpgsql set search_path = public as $$
declare
  v_have integer;
  v_name text;
begin
  select quantity into v_have from stock
  where location_id = p_location and product_id = p_product
  for update;
  if coalesce(v_have, 0) < p_qty then
    select name into v_name from locations where id = p_location;
    raise exception 'Only % in %', coalesce(v_have, 0), v_name;
  end if;
  update stock set quantity = quantity - p_qty, updated_at = now()
  where location_id = p_location and product_id = p_product
  returning quantity into v_have;
  return v_have;
end;
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- Inventory operations now run with the caller's rights: row level security
-- (staff only) applies to every table they touch.
create or replace function inv_receive(p_product uuid, p_location uuid, p_qty integer, p_note text default null)
returns void
language plpgsql security invoker set search_path = public as $$
begin
  perform private.require_staff();
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be more than 0';
  end if;
  perform private.add_stock(p_location, p_product, p_qty);
  insert into stock_movements (kind, product_id, to_location, quantity_in, staff_id, note)
  values ('receive', p_product, p_location, p_qty, (select auth.uid()), p_note);
end;
$$;

create or replace function inv_move(p_product uuid, p_from uuid, p_to uuid, p_qty integer, p_note text default null)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_from catalog_kind;
  v_to catalog_kind;
begin
  perform private.require_staff();
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be more than 0';
  end if;
  if p_from = p_to then
    raise exception 'Pick two different spots';
  end if;
  select catalog into v_from from locations where id = p_from;
  select catalog into v_to from locations where id = p_to;
  if v_from is distinct from v_to then
    raise exception 'Use Restock to move stock from the warehouse to the front fridges';
  end if;
  perform private.take_stock(p_from, p_product, p_qty);
  perform private.add_stock(p_to, p_product, p_qty);
  insert into stock_movements (kind, product_id, from_location, to_location, quantity_out, quantity_in, staff_id, note)
  values ('move', p_product, p_from, p_to, p_qty, p_qty, (select auth.uid()), p_note);
end;
$$;

create or replace function inv_restock(p_product uuid, p_from uuid, p_to uuid, p_cases integer, p_note text default null)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_from catalog_kind;
  v_to catalog_kind;
  v_case_size integer;
  v_singles integer;
begin
  perform private.require_staff();
  if p_cases is null or p_cases <= 0 then
    raise exception 'Cases must be more than 0';
  end if;
  select catalog into v_from from locations where id = p_from;
  select catalog into v_to from locations where id = p_to;
  if v_from is distinct from 'warehouse' or v_to is distinct from 'retail' then
    raise exception 'Restock goes from a warehouse spot to a front fridge';
  end if;
  select case_size into v_case_size from products where id = p_product;
  v_singles := p_cases * v_case_size;
  perform private.take_stock(p_from, p_product, p_cases);
  perform private.add_stock(p_to, p_product, v_singles);
  insert into stock_movements (kind, product_id, from_location, to_location, quantity_out, quantity_in, staff_id, note)
  values ('restock', p_product, p_from, p_to, p_cases, v_singles, (select auth.uid()), p_note);
  return v_singles;
end;
$$;

create or replace function inv_count(p_product uuid, p_location uuid, p_counted integer, p_note text default null)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_old integer;
begin
  perform private.require_staff();
  if p_counted is null or p_counted < 0 then
    raise exception 'Count cannot be negative';
  end if;
  select quantity into v_old from stock
  where location_id = p_location and product_id = p_product for update;
  insert into stock (location_id, product_id, quantity)
  values (p_location, p_product, p_counted)
  on conflict (location_id, product_id)
  do update set quantity = excluded.quantity, updated_at = now();
  insert into stock_movements (kind, product_id, to_location, quantity_out, quantity_in, staff_id, note)
  values ('count', p_product, p_location, coalesce(v_old, 0), p_counted, (select auth.uid()), p_note);
  return p_counted - coalesce(v_old, 0);
end;
$$;

-- product_availability() reads stock on behalf of customers, so it stays
-- security definer; it only ever returns in_stock / low / out.
create or replace function product_availability()
returns table (product_id uuid, catalog catalog_kind, availability text)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    c.catalog,
    case
      when coalesce(sum(s.quantity), 0) <= 0 then 'out'
      when coalesce(sum(s.quantity), 0) < coalesce(max(t.min_qty), 1) then 'low'
      else 'in_stock'
    end
  from products p
  cross join (values ('retail'::catalog_kind), ('warehouse'::catalog_kind)) c(catalog)
  left join locations l on l.catalog = c.catalog
  left join stock s on s.location_id = l.id and s.product_id = p.id
  left join stock_thresholds t on t.product_id = p.id and t.catalog = c.catalog
  where p.active and (private.my_customer_id() is not null or private.is_staff())
  group by p.id, c.catalog;
$$;

-- Indexes for foreign keys used in lookups.
create index if not exists customer_documents_customer_id_idx on customer_documents (customer_id);
create index if not exists product_barcodes_product_id_idx on product_barcodes (product_id);
create index if not exists order_lines_product_id_idx on order_lines (product_id);
create index if not exists orders_trip_id_idx on orders (trip_id);
create index if not exists payments_order_id_idx on payments (order_id);
create index if not exists sale_lines_sale_id_idx on sale_lines (sale_id);
create index if not exists sale_lines_product_id_idx on sale_lines (product_id);
create index if not exists stock_movements_to_location_idx on stock_movements (to_location);
create index if not exists stock_movements_from_location_idx on stock_movements (from_location);
