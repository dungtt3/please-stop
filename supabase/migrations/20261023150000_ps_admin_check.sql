-- Admin gate for the /admin page: lets the client ask "is this the admin code?"
-- without exposing ps_check_admin (which raises on a wrong code and is not granted to clients).
create or replace function public.ps_admin_check(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.ps_check_admin(p_code);
  return true;
exception when sqlstate '28000' then
  return false;
end;
$$;

revoke all on function public.ps_admin_check(text) from public;
grant execute on function public.ps_admin_check(text) to anon, authenticated;
