-- Charles app: initial schema
-- Two stock pools: RETAIL (front commercial fridges, counted in singles)
-- and WAREHOUSE (warehouse areas + industrial fridges, counted in cases).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type staff_role        as enum ('manager', 'staff', 'driver');
create type catalog_kind      as enum ('retail', 'warehouse');
create type location_kind     as enum ('commercial_fridge', 'industrial_fridge', 'warehouse_area');
create type customer_kind     as enum ('wholesale', 'retail');
create type account_status    as enum ('pending', 'approved', 'rejected', 'suspended');
create type movement_kind     as enum ('receive', 'restock', 'move', 'sale', 'order_pick', 'adjust', 'count');
create type order_channel     as enum ('online', 'in_store', 'phone');
create type order_status      as enum ('submitted', 'confirmed', 'partially_confirmed', 'cancelled', 'completed');
create type delivery_status   as enum ('not_started', 'prepared', 'en_route', 'heading_to_customer', 'delivered');
create type line_status       as enum ('pending', 'confirmed', 'partial', 'declined');
create type payment_method    as enum ('cash', 'check', 'card', 'zelle', 'invoice');
create type payment_status    as enum ('unpaid', 'partial', 'paid');
create type price_mode        as enum ('cash', 'card');
create type discount_kind     as enum ('percent', 'flat');
create type trip_status       as enum ('planning', 'departed', 'completed');

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
-- Staff accounts (linked to Supabase auth users). Only managers edit prices.
create table staff (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  role        staff_role not null default 'staff',
  can_edit_prices boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Wholesale and retail customers. auth_user_id is null for customers
-- created in-store who have not logged in online yet.
create table customers (
  id                 uuid primary key default gen_random_uuid(),
  auth_user_id       uuid unique references auth.users (id) on delete set null,
  kind               customer_kind not null,
  status             account_status not null default 'pending',
  business_name      text,
  contact_name       text not null,
  email              text,
  phone              text,
  address_line       text,
  city               text,
  state              text,
  postal_code        text,
  latitude           double precision,
  longitude          double precision,
  -- wholesale only
  liquor_license_no  text,
  license_expires_on date,
  tax_id             text,
  default_discount_kind  discount_kind,
  default_discount_value numeric(10,2),
  -- retail only
  age_verified_at    timestamptz,
  approved_by        uuid references staff (id),
  approved_at        timestamptz,
  created_by_staff   uuid references staff (id),  -- set for in-store sign-ups
  notes              text,
  created_at         timestamptz not null default now(),
  constraint wholesale_needs_business check (kind <> 'wholesale' or business_name is not null)
);

create table customer_documents (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers (id) on delete cascade,
  doc_type     text not null,            -- 'liquor_license', 'tax_certificate', ...
  storage_path text not null,            -- path in the private 'customer-docs' bucket
  uploaded_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table products (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  brand           text,
  category        text,                   -- beer, ice, soda, ...
  case_size       integer not null default 24 check (case_size > 0),  -- singles per case
  cost_per_case   numeric(10,2),
  wholesale_case_price numeric(10,2),
  party_case_price     numeric(10,2),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Retail pack sizes: single, 4-pack, 6-pack, 12, 24. A hand-packed 6-pack
-- has no barcode of its own; it is chosen after scanning the single.
create table pack_sizes (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products (id) on delete cascade,
  label       text not null,             -- 'Single', '4 pack', '6 pack', '12 pack', '24 case'
  units       integer not null check (units > 0),  -- singles removed from retail stock
  barcode     text unique,               -- null for hand-packed packs
  cash_price  numeric(10,2) not null,
  card_price  numeric(10,2) not null,
  sort_order  integer not null default 0,
  unique (product_id, units)
);

create table product_barcodes (
  barcode     text primary key,
  product_id  uuid not null references products (id) on delete cascade,
  is_case     boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create table locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,      -- 'Industrial Fridge 1', 'Front Fridge 3', 'Warehouse A'
  kind        location_kind not null,
  catalog     catalog_kind not null,     -- retail = counted in singles, warehouse = counted in cases
  map_x       integer, map_y integer,    -- position on the floor map
  sort_order  integer not null default 0
);

-- Quantity is singles for retail locations, cases for warehouse locations.
create table stock (
  location_id uuid not null references locations (id) on delete cascade,
  product_id  uuid not null references products (id) on delete cascade,
  quantity    integer not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (location_id, product_id)
);

create table stock_movements (
  id              uuid primary key default gen_random_uuid(),
  kind            movement_kind not null,
  product_id      uuid not null references products (id),
  from_location   uuid references locations (id),
  to_location     uuid references locations (id),
  quantity_out    integer,               -- in the from-location's unit
  quantity_in     integer,               -- in the to-location's unit (restock: cases -> singles)
  staff_id        uuid references staff (id),
  sale_id         uuid,
  order_id        uuid,
  note            text,
  created_at      timestamptz not null default now()
);

-- Low-stock tab: one row per product per catalog.
create table stock_thresholds (
  product_id  uuid not null references products (id) on delete cascade,
  catalog     catalog_kind not null,
  min_qty     integer not null,          -- show on the low-stock tab below this
  target_qty  integer not null,          -- refill up to this
  primary key (product_id, catalog)
);

-- ---------------------------------------------------------------------------
-- Retail register
-- ---------------------------------------------------------------------------
create table sales (
  id              uuid primary key default gen_random_uuid(),
  client_id       text unique,           -- generated on the laptop; dedupes offline sync
  staff_id        uuid references staff (id),
  price_mode      price_mode not null,
  subtotal        numeric(10,2) not null,
  discount_kind   discount_kind,
  discount_value  numeric(10,2),
  discount_amount numeric(10,2) not null default 0,
  total           numeric(10,2) not null,
  square_checkout_id text,
  recorded_offline boolean not null default false,
  created_at      timestamptz not null default now()
);

create table sale_lines (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references sales (id) on delete cascade,
  product_id    uuid not null references products (id),
  pack_size_id  uuid references pack_sizes (id),
  location_id   uuid references locations (id),
  quantity      integer not null check (quantity > 0),  -- number of packs
  unit_price    numeric(10,2) not null,
  unit_cost     numeric(10,2),           -- snapshot for profit reporting
  line_discount numeric(10,2) not null default 0
);

-- ---------------------------------------------------------------------------
-- Orders (wholesale + retail online) and delivery
-- ---------------------------------------------------------------------------
create table delivery_trips (
  id           uuid primary key default gen_random_uuid(),
  trip_date    date not null,
  trip_number  integer not null default 1,
  driver_id    uuid references staff (id),
  status       trip_status not null default 'planning',
  departed_at  timestamptz,               -- stop order is locked once set
  created_at   timestamptz not null default now(),
  unique (trip_date, trip_number)
);

create table orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     bigint generated always as identity,
  customer_id      uuid not null references customers (id),
  customer_kind    customer_kind not null,
  channel          order_channel not null,
  status           order_status not null default 'submitted',
  fulfillment_date date not null,
  placed_at        timestamptz not null default now(),  -- first-come priority
  entered_by_staff uuid references staff (id),
  discount_kind    discount_kind,
  discount_value   numeric(10,2),
  subtotal         numeric(10,2) not null default 0,
  empties_count    integer not null default 0,
  empties_credit   numeric(10,2) not null default 0,
  total            numeric(10,2) not null default 0,
  payment_status   payment_status not null default 'unpaid',
  -- delivery
  trip_id          uuid references delivery_trips (id),
  stop_number      integer,
  has_ice          boolean not null default false,
  delivery_status  delivery_status not null default 'not_started',
  delivered_at     timestamptz,
  unpaid_signer_name text,
  unpaid_signature_path text,            -- private 'signatures' bucket
  notes            text
);

create table order_lines (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders (id) on delete cascade,
  product_id      uuid not null references products (id),
  requested_qty   integer not null check (requested_qty > 0),  -- cases (wholesale) or packs (retail)
  confirmed_qty   integer,
  pack_size_id    uuid references pack_sizes (id),             -- retail orders only
  status          line_status not null default 'pending',
  unit_price      numeric(10,2) not null,
  -- quantity added after the original order goes to the back of the line
  requested_at    timestamptz not null default now(),
  staff_note      text
);

create table payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders (id) on delete cascade,
  method      payment_method not null,
  amount      numeric(10,2) not null,
  received_by uuid references staff (id),
  reference   text,                      -- check number, Zelle confirmation, ...
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table settings (
  id                     boolean primary key default true check (id),  -- single row
  store_address          text,
  store_latitude         double precision,
  store_longitude        double precision,
  same_day_cutoff        time not null default '15:00',
  empty_credit_rate      numeric(10,4) not null default 0.05,
  card_markup_percent    numeric(5,2)
);
insert into settings default values;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index on stock (product_id);
create index on stock_movements (product_id, created_at desc);
create index on sales (created_at);
create index on orders (fulfillment_date, placed_at);
create index on orders (customer_id);
create index on order_lines (order_id);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where id = auth.uid() and active);
$$;

create or replace function is_price_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where id = auth.uid() and active and can_edit_prices);
$$;

