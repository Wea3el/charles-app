-- Inventory operations. Each runs in one transaction, locks the rows it
-- changes, and writes a stock_movements row so every change has a history.
-- They run as the database owner (security definer) after checking the caller
-- is active staff, so the helper functions never need to be exposed.

-- The first person to sign in becomes the first manager (only while the
-- staff table is empty). Everyone after that is added by a manager.
create or replace function claim_first_manager(p_full_name text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;
  perform pg_advisory_xact_lock(hashtext('claim_first_manager'));
  if exists (select 1 from staff) then
    return false;
  end if;
  insert into staff (id, full_name, role, can_edit_prices)
  values ((select auth.uid()), coalesce(nullif(trim(p_full_name), ''), 'Manager'), 'manager', true);
  return true;
end;
$$;

create or replace function _require_staff() returns void
language plpgsql stable set search_path = public as $$
begin
  if not is_staff() then
    raise exception 'Only staff can change inventory';
  end if;
end;
$$;

create or replace function _add_stock(p_location uuid, p_product uuid, p_delta integer)
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

create or replace function _take_stock(p_location uuid, p_product uuid, p_qty integer)
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

-- Supplier delivery arrives: add to a location (cases for warehouse, singles for retail).
create or replace function inv_receive(p_product uuid, p_location uuid, p_qty integer, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_staff();
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be more than 0';
  end if;
  perform _add_stock(p_location, p_product, p_qty);
  insert into stock_movements (kind, product_id, to_location, quantity_in, staff_id, note)
  values ('receive', p_product, p_location, p_qty, (select auth.uid()), p_note);
end;
$$;

-- Move between two spots in the same catalog (e.g. Warehouse A -> Industrial Fridge 2).
create or replace function inv_move(p_product uuid, p_from uuid, p_to uuid, p_qty integer, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_from catalog_kind;
  v_to catalog_kind;
begin
  perform _require_staff();
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
  perform _take_stock(p_from, p_product, p_qty);
  perform _add_stock(p_to, p_product, p_qty);
  insert into stock_movements (kind, product_id, from_location, to_location, quantity_out, quantity_in, staff_id, note)
  values ('move', p_product, p_from, p_to, p_qty, p_qty, (select auth.uid()), p_note);
end;
$$;

-- Restock the front: cases leave a warehouse spot, singles land in a front fridge.
create or replace function inv_restock(p_product uuid, p_from uuid, p_to uuid, p_cases integer, p_note text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_from catalog_kind;
  v_to catalog_kind;
  v_case_size integer;
  v_singles integer;
begin
  perform _require_staff();
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
  perform _take_stock(p_from, p_product, p_cases);
  perform _add_stock(p_to, p_product, v_singles);
  insert into stock_movements (kind, product_id, from_location, to_location, quantity_out, quantity_in, staff_id, note)
  values ('restock', p_product, p_from, p_to, p_cases, v_singles, (select auth.uid()), p_note);
  return v_singles;
end;
$$;

-- Physical count: set the real number and log the difference.
create or replace function inv_count(p_product uuid, p_location uuid, p_counted integer, p_note text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_old integer;
begin
  perform _require_staff();
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

revoke execute on function claim_first_manager(text), _require_staff(), _add_stock(uuid, uuid, integer),
  _take_stock(uuid, uuid, integer), inv_receive(uuid, uuid, integer, text), inv_move(uuid, uuid, uuid, integer, text),
  inv_restock(uuid, uuid, uuid, integer, text), inv_count(uuid, uuid, integer, text), product_availability()
  from public, anon;
grant execute on function claim_first_manager(text), inv_receive(uuid, uuid, integer, text),
  inv_move(uuid, uuid, uuid, integer, text), inv_restock(uuid, uuid, uuid, integer, text),
  inv_count(uuid, uuid, integer, text), product_availability()
  to authenticated;
revoke execute on function _require_staff(), _add_stock(uuid, uuid, integer), _take_stock(uuid, uuid, integer)
  from authenticated;

-- Low-stock tab. Retail rows are in singles (restock from the warehouse);
-- warehouse rows are in cases (reorder from the supplier).
create or replace view low_stock with (security_invoker = true) as
with totals as (
  select
    p.id as product_id,
    p.name as product_name,
    p.case_size,
    t.catalog,
    t.min_qty,
    t.target_qty,
    coalesce(sum(s.quantity), 0)::integer as on_hand,
    string_agg(l.name || ': ' || s.quantity, ', ' order by l.sort_order, l.name)
      filter (where s.quantity > 0) as where_now
  from stock_thresholds t
  join products p on p.id = t.product_id and p.active
  left join locations l on l.catalog = t.catalog
  left join stock s on s.location_id = l.id and s.product_id = p.id
  group by p.id, p.name, p.case_size, t.catalog, t.min_qty, t.target_qty
),
warehouse as (
  select s.product_id, sum(s.quantity)::integer as cases
  from stock s join locations l on l.id = s.location_id and l.catalog = 'warehouse'
  group by s.product_id
)
select
  t.*,
  greatest(t.target_qty - t.on_hand, 0) as refill_qty,
  case when t.catalog = 'retail'
       then ceil(greatest(t.target_qty - t.on_hand, 0)::numeric / t.case_size)::integer
  end as cases_to_bring_front,
  coalesce(w.cases, 0) as warehouse_cases
from totals t
left join warehouse w on w.product_id = t.product_id
where t.on_hand < t.min_qty;
