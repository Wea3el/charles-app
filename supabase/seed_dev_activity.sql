-- More test data for the DEV project only (charles-app-dev). Never run on production.
-- Run after seed_dev.sql. Adds a fuller catalog (beer, seltzer, kegs, wine,
-- liquor, mixers), two weeks of register sales, more business customers and
-- online orders in every state. Safe to run again: products, logins, sales and
-- orders use fixed ids, and the sales block only runs the first time.
--
-- Extra logins (password charles-test-123):
--   luckys@example.com   Lucky's Liquor Mart, approved
--   harbor@example.com   Harbor Tavern, approved, 5% standing discount
--   sunset@example.com   Sunset Lounge, waiting for approval

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
-- kind decides the retail packs: beer = Single / 6 / 12 / full case,
-- four = Single / 4 pack / full case, bottle = Bottle / Case, each = Each,
-- none = wholesale only (kegs).
create temporary table seed_products (
  n int, name text, brand text, category text, case_size int, cost numeric, wholesale numeric, party numeric,
  single numeric, wh_stock int, front_stock int, kind text
) on commit drop;

insert into seed_products values
  ( 7, 'Heineken 12oz',                   'Heineken',      'beer',    24,  21.00,  27.50,  31.00,  2.50, 25,  60, 'beer'),
  ( 8, 'Stella Artois 11.2oz',            'Stella Artois', 'beer',    24,  23.00,  29.99,  33.00,  2.75, 18,  36, 'beer'),
  ( 9, 'Michelob Ultra 12oz',             'Michelob',      'beer',    24,  19.00,  25.50,  28.50,  2.25, 22,  48, 'beer'),
  (10, 'Coors Light 12oz',                'Coors',         'beer',    30,  20.00,  26.00,  29.00,  1.95, 15,  40, 'beer'),
  (11, 'Blue Moon Belgian White 12oz',    'Blue Moon',     'beer',    24,  24.00,  31.00,  34.00,  2.75,  8,  20, 'beer'),
  (12, 'Pacifico Clara 12oz',             'Pacifico',      'beer',    24,  22.00,  28.50,  32.00,  2.50, 12,  30, 'beer'),
  (13, 'Yuengling Lager 12oz',            'Yuengling',     'beer',    24,  18.50,  24.50,  27.50,  2.00, 20,  42, 'beer'),
  (14, 'Guinness Draught 14.9oz',         'Guinness',      'beer',    24,  30.00,  38.00,  42.00,  3.25,  6,  16, 'four'),
  (15, 'Truly Hard Seltzer Variety 12oz', 'Truly',         'seltzer', 24,  22.00,  28.00,  31.00,  2.50, 10,  24, 'beer'),
  (16, 'High Noon Variety 12oz',          'High Noon',     'seltzer', 24,  38.00,  46.00,  50.00,  3.75,  0,   0, 'four'),
  (17, 'Bud Light 1/2 barrel keg',        'Bud Light',     'keg',      1, 120.00, 165.00, 175.00,  null,  6,   0, 'none'),
  (18, 'Blue Moon 1/6 barrel keg',        'Blue Moon',     'keg',      1,  70.00,  95.00, 105.00,  null,  2,   0, 'none'),
  (19, 'Barefoot Pinot Grigio 750ml',     'Barefoot',      'wine',    12,  54.00,  72.00,  78.00,  8.99, 10,  18, 'bottle'),
  (20, 'Josh Cellars Cabernet 750ml',     'Josh Cellars',  'wine',    12, 110.00, 138.00, 150.00, 15.99,  6,  12, 'bottle'),
  (21, 'Sutter Home Chardonnay 187ml',    'Sutter Home',   'wine',    24,  28.00,  38.00,  42.00,  2.25,  5,  24, 'four'),
  (22, 'Tito''s Handmade Vodka 750ml',    'Tito''s',       'liquor',  12, 205.00, 240.00, 260.00, 24.99,  8,  10, 'bottle'),
  (23, 'Jack Daniel''s Old No. 7 750ml',  'Jack Daniel''s','liquor',  12, 230.00, 270.00, 290.00, 27.99,  6,   8, 'bottle'),
  (24, 'Bacardi Superior Rum 1.75L',      'Bacardi',       'liquor',   6, 120.00, 145.00, 155.00, 29.99,  4,   6, 'bottle'),
  (25, 'Hennessy VS Cognac 750ml',        'Hennessy',      'liquor',  12, 420.00, 480.00, 510.00, 44.99,  3,   4, 'bottle'),
  (26, 'Jose Cuervo Especial Gold 1L',    'Jose Cuervo',   'liquor',  12, 200.00, 240.00, 255.00, 24.99,  5,   9, 'bottle'),
  (27, 'Fireball Cinnamon Whisky 50ml',   'Fireball',      'liquor', 120,  95.00, 125.00, 135.00,  1.49,  4, 100, 'bottle'),
  (28, 'Smirnoff No. 21 Vodka 1.75L',     'Smirnoff',      'liquor',   6,  95.00, 115.00, 125.00, 23.99,  0,   0, 'bottle'),
  (29, 'Red Bull 8.4oz',                  'Red Bull',      'mixer',   24,  32.00,  40.00,  44.00,  3.29, 10,  48, 'four'),
  (30, 'Schweppes Tonic Water 1L',        'Schweppes',     'mixer',   12,  12.00,  16.00,  18.00,  2.49,  6,  15, 'bottle'),
  (31, 'Ice 20 lb bag',                   null,            'ice',      1,   2.40,   4.50,   5.00,  5.99, 30,  10, 'each'),
  (32, 'Party cups 16oz, 50 count',       'Solo',          'party',   12,  24.00,  36.00,  40.00,  4.99,  5,  12, 'each');