create or replace function my_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from customers where auth_user_id = auth.uid();
$$;

alter table staff              enable row level security;
alter table customers          enable row level security;
alter table customer_documents enable row level security;
alter table products           enable row level security;
alter table pack_sizes         enable row level security;
alter table product_barcodes   enable row level security;
alter table locations          enable row level security;
alter table stock              enable row level security;
alter table stock_movements    enable row level security;
alter table stock_thresholds   enable row level security;
alter table sales              enable row level security;
alter table sale_lines         enable row level security;
alter table delivery_trips     enable row level security;
alter table orders             enable row level security;
alter table order_lines        enable row level security;
alter table payments           enable row level security;
alter table settings           enable row level security;

-- Staff can do everything, except price edits which need can_edit_prices.
create policy staff_all on staff              for all using (is_staff()) with check (is_staff());
create policy staff_all on customers          for all using (is_staff()) with check (is_staff());
create policy staff_all on customer_documents for all using (is_staff()) with check (is_staff());
create policy staff_read on products          for select using (is_staff());
create policy price_edit on products          for all using (is_price_editor()) with check (is_price_editor());
create policy staff_read on pack_sizes        for select using (is_staff());
create policy price_edit on pack_sizes        for all using (is_price_editor()) with check (is_price_editor());
create policy staff_all on product_barcodes   for all using (is_staff()) with check (is_staff());
create policy staff_all on locations          for all using (is_staff()) with check (is_staff());
create policy staff_all on stock              for all using (is_staff()) with check (is_staff());
create policy staff_all on stock_movements    for all using (is_staff()) with check (is_staff());
create policy staff_all on stock_thresholds   for all using (is_staff()) with check (is_staff());
create policy staff_all on sales              for all using (is_staff()) with check (is_staff());
create policy staff_all on sale_lines         for all using (is_staff()) with check (is_staff());
create policy staff_all on delivery_trips     for all using (is_staff()) with check (is_staff());
create policy staff_all on orders             for all using (is_staff()) with check (is_staff());
create policy staff_all on order_lines        for all using (is_staff()) with check (is_staff());
create policy staff_all on payments           for all using (is_staff()) with check (is_staff());
create policy staff_read on settings          for select using (is_staff());
create policy price_edit on settings          for update using (is_price_editor());

