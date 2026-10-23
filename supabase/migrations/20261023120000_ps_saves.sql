-- Please Stop (merge defense) — one resumable run per signed-in player. Same rules as
-- the other ps_* objects: public schema, ps_ prefix, nothing outside ps_* is touched.
-- The table is read-only for clients; every write goes through ps_put_save / ps_end_save,
-- which use an optimistic revision (rev) so two devices cannot silently overwrite each other.

create table if not exists public.ps_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  run_id uuid not null,
  rev bigint not null check (rev >= 1),
  save jsonb not null check (jsonb_typeof(save) = 'object' and pg_column_size(save) <= 200000),
  in_wave boolean not null,
  device_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.ps_saves enable row level security;
drop policy if exists ps_saves_select on public.ps_saves;
create policy ps_saves_select on public.ps_saves
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.ps_saves from anon, authenticated;
grant select on public.ps_saves to authenticated;

-- Compare-and-set write. p_base_rev = 0 means "I expect no save yet" (insert, rev = 1);
-- otherwise the save is replaced only if run_id and rev still match. Any mismatch raises
-- PS409 so the client can resolve the conflict.
create or replace function public.ps_put_save(
  p_run_id uuid,
  p_base_rev bigint,
  p_save jsonb,
  p_in_wave boolean,
  p_device_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_rev bigint;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_base_rev = 0 then
    insert into public.ps_saves (user_id, run_id, rev, save, in_wave, device_id, updated_at)
    values (uid, p_run_id, 1, p_save, p_in_wave, p_device_id, now())
    on conflict (user_id) do nothing
    returning rev into new_rev;
  else
    update public.ps_saves
       set rev = rev + 1, save = p_save, in_wave = p_in_wave, device_id = p_device_id, updated_at = now()
     where user_id = uid and run_id = p_run_id and rev = p_base_rev
    returning rev into new_rev;
  end if;
  if new_rev is null then
    raise exception 'save conflict' using errcode = 'PS409';
  end if;
  return new_rev;
end;
$$;
revoke all on function public.ps_put_save(uuid, bigint, jsonb, boolean, uuid) from public, anon;
grant execute on function public.ps_put_save(uuid, bigint, jsonb, boolean, uuid) to authenticated;

-- Delete the player's save, but only if it still belongs to the run that ended.
-- Returns whether a row was removed.
create or replace function public.ps_end_save(p_run_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from public.ps_saves where user_id = uid and run_id = p_run_id;
  return found;
end;
$$;
revoke all on function public.ps_end_save(uuid) from public, anon;
grant execute on function public.ps_end_save(uuid) to authenticated;