-- Ids follow seed_dev.sql: a0000000-0000-4000-8000-0000000000NN
insert into products (id, name, brand, category, case_size, cost_per_case, wholesale_case_price, party_case_price)
select ('a0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, name, brand, category, case_size, cost, wholesale, party
from seed_products
on conflict (id) do nothing;

insert into pack_sizes (product_id, label, units, cash_price, card_price, barcode, sort_order)
select ('a0000000-0000-4000-8000-' || lpad(p.n::text, 12, '0'))::uuid,
       k.label, k.units,
       case when k.units = 1 then p.single else ceil(p.single * k.factor) - 0.01 end,
       round((case when k.units = 1 then p.single else ceil(p.single * k.factor) - 0.01 end) * 1.05, 2),
       case when k.units in (1, p.case_size) then 'TEST-' || p.n || '-' || k.units end,
       k.units
from seed_products p
cross join lateral (values
  ('Single',  1, 1.0, array['beer', 'four']),
  ('Bottle',  1, 1.0, array['bottle']),
  ('Each',    1, 1.0, array['each']),
  ('4 pack',  4, 3.8, array['four']),
  ('6 pack',  6, 5.2, array['beer']),
  ('12 pack', 12, 9.6, array['beer']),
  (case when p.case_size = 30 then '30 rack' when p.kind = 'bottle' then 'Case of ' || p.case_size else p.case_size || ' case' end,
   p.case_size, p.case_size * case when p.kind = 'bottle' then 0.9 else 0.8 end, array['beer', 'four', 'bottle'])
) as k(label, units, factor, kinds)
where p.kind = any (k.kinds)
  and not (k.label = '12 pack' and p.case_size <= 12)
on conflict do nothing;  -- (product, units) is unique, so a case that equals a pack size is skipped

-- Warehouse stock in cases: cold things in the industrial fridges, the rest in the warehouse.
insert into stock (location_id, product_id, quantity)
select l.id, ('a0000000-0000-4000-8000-' || lpad(p.n::text, 12, '0'))::uuid, p.wh_stock
from seed_products p
join locations l on l.name = case
  when p.category in ('beer', 'seltzer', 'keg', 'mixer', 'ice') then 'Industrial Fridge ' || (p.n % 2 + 1)
  else 'Warehouse ' || case when p.n % 2 = 0 then 'A' else 'B' end
end
where p.wh_stock > 0
on conflict (location_id, product_id) do nothing;

insert into stock_thresholds (product_id, catalog, min_qty, target_qty)
select ('a0000000-0000-4000-8000-' || lpad(p.n::text, 12, '0'))::uuid, t.catalog, t.min_qty, t.target_qty
from seed_products p
cross join lateral (values
  ('retail'::catalog_kind,    case p.kind when 'bottle' then 6 when 'each' then 8 else 24 end,
                              case p.kind when 'bottle' then 18 when 'each' then 24 else 72 end),
  ('warehouse'::catalog_kind, case when p.kind in ('bottle', 'none') then 3 else 10 end,
                              case when p.kind in ('bottle', 'none') then 12 else 40 end)
) as t(catalog, min_qty, target_qty)
where not (p.kind = 'none' and t.catalog = 'retail')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- More business logins
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('charles-test-123', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', u.meta, now() - interval '20 days', now(),
       '', '', '', '', '', '', '', ''
from (values
  ('44444444-4444-4444-8444-444444444444'::uuid, 'luckys@example.com',
   '{"customer_kind":"wholesale","business_name":"Lucky''s Liquor Mart","contact_name":"Lou Lucky","phone":"555-0200",
     "address_line":"22 Oak Ave","city":"Springfield","state":"NJ","postal_code":"07081",
     "liquor_license_no":"TEST-LIC-002","license_expires_on":"2027-06-30","tax_id":"22-2222222"}'::jsonb),
  ('55555555-5555-4555-8555-555555555555'::uuid, 'harbor@example.com',
   '{"customer_kind":"wholesale","business_name":"Harbor Tavern","contact_name":"Hank Harbor","phone":"555-0300",
     "address_line":"9 Dock St","city":"Union","state":"NJ","postal_code":"07083",
     "liquor_license_no":"TEST-LIC-003","license_expires_on":"2027-03-31","tax_id":"33-3333333"}'::jsonb),
  ('66666666-6666-4666-8666-666666666666'::uuid, 'sunset@example.com',
   '{"customer_kind":"wholesale","business_name":"Sunset Lounge","contact_name":"Sue Sunset","phone":"555-0400",
     "address_line":"500 Shore Rd","city":"Cranford","state":"NJ","postal_code":"07016",
     "liquor_license_no":"TEST-LIC-004","license_expires_on":"2026-12-31","tax_id":"44-4444444"}'::jsonb)
) as u(id, email, meta)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select u.id, u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
from auth.users u
where u.id in ('44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666')
on conflict do nothing;

update customers set status = 'approved', approved_by = '11111111-1111-4111-8111-111111111111', approved_at = now()
 where auth_user_id = '44444444-4444-4444-8444-444444444444' and status = 'pending';
update customers set status = 'approved', approved_by = '11111111-1111-4111-8111-111111111111', approved_at = now(),
       default_discount_kind = 'percent', default_discount_value = 5
 where auth_user_id = '55555555-5555-4555-8555-555555555555' and status = 'pending';
-- Sunset Lounge stays pending, so there's an application to approve.

-- ---------------------------------------------------------------------------
-- Two weeks of register sales (first run only)
-- ---------------------------------------------------------------------------
do $seed$
declare
  v_staff uuid := '11111111-1111-4111-8111-111111111111';
  v_tz text := (select timezone from settings);
  v_today date := (now() at time zone (select timezone from settings))::date;
  v_day int;
  v_i int;
  v_count int;
  v_lines jsonb;
  v_sub bigint;
  v_cash boolean;
  v_at timestamptz;
  v_pick record;
  v_qty int;
  v_price bigint;
begin
  if exists (select 1 from sales where client_id like 'seed-sale-%') then
    raise notice 'Seed sales already there; skipping.';
    return;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);
  perform setseed(0.2026);

  -- Front-fridge targets: what each fridge should hold once the sales are in.
  create temporary table front_target on commit drop as
  select ('a0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid as product_id, front_stock as qty
  from seed_products where kind <> 'none'
  union all
  select s.product_id, s.quantity from stock s join locations l on l.id = s.location_id
  where l.catalog = 'retail'
    and s.product_id in (select ('a0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid from generate_series(1, 6) n);

  -- Plenty up front while ringing up, so no fridge goes negative.
  insert into stock (location_id, product_id, quantity)
  select coalesce(
           (select s.location_id from stock s join locations l on l.id = s.location_id
             where l.catalog = 'retail' and s.product_id = t.product_id limit 1),
           (select id from locations where name = 'Front Fridge ' || (abs(hashtext(t.product_id::text)) % 4 + 1))),
         t.product_id, 1000
  from front_target t
  on conflict (location_id, product_id) do update set quantity = 1000;

  for v_day in 0..13 loop
    v_count := 8 + floor(random() * 12)::int;
    for v_i in 1..v_count loop
      v_at := ((v_today - v_day) + time '10:00' + random() * interval '12 hours') at time zone v_tz;
      continue when v_at > now();
      v_cash := random() < 0.65;
      v_lines := '[]';
      v_sub := 0;
      for v_pick in
        select ps.id, ps.cash_price, ps.card_price
        from pack_sizes ps join front_target t on t.product_id = ps.product_id
        where t.qty > 0 and ps.units <= 12
        order by random() limit 1 + floor(random() * 4)::int
      loop
        v_qty := case when random() < 0.8 then 1 else 2 end;
        v_price := round((case when v_cash then v_pick.cash_price else v_pick.card_price end) * 100);
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'pack_size_id', v_pick.id, 'quantity', v_qty, 'unit_price_cents', v_price, 'discount_cents', 0));
        v_sub := v_sub + v_price * v_qty;
      end loop;
      perform record_sale(jsonb_build_object(
        'client_id', 'seed-sale-' || v_day || '-' || v_i,
        'price_mode', case when v_cash then 'cash' else 'card' end,
        'sold_at', v_at,
        'recorded_offline', random() < 0.05,
        'subtotal_cents', v_sub, 'discount_cents', 0, 'total_cents', v_sub,
        'cash_tendered_cents', case when v_cash then ceil(v_sub / 500.0)::bigint * 500 end,
        'lines', v_lines));
    end loop;
  end loop;

  -- Two voids, so the sales page shows some.
  perform void_sale(id, 'Rang up twice') from sales where client_id = 'seed-sale-3-1';
  perform void_sale(id, 'Customer changed their mind') from sales where client_id = 'seed-sale-6-2';

  -- Settle the fridges at their targets.
  update stock s set quantity = t.qty, updated_at = now()
  from front_target t, locations l
  where s.product_id = t.product_id and l.id = s.location_id and l.catalog = 'retail';
end;
$seed$;

-- ---------------------------------------------------------------------------
-- Online orders in every state
-- ---------------------------------------------------------------------------
do $seed$
declare
  v_staff jsonb := json_build_object('sub', '11111111-1111-4111-8111-111111111111', 'role', 'authenticated');
  v_today date := (now() at time zone (select timezone from settings))::date;
  v_id uuid;
  p text := 'a0000000-0000-4000-8000-';
begin
  -- Each order is placed as its customer (or as a guest), then staff confirm,
  -- take payment, deliver or cancel it to reach the outcome.
  -- Lines are [product number, cases] for wholesale, [product number, pack units, packs] for retail.
  create temporary table seed_orders (
    client_id text, login uuid, kind text, day_offset int, pay text, lines jsonb, guest jsonb, outcome text
  ) on commit drop;
  insert into seed_orders values
    -- New, waiting for staff: Modelo is short in the warehouse and White Claw is out.
    ('seed-order-1', '22222222-2222-4222-8222-222222222222', 'wholesale', 1, 'invoice',
     '[[1,10],[2,6],[4,3],[17,1]]', null, 'new'),
    ('seed-order-4', '33333333-3333-4333-8333-333333333333', 'retail', 1, 'card',
     '[[1,6,2],[22,1,1]]', null, 'new'),
    ('seed-order-5', null, 'retail', 2, 'cash',
     '[[2,12,1],[31,1,2]]', '{"name":"Gina Guest","email":"gina.guest@example.com","phone":"555-0500","age_21":true}', 'new'),
    -- Confirmed in full, part paid by check.
    ('seed-order-2', '44444444-4444-4444-8444-444444444444', 'wholesale', 2, 'check',
     '[[7,5],[22,2],[23,1],[27,1]]', null, 'confirmed'),
    -- Confirmed, paid in cash and delivered.
    ('seed-order-3', '55555555-5555-4555-8555-555555555555', 'wholesale', 1, 'cash',
     '[[3,8],[8,4],[31,10]]', null, 'done'),
    -- Confirmed, then cancelled (stock went back).
    ('seed-order-6', '55555555-5555-4555-8555-555555555555', 'wholesale', 3, 'zelle',
     '[[11,3],[14,2]]', null, 'cancelled'),
    -- Hennessy only partly there, Smirnoff out: part filled.
    ('seed-order-7', '44444444-4444-4444-8444-444444444444', 'wholesale', 1, 'invoice',
     '[[25,5],[28,2]]', null, 'short');

  declare
    o record;
    v_lines jsonb;
    v_order jsonb;
    v_status text;
    v_total numeric;
  begin
    for o in select * from seed_orders loop
      -- Lines into place_order() shape.
      select jsonb_agg(jsonb_build_object(
               'option_id', case when o.kind = 'wholesale'
                                 then (p || lpad((l->>0), 12, '0'))
                                 else (select ps.id::text from pack_sizes ps
                                        where ps.product_id = (p || lpad((l->>0), 12, '0'))::uuid
                                          and ps.units = (l->>1)::int) end,
               'quantity', case when o.kind = 'wholesale' then (l->>1)::int else (l->>2)::int end))
        into v_lines
        from jsonb_array_elements(o.lines) l;

      perform set_config('request.jwt.claims',
        case when o.login is null then '{"role":"anon"}' else json_build_object('sub', o.login, 'role', 'authenticated')::text end, true);
      v_order := jsonb_build_object('client_id', o.client_id, 'kind', o.kind,
        'fulfillment_date', v_today + o.day_offset, 'payment_method', o.pay, 'lines', v_lines,
        'notes', case when o.client_id = 'seed-order-1' then 'Please deliver before 4 PM, back door.' end);
      v_order := case when o.guest is null then place_order(v_order) else place_guest_order(v_order, o.guest) end;
      v_id := (v_order->>'id')::uuid;

      select status into v_status from orders where id = v_id;
      continue when o.outcome = 'new' or v_status <> 'submitted';

      perform set_config('request.jwt.claims', v_staff::text, true);
      perform confirm_order(v_id, (
        select jsonb_agg(jsonb_build_object('id', ol.id, 'quantity',
                 case when o.outcome <> 'short' then ol.requested_qty
                      when ol.product_name like 'Hennessy%' then 3
                      else 0 end))
        from order_lines ol where ol.order_id = v_id));
      select total into v_total from orders where id = v_id;

      if o.outcome = 'confirmed' then
        perform record_order_payment(v_id, 'check', round(v_total / 2, 2), 'Check #1042');
      elsif o.outcome = 'done' then
        perform record_order_payment(v_id, 'cash', v_total);
        perform complete_order(v_id);
      elsif o.outcome = 'cancelled' then
        perform cancel_order(v_id, 'Customer called to cancel');
      end if;
    end loop;
  end;
end;
$seed$;

select
  (select count(*) from products) as products,
  (select count(*) from pack_sizes) as pack_sizes,
  (select count(*) from sales) as sales,
  (select count(*) from sales where voided_at is not null) as voided,
  (select sum(total) from sales where voided_at is null) as sales_total,
  (select jsonb_object_agg(status, n) from (select status, count(*) n from orders group by 1) x) as orders,
  (select jsonb_object_agg(status, n) from (select status, count(*) n from customers group by 1) x) as customers;