-- Customers see only their own account, documents, orders and payments.
create policy own_account on customers for select using (auth_user_id = auth.uid());
create policy own_docs on customer_documents for select using (customer_id = my_customer_id());
create policy own_orders on orders for select using (customer_id = my_customer_id());
create policy own_lines on order_lines for select
  using (exists (select 1 from orders o where o.id = order_id and o.customer_id = my_customer_id()));
create policy own_payments on payments for select
  using (exists (select 1 from orders o where o.id = order_id and o.customer_id = my_customer_id()));

-- Signed-in customers can browse active products. Prices each side sees
-- (wholesale vs retail) are filtered in the API layer, and stock is exposed
-- only as In stock / Low / Out through the view below.
create policy customers_browse on products for select
  using (active and my_customer_id() is not null);
create policy customers_browse on pack_sizes for select
  using (my_customer_id() is not null);

create view product_availability with (security_invoker = false) as
select
  p.id as product_id,
  l.catalog,
  case
    when coalesce(sum(s.quantity), 0) <= 0 then 'out'
    when coalesce(sum(s.quantity), 0) < coalesce(max(t.min_qty), 1) then 'low'
    else 'in_stock'
  end as availability
from products p
cross join (select distinct catalog from locations) l
left join locations loc on loc.catalog = l.catalog
left join stock s on s.location_id = loc.id and s.product_id = p.id
left join stock_thresholds t on t.product_id = p.id and t.catalog = l.catalog
where p.active
group by p.id, l.catalog;
