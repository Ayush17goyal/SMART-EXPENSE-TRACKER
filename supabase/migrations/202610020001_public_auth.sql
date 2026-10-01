-- Public production authentication, profiles, and stronger ownership constraints.
-- Apply after 202610010001_initial.sql.

drop trigger if exists require_pilot_invite on auth.users;
drop function if exists public.claim_pilot_invite();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 80),
  email text not null check (email = lower(trim(email))),
  avatar_url text,
  currency text not null default 'INR' check (currency = 'INR'),
  timezone text not null default 'Asia/Kolkata' check (timezone = 'Asia/Kolkata'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profile owners read" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profile owners update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.create_user_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,full_name,email,avatar_url)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),lower(coalesce(new.email,'')),new.raw_user_meta_data->>'avatar_url')
  on conflict(id) do update set
    email=excluded.email,
    full_name=case when public.profiles.full_name='' then excluded.full_name else public.profiles.full_name end,
    avatar_url=coalesce(public.profiles.avatar_url,excluded.avatar_url),
    updated_at=now();
  return new;
end $$;

create trigger create_profile_after_signup after insert or update of email,raw_user_meta_data on auth.users
for each row execute function public.create_user_profile();

insert into public.profiles(id,full_name,email,avatar_url)
select id,coalesce(raw_user_meta_data->>'full_name',raw_user_meta_data->>'name',''),lower(coalesce(email,'')),raw_user_meta_data->>'avatar_url'
from auth.users on conflict(id) do nothing;

-- A refund may only point to a transaction owned by the same user.
alter table public.transactions add constraint transactions_id_user_unique unique(id,user_id);
alter table public.transactions drop constraint if exists transactions_refund_of_fkey;
alter table public.transactions add constraint transactions_refund_owner_fkey foreign key(refund_of,user_id) references public.transactions(id,user_id);

create index if not exists profiles_email_idx on public.profiles(email);

