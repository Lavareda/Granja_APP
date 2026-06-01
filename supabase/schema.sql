-- =============================================================================
-- GranjaApp — Supabase Database Schema
-- Version: 2.0
--
-- SECURITY RULES (read before touching this file):
--   ▸ NEVER use the service_role key in frontend or client code.
--     The service_role key bypasses RLS and has full database access.
--     Only the anon key belongs in VITE_SUPABASE_ANON_KEY.
--   ▸ Keep .env files out of Git. The .gitignore already excludes them.
--     Use .env.example (committed) to document required variables.
--   ▸ RLS is enabled on every user-facing table. Every new table MUST
--     have row-level security enabled and explicit policies.
--   ▸ Validate required fields in the application layer BEFORE any INSERT.
--     Database constraints are a safety net, not the primary guard.
--   ▸ Never SELECT * in production queries — list columns explicitly to
--     avoid leaking columns added later.
--
-- HOW TO APPLY:
--   Option A — Supabase dashboard: SQL Editor → paste and run.
--   Option B — Supabase CLI: supabase db push (add to a migration file).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Shared trigger: stamp updated_at on every row change
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Macro to attach the trigger to any table
-- Usage: select _attach_updated_at_trigger('table_name');
create or replace function public._attach_updated_at_trigger(tbl text)
returns void language plpgsql as $$
begin
  execute format(
    'create trigger set_%s_updated_at
     before update on public.%I
     for each row execute function public.set_updated_at()',
    tbl, tbl
  );
end;
$$;

-- =============================================================================
-- PROFILES
-- Extended user metadata — one row per auth.users row.
-- Created automatically when a user signs up.
-- =============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique,
  full_name   text,
  avatar_url  text,
  role        text not null default 'granjeiro'
                check (role in ('empresario','granjeiro')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles add column if not exists email text unique;

do $$
begin
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'public'
      and table_name = 'profiles'
      and constraint_name = 'profiles_role_check'
  ) then
    alter table public.profiles drop constraint profiles_role_check;
  end if;
end $$;

update public.profiles
set role = 'empresario'
where role in ('owner', 'manager');

alter table public.profiles
  add constraint profiles_role_check check (role in ('empresario','granjeiro'));

create or replace function public.is_protected_empresario_email(email_value text)
returns boolean language sql immutable as $$
  select lower(coalesce(email_value, '')) in (
    'amazonidalavareda@gmail.com',
    'phelipelavareda@hotmail.com'
  );
$$;

create or replace function public.is_empresario()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'empresario'
  ) or lower(coalesce(auth.jwt() ->> 'email', '')) in (
    'amazonidalavareda@gmail.com',
    'phelipelavareda@hotmail.com'
  );
$$;

create or replace function public.profile_role(profile_id uuid)
returns text language sql stable security definer
set search_path = public as $$
  select role from public.profiles where id = profile_id;
$$;

create or replace function public.enforce_protected_empresario()
returns trigger language plpgsql as $$
begin
  if public.is_protected_empresario_email(new.email) then
    new.role = 'empresario';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_protected_empresario on public.profiles;
create trigger enforce_protected_empresario
  before insert or update on public.profiles
  for each row execute function public.enforce_protected_empresario();

select public._attach_updated_at_trigger('profiles');

-- Auto-create a profile row when a user registers
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    lower(new.email),
    case
      when public.is_protected_empresario_email(new.email) then 'empresario'
      else 'granjeiro'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "Usuário vê próprio perfil" on public.profiles;
drop policy if exists "Usuário atualiza próprio perfil" on public.profiles;
drop policy if exists "Usuário cria próprio perfil" on public.profiles;
drop policy if exists "Empresário vê todos os perfis" on public.profiles;
drop policy if exists "Empresário atualiza papéis" on public.profiles;

create policy "Usuário vê próprio perfil"
  on public.profiles for select using (auth.uid() = id);

create policy "Usuário cria próprio perfil"
  on public.profiles for insert
  with check (
    auth.uid() = id
    and role = case
      when public.is_protected_empresario_email(email) then 'empresario'
      else 'granjeiro'
    end
  );

create policy "Usuário atualiza próprio perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = case
      when public.is_protected_empresario_email(email) then 'empresario'
      else public.profile_role(auth.uid())
    end
  );

create policy "Empresário vê todos os perfis"
  on public.profiles for select using (public.is_empresario());

create policy "Empresário atualiza papéis"
  on public.profiles for update
  using (public.is_empresario() and not public.is_protected_empresario_email(email))
  with check (public.is_empresario() and not public.is_protected_empresario_email(email));

