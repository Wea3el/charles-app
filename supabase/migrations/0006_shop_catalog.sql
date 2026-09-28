-- Online shop catalog. Customers never read products or stock directly;
-- shop_catalog() returns only what the shop pages show.
-- Retail: anyone (the site asks for 21+ first); front-fridge stock, pack prices.
-- Wholesale: anyone sees products and In stock / Low / Out from the warehouse,
-- but case prices only show for approved wholesale accounts and staff.

create or replace function private.is_approved_wholesale() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from customers
    where auth_user_id = (select auth.uid()) and kind = 'wholesale' and status = 'approved'
  );
$$;
revoke execute on function private.is_approved_wholesale() from public, anon;
grant execute on function private.is_approved_wholesale() to authenticated;

create or replace function shop_catalog(p_kind customer_kind)
returns table (
  product_id       uuid,
  name             text,
  brand            text,
  category         text,
  case_size        integer,
  availability     text,     -- 'in_stock' | 'low' | 'out'
  prices_visible   boolean,
  case_price       numeric,  -- wholesale only
  party_case_price numeric,  -- wholesale only
  packs            jsonb     -- retail only: [{id, label, units, cash_price, card_price}]
)
language sql stable security definer set search_path = public as $$
  with cat as (
    select case when p_kind = 'wholesale' then 'warehouse'::catalog_kind else 'retail'::catalog_kind end as catalog
  ),
  viewer as (
    select p_kind = 'retail' or private.is_staff() or private.is_approved_wholesale() as sees_prices
  ),
  on_hand as (
    select s.product_id, sum(s.quantity) as qty
    from stock s
    join locations l on l.id = s.location_id
    join cat on l.catalog = cat.catalog
    group by s.product_id
  )
  select
    p.id, p.name, p.brand, p.category, p.case_size,
    case
      when coalesce(h.qty, 0) <= 0 then 'out'
      when coalesce(h.qty, 0) < coalesce(t.min_qty, 1) then 'low'
      else 'in_stock'
    end,
    v.sees_prices,
    case when p_kind = 'wholesale' and v.sees_prices then p.wholesale_case_price end,
    case when p_kind = 'wholesale' and v.sees_prices then p.party_case_price end,
    case when p_kind = 'retail' then (
      select jsonb_agg(jsonb_build_object('id', ps.id, 'label', ps.label, 'units', ps.units,
                                          'cash_price', ps.cash_price, 'card_price', ps.card_price)
                       order by ps.units)
      from pack_sizes ps where ps.product_id = p.id
    ) end
  from products p
  cross join cat
  cross join viewer v
  left join on_hand h on h.product_id = p.id
  left join stock_thresholds t on t.product_id = p.id and t.catalog = cat.catalog
  where p.active
    and case
          when p_kind = 'retail' then exists (select 1 from pack_sizes ps where ps.product_id = p.id)
          else p.wholesale_case_price is not null
        end
  order by p.category nulls last, p.name;
$$;

revoke execute on function shop_catalog(customer_kind) from public;
grant execute on function shop_catalog(customer_kind) to anon, authenticated;
