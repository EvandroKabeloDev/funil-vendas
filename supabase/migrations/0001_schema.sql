-- =====================================================================
-- FUNIL DE VENDAS — Migration 0001 : schema base, índices, RLS e triggers
-- Execute TUDO de uma vez no Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) EXTENSÕES
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- busca por nome (ILIKE)

-- ---------------------------------------------------------------------
-- 2) TIPOS
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('gestor', 'corretor');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 3) TABELAS
-- ---------------------------------------------------------------------

-- 3.1 Organização (imobiliária / empresa). Isola os dados por cliente.
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 2 and 120),
  created_at  timestamptz not null default now()
);

-- 3.2 Perfil do usuário (1:1 com auth.users)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references public.organizations(id) on delete cascade,
  full_name   text not null check (char_length(trim(full_name)) between 2 and 120),
  email       text not null,
  phone       text,
  role        public.user_role not null default 'corretor',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3.3 Equipes
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 2 and 120),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);

-- 3.4 Corretores (podem ou não ter login próprio)
create table if not exists public.brokers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete restrict,
  profile_id  uuid references public.profiles(id) on delete set null,
  name        text not null check (char_length(trim(name)) between 2 and 120),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (org_id, name)
);

-- 3.5 Lançamento diário do funil (1 por corretor por dia)
create table if not exists public.funnel_entries (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  broker_id        uuid not null references public.brokers(id) on delete cascade,
  entry_date       date not null,

  -- captação
  leads            integer not null default 0 check (leads >= 0),
  hot              integer not null default 0 check (hot  >= 0),
  warm             integer not null default 0 check (warm >= 0),
  cold             integer not null default 0 check (cold >= 0),

  -- adequação por sentimento
  hot_product      integer not null default 0 check (hot_product  >= 0),
  hot_location     integer not null default 0 check (hot_location >= 0),
  hot_price        integer not null default 0 check (hot_price    >= 0),
  warm_product     integer not null default 0 check (warm_product  >= 0),
  warm_location    integer not null default 0 check (warm_location >= 0),
  warm_price       integer not null default 0 check (warm_price    >= 0),
  cold_product     integer not null default 0 check (cold_product  >= 0),
  cold_location    integer not null default 0 check (cold_location >= 0),
  cold_price       integer not null default 0 check (cold_price    >= 0),

  -- avanço comercial
  appointments     integer not null default 0 check (appointments  >= 0),
  attendance       integer not null default 0 check (attendance    >= 0),
  proposals        integer not null default 0 check (proposals     >= 0),
  relationships    integer not null default 0 check (relationships >= 0),
  contracts        integer not null default 0 check (contracts     >= 0),
  sales            integer not null default 0 check (sales         >= 0),

  -- observações
  note_hot         text check (char_length(note_hot)  <= 500),
  note_warm        text check (char_length(note_warm) <= 500),
  note_cold        text check (char_length(note_cold) <= 500),

  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- regras de negócio do mockup, agora garantidas pelo banco
  constraint uq_entry_broker_date unique (broker_id, entry_date),
  constraint ck_sentiment_sum     check (hot + warm + cold = leads),
  constraint ck_hot_reasons       check (hot_product  <= hot  and hot_location  <= hot  and hot_price  <= hot),
  constraint ck_warm_reasons      check (warm_product <= warm and warm_location <= warm and warm_price <= warm),
  constraint ck_cold_reasons      check (cold_product <= cold and cold_location <= cold and cold_price <= cold),
  constraint ck_entry_date        check (entry_date <= current_date + 1)
);

-- ---------------------------------------------------------------------
-- 4) ÍNDICES (performance de dashboard e filtros)
-- ---------------------------------------------------------------------
create index if not exists idx_profiles_org        on public.profiles (org_id);
create index if not exists idx_teams_org           on public.teams (org_id) where is_active;
create index if not exists idx_brokers_org         on public.brokers (org_id) where is_active;
create index if not exists idx_brokers_team        on public.brokers (team_id);
create index if not exists idx_brokers_profile     on public.brokers (profile_id);
create index if not exists idx_brokers_name_trgm   on public.brokers using gin (name gin_trgm_ops);

-- consulta mais frequente: dashboard por org + período
create index if not exists idx_entries_org_date    on public.funnel_entries (org_id, entry_date desc);
-- consulta da tela de lançamento: corretor + data
create index if not exists idx_entries_broker_date on public.funnel_entries (broker_id, entry_date desc);