-- =============================================================================
-- FARMS (Granjas)
-- =============================================================================
create table if not exists public.farms (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  location    text,
  capacity    int check (capacity >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists farms_user_id_idx on public.farms (user_id);
select public._attach_updated_at_trigger('farms');
alter table public.farms enable row level security;

create policy "Usuário gerencia próprias granjas"
  on public.farms for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- FLOCKS (Lotes)
-- =============================================================================
create table if not exists public.flocks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  farm_id         uuid references public.farms(id) on delete cascade,
  name            text not null,
  breed           text,
  housing_date    date not null,
  initial_birds   int not null default 0 check (initial_birds >= 0),
  active_birds    int not null default 0 check (active_birds >= 0),
  status          text not null default 'ativo'
                    check (status in ('ativo','observacao','encerrado')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists flocks_user_id_idx  on public.flocks (user_id);
create index if not exists flocks_farm_id_idx  on public.flocks (farm_id);
select public._attach_updated_at_trigger('flocks');
alter table public.flocks enable row level security;

create policy "Usuário gerencia próprios lotes"
  on public.flocks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- DAILY_RECORDS (Registros Diários)
-- Core production table — one row per lote per day.
--
-- lote_name: denormalized text copy of the flock name.
--   Kept so the frontend can display the name without a join,
--   and for records where the flock was deleted (flock_id becomes null).
-- =============================================================================
create table if not exists public.daily_records (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  farm_id         uuid references public.farms(id) on delete cascade,
  flock_id        uuid references public.flocks(id) on delete set null,
  lote_name       text not null default '',      -- convenience: flock display name
  record_date     date not null,
  eggs_produced   int not null default 0 check (eggs_produced   >= 0),
  eggs_broken     int not null default 0 check (eggs_broken     >= 0),
  mortality       int not null default 0 check (mortality       >= 0),
  culling         int not null default 0 check (culling         >= 0),
  feed_kg         numeric(10,2) not null default 0 check (feed_kg >= 0),
  water_liters    numeric(10,2)          check (water_liters   >= 0),
  temperature_c   numeric(5,2),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists daily_records_user_date_idx
  on public.daily_records (user_id, record_date desc);
create index if not exists daily_records_flock_idx
  on public.daily_records (flock_id, record_date desc);

select public._attach_updated_at_trigger('daily_records');
alter table public.daily_records enable row level security;

create policy "Usuário gerencia próprios registros diários"
  on public.daily_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- FINANCIAL_RECORDS (Premissas Financeiras)
-- Stores the user's daily financial assumptions used for profit calculation.
-- =============================================================================
create table if not exists public.financial_records (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  farm_id          uuid references public.farms(id) on delete cascade,
  record_date      date not null default current_date,
  daily_revenue    numeric(12,2) not null default 0,
  monthly_revenue  numeric(12,2) not null default 0,
  price_per_dozen  numeric(8,2)  not null default 0,
  price_per_box    numeric(8,2)  not null default 0,
  feed_cost        numeric(10,2) not null default 0,
  labor_cost       numeric(10,2) not null default 0,
  energy_cost      numeric(10,2) not null default 0,
  medicine_cost    numeric(10,2) not null default 0,
  other_costs      numeric(10,2) not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists financial_records_user_idx
  on public.financial_records (user_id, record_date desc);

select public._attach_updated_at_trigger('financial_records');
alter table public.financial_records enable row level security;

create policy "Usuário gerencia próprias premissas financeiras"
  on public.financial_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- INVENTORY_ITEMS (Estoque)
-- General stock items tracked per farm.
-- =============================================================================
create table if not exists public.inventory_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  farm_id         uuid references public.farms(id) on delete cascade,
  name            text not null,
  current_qty     numeric(12,2) not null default 0 check (current_qty >= 0),
  min_qty         numeric(12,2) not null default 0 check (min_qty >= 0),
  unit            text not null default 'un.',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists inventory_items_user_idx on public.inventory_items (user_id);
select public._attach_updated_at_trigger('inventory_items');
alter table public.inventory_items enable row level security;

create policy "Usuário gerencia próprio estoque"
  on public.inventory_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- EGG_SALES (Vendas de Ovos)
-- =============================================================================
create table if not exists public.egg_sales (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  farm_id         uuid references public.farms(id) on delete cascade,
  sale_date       date not null default current_date,
  customer_name   text not null,
  qty_dozens      int not null default 0 check (qty_dozens >= 0),
  qty_boxes       int not null default 0 check (qty_boxes  >= 0),
  price_per_dozen numeric(8,2) not null default 0,
  price_per_box   numeric(8,2) not null default 0,
  total_amount    numeric(12,2) not null default 0,
  payment_method  text not null default 'pix'
                    check (payment_method in ('pix','dinheiro','cartao','boleto','transferencia')),
  status          text not null default 'pago'
                    check (status in ('pago','pendente')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists egg_sales_user_idx on public.egg_sales (user_id, sale_date desc);
select public._attach_updated_at_trigger('egg_sales');
alter table public.egg_sales enable row level security;

create policy "Usuário gerencia próprias vendas"
  on public.egg_sales for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- HEALTH_EVENTS (Ocorrências Sanitárias)
-- =============================================================================
create table if not exists public.health_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  farm_id         uuid references public.farms(id) on delete cascade,
  flock_id        uuid references public.flocks(id) on delete set null,
  event_date      date not null default current_date,
  event_type      text not null,   -- vacinacao | medicacao | diagnostico | outro
  description     text not null,
  birds_affected  int check (birds_affected >= 0),
  veterinarian    text,
  follow_up_date  date,
  resolved        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists health_events_user_idx  on public.health_events (user_id);
create index if not exists health_events_flock_idx on public.health_events (flock_id);
select public._attach_updated_at_trigger('health_events');
alter table public.health_events enable row level security;

create policy "Usuário gerencia próprias ocorrências sanitárias"
  on public.health_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =============================================================================
-- ALERTS (Alertas)
-- Persisted automatic and manual alerts visible to the user.
-- =============================================================================
create table if not exists public.alerts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  farm_id         uuid references public.farms(id) on delete cascade,
  flock_id        uuid references public.flocks(id) on delete set null,
  title           text not null,
  detail          text,
  status          text not null default 'atencao'
                    check (status in ('normal','atencao','critico')),
  resolved        boolean not null default false,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists alerts_user_idx on public.alerts (user_id, created_at desc);
select public._attach_updated_at_trigger('alerts');
alter table public.alerts enable row level security;

create policy "Usuário gerencia próprios alertas"
  on public.alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
