-- Test data for the DEV project only (charles-app-dev). Never run on production.
-- Safe to run again: everything uses fixed ids and skips what already exists.
--
-- Logins (password for all: charles-test-123). Full list: docs/test-accounts.csv
--   dev@example.com        developer account, store app manager with price editing (/login)
--   staff@example.com      store app manager (/login)
--   wholesale@example.com  approved business, 10% standing discount (/shop/signin)
--   retail@example.com     retail customer (/shop/signin)

-- ---------------------------------------------------------------------------
-- Logins
-- ---------------------------------------------------------------------------
-- The customers rows come from the sign-up trigger (customer_kind metadata).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('charles-test-123', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', u.meta, now(), now(),
       '', '', '', '', '', '', '', ''
from (values
  ('11111111-1111-4111-8111-111111111111'::uuid, 'staff@example.com', '{}'::jsonb),
  ('77777777-7777-4777-8777-777777777777'::uuid, 'dev@example.com', '{}'::jsonb),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'wholesale@example.com',
   '{"customer_kind":"wholesale","business_name":"Test Bar & Grill","contact_name":"Wanda Wholesale","phone":"555-0100",
     "address_line":"100 Main St","city":"Springfield","state":"NJ","postal_code":"07081",
     "liquor_license_no":"TEST-LIC-001","license_expires_on":"2027-12-31","tax_id":"12-3456789"}'::jsonb),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'retail@example.com',
   '{"customer_kind":"retail","contact_name":"Ray Retail","phone":"555-0101"}'::jsonb)
) as u(id, email, meta)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select u.id, u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
from auth.users u
where u.id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
               '77777777-7777-4777-8777-777777777777')
on conflict do nothing;

insert into staff (id, full_name, role, can_edit_prices)
values ('11111111-1111-4111-8111-111111111111', 'Sam Staff', 'manager', true),
       ('77777777-7777-4777-8777-777777777777', 'Dev Account', 'manager', true)
on conflict (id) do nothing;

update customers
   set status = 'approved', approved_by = '11111111-1111-4111-8111-111111111111', approved_at = now(),
       default_discount_kind = 'percent', default_discount_value = 10
 where auth_user_id = '22222222-2222-4222-8222-222222222222' and status = 'pending';

-- ---------------------------------------------------------------------------
-- Catalog: in stock, low, and out, so partial fills and declines can be tried.
-- ---------------------------------------------------------------------------
insert into products (id, name, brand, category, case_size, cost_per_case, wholesale_case_price, party_case_price) values
  ('a0000000-0000-4000-8000-000000000001', 'Corona Extra 12oz',       'Corona',     'beer',    24, 22.00, 28.50, 32.00),
  ('a0000000-0000-4000-8000-000000000002', 'Modelo Especial 12oz',    'Modelo',     'beer',    24, 23.00, 29.50, 33.00),
  ('a0000000-0000-4000-8000-000000000003', 'Bud Light 12oz',          'Bud Light',  'beer',    24, 18.00, 24.00, 27.00),
  ('a0000000-0000-4000-8000-000000000004', 'White Claw Variety 12oz', 'White Claw', 'seltzer', 12, 16.00, 21.00, 23.00),
  ('a0000000-0000-4000-8000-000000000005', 'Ice 10 lb bag',           null,         'ice',      1,  1.20,  2.50,  2.75),
  ('a0000000-0000-4000-8000-000000000006', 'Coca-Cola 2L',            'Coca-Cola',  'soda',     8,  9.00, 14.00, 15.00)
on conflict (id) do nothing;

insert into pack_sizes (product_id, label, units, cash_price, card_price, barcode, sort_order) values
  ('a0000000-0000-4000-8000-000000000001', 'Single',   1,  2.50,  2.65, 'TEST-CORONA-1',  1),
  ('a0000000-0000-4000-8000-000000000001', '6 pack',   6, 12.99, 13.75, null,             2),
  ('a0000000-0000-4000-8000-000000000001', '12 pack', 12, 22.99, 24.35, 'TEST-CORONA-12', 3),
  ('a0000000-0000-4000-8000-000000000001', '24 case', 24, 39.99, 42.40, 'TEST-CORONA-24', 4),
  ('a0000000-0000-4000-8000-000000000002', 'Single',   1,  2.75,  2.90, 'TEST-MODELO-1',  1),
  ('a0000000-0000-4000-8000-000000000002', '6 pack',   6, 13.99, 14.80, null,             2),
  ('a0000000-0000-4000-8000-000000000002', '12 pack', 12, 24.99, 26.45, 'TEST-MODELO-12', 3),
  ('a0000000-0000-4000-8000-000000000003', 'Single',   1,  2.00,  2.10, 'TEST-BUDLT-1',   1),
  ('a0000000-0000-4000-8000-000000000003', '6 pack',   6,  9.99, 10.55, null,             2),
  ('a0000000-0000-4000-8000-000000000004', '12 pack', 12, 21.99, 23.25, 'TEST-CLAW-12',   1),
  ('a0000000-0000-4000-8000-000000000005', 'Each',     1,  3.49,  3.49, 'TEST-ICE',       1),
  ('a0000000-0000-4000-8000-000000000006', 'Single',   1,  2.99,  3.15, 'TEST-COKE-2L',   1)
on conflict do nothing;

-- Stock: warehouse spots in cases, front fridges in singles.
-- Corona: plenty. Modelo: warehouse low. Bud Light: front low.
-- White Claw: out everywhere. Ice and Coke: plenty.
insert into stock (location_id, product_id, quantity)
select l.id, s.product_id::uuid, s.qty
from (values
  ('Industrial Fridge 1', 'a0000000-0000-4000-8000-000000000001', 20),
  ('Warehouse A',         'a0000000-0000-4000-8000-000000000001', 15),
  ('Front Fridge 1',      'a0000000-0000-4000-8000-000000000001', 48),
  ('Warehouse A',         'a0000000-0000-4000-8000-000000000002',  4),
  ('Front Fridge 1',      'a0000000-0000-4000-8000-000000000002', 30),
  ('Warehouse B',         'a0000000-0000-4000-8000-000000000003', 30),
  ('Front Fridge 2',      'a0000000-0000-4000-8000-000000000003',  6),
  ('Industrial Fridge 2', 'a0000000-0000-4000-8000-000000000005', 40),
  ('Front Fridge 3',      'a0000000-0000-4000-8000-000000000005', 15),
  ('Warehouse B',         'a0000000-0000-4000-8000-000000000006', 12),
  ('Front Fridge 4',      'a0000000-0000-4000-8000-000000000006', 20)
) as s(location, product_id, qty)
join locations l on l.name = s.location
on conflict (location_id, product_id) do nothing;

insert into stock_thresholds (product_id, catalog, min_qty, target_qty)
select p.id, c.catalog, c.min_qty, c.target_qty
from products p
cross join (values ('retail'::catalog_kind, 24, 72), ('warehouse'::catalog_kind, 10, 40)) as c(catalog, min_qty, target_qty)
where p.id::text like 'a0000000-0000-4000-8000-00000000000%'
on conflict do nothing;