-- ---------------------------------------------------------------------
-- 5) FUNÇÕES AUXILIARES (SECURITY DEFINER — evitam recursão nas policies)
-- ---------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_gestor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'gestor' from public.profiles where id = auth.uid()), false);
$$;

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_entries_updated on public.funnel_entries;
create trigger trg_entries_updated before update on public.funnel_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6) CADASTRO AUTOMÁTICO NO SIGNUP
--    Cria a organização (se for o 1º usuário dela) e o profile.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_org_name text := coalesce(nullif(trim(new.raw_user_meta_data->>'org_name'), ''), 'Minha Imobiliária');
  v_org_id   uuid;
  v_role     public.user_role;
begin
  select id into v_org_id from public.organizations where lower(name) = lower(v_org_name) limit 1;

  if v_org_id is null then
    insert into public.organizations (name) values (v_org_name) returning id into v_org_id;
    v_role := 'gestor';                 -- quem cria a organização vira gestor
  else
    v_role := 'corretor';               -- quem entra depois começa como corretor
  end if;

  insert into public.profiles (id, org_id, full_name, email, phone, role)
  values (
    new.id,
    v_org_id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(trim(new.raw_user_meta_data->>'phone'), ''),
    v_role
  );

  -- equipe padrão para a organização recém-criada
  insert into public.teams (org_id, name)
  values (v_org_id, 'Equipe Principal')
  on conflict (org_id, name) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 7) RLS — ninguém vê dados de outra organização.
--    Gestor vê tudo da org; corretor vê os lançamentos dele.
-- ---------------------------------------------------------------------
alter table public.organizations  enable row level security;
alter table public.profiles       enable row level security;
alter table public.teams          enable row level security;
alter table public.brokers        enable row level security;
alter table public.funnel_entries enable row level security;

-- organizations
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select to authenticated
  using (id = public.current_org_id());

drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update to authenticated
  using (id = public.current_org_id() and public.is_gestor());

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or (org_id = public.current_org_id() and public.is_gestor()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles p where p.id = auth.uid()));

drop policy if exists profiles_update_gestor on public.profiles;
create policy profiles_update_gestor on public.profiles for update to authenticated
  using (org_id = public.current_org_id() and public.is_gestor())
  with check (org_id = public.current_org_id());

-- teams
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists teams_write on public.teams;
create policy teams_write on public.teams for all to authenticated
  using (org_id = public.current_org_id() and public.is_gestor())
  with check (org_id = public.current_org_id() and public.is_gestor());

-- brokers
drop policy if exists brokers_select on public.brokers;
create policy brokers_select on public.brokers for select to authenticated
  using (org_id = public.current_org_id());

drop policy if exists brokers_write on public.brokers;
create policy brokers_write on public.brokers for all to authenticated
  using (org_id = public.current_org_id() and public.is_gestor())
  with check (org_id = public.current_org_id() and public.is_gestor());

-- funnel_entries
drop policy if exists entries_select on public.funnel_entries;
create policy entries_select on public.funnel_entries for select to authenticated
  using (
    org_id = public.current_org_id()
    and (
      public.is_gestor()
      or exists (select 1 from public.brokers b where b.id = broker_id and b.profile_id = auth.uid())
    )
  );

drop policy if exists entries_insert on public.funnel_entries;
create policy entries_insert on public.funnel_entries for insert to authenticated
  with check (
    org_id = public.current_org_id()
    and (public.is_gestor()
         or exists (select 1 from public.brokers b where b.id = broker_id and b.profile_id = auth.uid()))
  );

drop policy if exists entries_update on public.funnel_entries;
create policy entries_update on public.funnel_entries for update to authenticated
  using (
    org_id = public.current_org_id()
    and (public.is_gestor()
         or exists (select 1 from public.brokers b where b.id = broker_id and b.profile_id = auth.uid()))
  )
  with check (org_id = public.current_org_id());

drop policy if exists entries_delete on public.funnel_entries;
create policy entries_delete on public.funnel_entries for delete to authenticated
  using (org_id = public.current_org_id() and public.is_gestor());

-- ---------------------------------------------------------------------
-- 8) VIEW DE APOIO AO DASHBOARD (já respeita RLS das tabelas base)
-- ---------------------------------------------------------------------
create or replace view public.vw_funnel_entries as
select e.*, b.name as broker_name, b.team_id, t.name as team_name
from public.funnel_entries e
join public.brokers b on b.id = e.broker_id
join public.teams   t on t.id = b.team_id;

alter view public.vw_funnel_entries set (security_invoker = on);

-- FIM DA MIGRATION 0001
