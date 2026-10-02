-- Authenticated self-service account deletion. The caller can delete only itself.
create or replace function public.delete_own_account(p_confirmation text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_confirmation <> 'DELETE' then raise exception 'Confirmation required'; end if;
  delete from auth.users where id = auth.uid();
  if not found then raise exception 'Account not found'; end if;
end
$$;

revoke all on function public.delete_own_account(text) from public;
grant execute on function public.delete_own_account(text) to authenticated;
