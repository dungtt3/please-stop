-- Please Stop (merge defense) — tables live in public with the ps_ prefix so they
-- never collide with the other app on this Supabase project. No project settings
-- are changed; nothing outside ps_* is touched.

-- Leaderboard: anyone can read and add, nobody can edit or delete.
create table if not exists public.ps_scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 20),
  wave_reached integer not null check (wave_reached between 0 and 100),
  kills integer not null check (kills between 0 and 1000000),
  won boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ps_scores_rank_idx
  on public.ps_scores (wave_reached desc, kills desc, created_at asc);
alter table public.ps_scores enable row level security;
drop policy if exists ps_scores_select on public.ps_scores;
create policy ps_scores_select on public.ps_scores
  for select to anon, authenticated using (true);
drop policy if exists ps_scores_insert on public.ps_scores;
create policy ps_scores_insert on public.ps_scores
  for insert to anon, authenticated with check (true);
revoke all on public.ps_scores from anon, authenticated;
grant select, insert on public.ps_scores to anon, authenticated;

-- Per-run stats: players can only insert; reading is for the owner (dashboard).
create table if not exists public.ps_runs (
  id bigint generated always as identity primary key,
  wave_reached integer not null check (wave_reached between 0 and 100),
  won boolean not null,
  kills integer not null check (kills between 0 and 1000000),
  duration_s real not null check (duration_s >= 0 and duration_s < 86400),
  config_hash text not null check (char_length(config_hash) between 1 and 64),
  created_at timestamptz not null default now()
);
alter table public.ps_runs enable row level security;
drop policy if exists ps_runs_insert on public.ps_runs;
create policy ps_runs_insert on public.ps_runs
  for insert to anon, authenticated with check (true);
revoke all on public.ps_runs from anon, authenticated;
grant insert on public.ps_runs to anon, authenticated;

-- Active balance config applied to every player. Readable by all; written only
-- through ps_save_config / ps_clear_config with the admin code.
create table if not exists public.ps_configs (
  slot text primary key check (slot = 'active'),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.ps_configs enable row level security;
drop policy if exists ps_configs_select on public.ps_configs;
create policy ps_configs_select on public.ps_configs
  for select to anon, authenticated using (true);
revoke all on public.ps_configs from anon, authenticated;
grant select on public.ps_configs to anon, authenticated;

-- Admin code hash (bcrypt). No API access at all.
create table if not exists public.ps_admin (
  id integer primary key check (id = 1),
  code_hash text not null
);
alter table public.ps_admin enable row level security;
revoke all on public.ps_admin from anon, authenticated;

create or replace function public.ps_check_admin(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text;
begin
  select code_hash into h from public.ps_admin where id = 1;
  if h is null or p_code is null or extensions.crypt(p_code, h) <> h then
    raise exception 'invalid admin code' using errcode = '28000';
  end if;
end;
$$;
revoke all on function public.ps_check_admin(text) from public, anon, authenticated;

create or replace function public.ps_save_config(p_code text, p_config jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  ts timestamptz;
begin
  perform public.ps_check_admin(p_code);
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'config must be a JSON object' using errcode = '22023';
  end if;
  if pg_column_size(p_config) > 200000 then
    raise exception 'config too large' using errcode = '22023';
  end if;
  insert into public.ps_configs (slot, config, updated_at)
  values ('active', p_config, now())
  on conflict (slot) do update set config = excluded.config, updated_at = excluded.updated_at
  returning updated_at into ts;
  return ts;
end;
$$;
revoke all on function public.ps_save_config(text, jsonb) from public;
grant execute on function public.ps_save_config(text, jsonb) to anon, authenticated;

create or replace function public.ps_clear_config(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ps_check_admin(p_code);
  delete from public.ps_configs where slot = 'active';
end;
$$;
revoke all on function public.ps_clear_config(text) from public;
grant execute on function public.ps_clear_config(text) to anon, authenticated;
