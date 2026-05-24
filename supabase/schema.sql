-- GranjaApp Supabase schema
-- Run this in the Supabase SQL editor or convert it into a migration.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.flocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  name text not null,
  breed text,
  start_date date not null,
  initial_birds integer not null check (initial_birds >= 0),
  active_birds integer not null check (active_birds >= 0),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  flock_id uuid references public.flocks(id) on delete cascade,
  record_date date not null,
  eggs_produced integer not null default 0 check (eggs_produced >= 0),
  broken_eggs integer not null default 0 check (broken_eggs >= 0),
  mortality integer not null default 0 check (mortality >= 0),
  culls integer not null default 0 check (culls >= 0),
  feed_kg numeric(10, 2) not null default 0 check (feed_kg >= 0),
  water_liters numeric(10, 2) not null default 0 check (water_liters >= 0),
  temperature_c numeric(5, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feed_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  item_name text not null,
  quantity_kg numeric(12, 2) not null default 0 check (quantity_kg >= 0),
  unit_cost numeric(10, 2) check (unit_cost >= 0),
  supplier text,
  received_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.egg_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  inventory_date date not null default current_date,
  grade text not null default 'standard',
  quantity integer not null default 0 check (quantity >= 0),
  broken_quantity integer not null default 0 check (broken_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  sale_date date not null default current_date,
  customer_name text,
  eggs_quantity integer not null default 0 check (eggs_quantity >= 0),
  dozen_price numeric(10, 2) not null default 0 check (dozen_price >= 0),
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  expense_date date not null default current_date,
  category text not null,
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  flock_id uuid references public.flocks(id) on delete cascade,
  event_date date not null default current_date,
  event_type text not null,
  description text,
  birds_affected integer not null default 0 check (birds_affected >= 0),
  treatment text,
  veterinarian text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists farms_user_id_idx on public.farms(user_id);
create index if not exists flocks_user_id_idx on public.flocks(user_id);
create index if not exists flocks_farm_id_idx on public.flocks(farm_id);
create index if not exists daily_records_user_id_idx on public.daily_records(user_id);
create index if not exists daily_records_flock_date_idx on public.daily_records(flock_id, record_date);
create index if not exists feed_inventory_user_id_idx on public.feed_inventory(user_id);
create index if not exists egg_inventory_user_id_idx on public.egg_inventory(user_id);
create index if not exists sales_user_id_idx on public.sales(user_id);
create index if not exists expenses_user_id_idx on public.expenses(user_id);
create index if not exists health_events_user_id_idx on public.health_events(user_id);

create trigger set_farms_updated_at
before update on public.farms
for each row execute function public.set_updated_at();

create trigger set_flocks_updated_at
before update on public.flocks
for each row execute function public.set_updated_at();

create trigger set_daily_records_updated_at
before update on public.daily_records
for each row execute function public.set_updated_at();

create trigger set_feed_inventory_updated_at
before update on public.feed_inventory
for each row execute function public.set_updated_at();

create trigger set_egg_inventory_updated_at
before update on public.egg_inventory
for each row execute function public.set_updated_at();

create trigger set_sales_updated_at
before update on public.sales
for each row execute function public.set_updated_at();

create trigger set_expenses_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create trigger set_health_events_updated_at
before update on public.health_events
for each row execute function public.set_updated_at();

alter table public.farms enable row level security;
alter table public.flocks enable row level security;
alter table public.daily_records enable row level security;
alter table public.feed_inventory enable row level security;
alter table public.egg_inventory enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.health_events enable row level security;

create policy "Users can select own farms"
on public.farms for select
using (auth.uid() = user_id);

create policy "Users can insert own farms"
on public.farms for insert
with check (auth.uid() = user_id);

create policy "Users can update own farms"
on public.farms for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own farms"
on public.farms for delete
using (auth.uid() = user_id);

create policy "Users can select own flocks"
on public.flocks for select
using (auth.uid() = user_id);

create policy "Users can insert own flocks"
on public.flocks for insert
with check (auth.uid() = user_id);

create policy "Users can update own flocks"
on public.flocks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own flocks"
on public.flocks for delete
using (auth.uid() = user_id);

create policy "Users can select own daily records"
on public.daily_records for select
using (auth.uid() = user_id);

create policy "Users can insert own daily records"
on public.daily_records for insert
with check (auth.uid() = user_id);

create policy "Users can update own daily records"
on public.daily_records for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own daily records"
on public.daily_records for delete
using (auth.uid() = user_id);

create policy "Users can select own feed inventory"
on public.feed_inventory for select
using (auth.uid() = user_id);

create policy "Users can insert own feed inventory"
on public.feed_inventory for insert
with check (auth.uid() = user_id);

create policy "Users can update own feed inventory"
on public.feed_inventory for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own feed inventory"
on public.feed_inventory for delete
using (auth.uid() = user_id);

create policy "Users can select own egg inventory"
on public.egg_inventory for select
using (auth.uid() = user_id);

create policy "Users can insert own egg inventory"
on public.egg_inventory for insert
with check (auth.uid() = user_id);

create policy "Users can update own egg inventory"
on public.egg_inventory for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own egg inventory"
on public.egg_inventory for delete
using (auth.uid() = user_id);

create policy "Users can select own sales"
on public.sales for select
using (auth.uid() = user_id);

create policy "Users can insert own sales"
on public.sales for insert
with check (auth.uid() = user_id);

create policy "Users can update own sales"
on public.sales for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own sales"
on public.sales for delete
using (auth.uid() = user_id);

create policy "Users can select own expenses"
on public.expenses for select
using (auth.uid() = user_id);

create policy "Users can insert own expenses"
on public.expenses for insert
with check (auth.uid() = user_id);

create policy "Users can update own expenses"
on public.expenses for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own expenses"
on public.expenses for delete
using (auth.uid() = user_id);

create policy "Users can select own health events"
on public.health_events for select
using (auth.uid() = user_id);

create policy "Users can insert own health events"
on public.health_events for insert
with check (auth.uid() = user_id);

create policy "Users can update own health events"
on public.health_events for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own health events"
on public.health_events for delete
using (auth.uid() = user_id);
