-- Named balance-config presets for the /admin page. Admin-only: RLS is enabled with
-- no policies and clients have no table privileges, so everything goes through the
-- ps_*_preset functions below, each guarded by ps_check_admin (SQLSTATE 28000).

create table if not exists public.ps_config_presets (
  name text primary key check (char_length(btrim(name)) between 1 and 40),
  config jsonb not null check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 200000),
  saved_at timestamptz not null default now()
);
-- Names are unique case-insensitively (the stored name is the normalized one).
create unique index if not exists ps_config_presets_lower_name_idx
  on public.ps_config_presets (lower(name));
alter table public.ps_config_presets enable row level security;
revoke all on public.ps_config_presets from anon, authenticated;

create or replace function public.ps_list_presets(p_code text)
returns table(name text, config jsonb, saved_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ps_check_admin(p_code);
  return query
    select p.name, p.config, p.saved_at
    from public.ps_config_presets p
    order by p.saved_at desc, p.name asc;
end;
$$;
revoke all on function public.ps_list_presets(text) from public;
grant execute on function public.ps_list_presets(text) to anon, authenticated;

-- Upsert by lower(name). A new name is refused with PS413 once 50 presets exist;
-- overwriting an existing one is always allowed.
create or replace function public.ps_save_preset(p_code text, p_name text, p_config jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  n text;
  ts timestamptz := now();
  updated integer;
begin
  perform public.ps_check_admin(p_code);
  if p_name is null then
    raise exception 'name is required' using errcode = '22023';
  end if;
  n := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
  if char_length(n) < 1 or char_length(n) > 40 then
    raise exception 'name must be 1-40 characters' using errcode = '22023';
  end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'config must be a JSON object' using errcode = '22023';
  end if;
  if pg_column_size(p_config) > 200000 then
    raise exception 'config too large' using errcode = '22023';
  end if;

  -- Serialize writers so the 50-row cap and the unique index cannot race.
  perform pg_advisory_xact_lock(hashtext('public.ps_config_presets'));

  update public.ps_config_presets
    set name = n, config = p_config, saved_at = ts
    where lower(name) = lower(n);
  get diagnostics updated = row_count;
  if updated = 0 then
    if (select count(*) from public.ps_config_presets) >= 50 then
      raise exception 'too many presets' using errcode = 'PS413';
    end if;
    insert into public.ps_config_presets (name, config, saved_at) values (n, p_config, ts);
  end if;
  return ts;
end;
$$;
revoke all on function public.ps_save_preset(text, text, jsonb) from public;
grant execute on function public.ps_save_preset(text, text, jsonb) to anon, authenticated;

create or replace function public.ps_delete_preset(p_code text, p_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  perform public.ps_check_admin(p_code);
  delete from public.ps_config_presets
    where lower(name) = lower(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')));
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;
revoke all on function public.ps_delete_preset(text, text) from public;
grant execute on function public.ps_delete_preset(text, text) to anon, authenticated;
