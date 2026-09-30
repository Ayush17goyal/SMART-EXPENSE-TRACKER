-- Pocketwise pilot schema. Apply with the Supabase CLI after reviewing the target project.
create extension if not exists pgcrypto;

create table public.pilot_invites (
  email text primary key check (email = lower(trim(email))),
  created_at timestamptz not null default now(),
  claimed_by uuid unique references auth.users(id) on delete set null,
  claimed_at timestamptz
);
alter table public.pilot_invites enable row level security;
-- Invite administration is service-role only: no client policies.

create table public.user_ledgers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ledger jsonb not null,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ledger_is_object check (jsonb_typeof(ledger) = 'object'),
  constraint ledger_version check ((ledger->>'version')::int = 1),
  constraint ledger_revision_matches check ((ledger->>'revision')::bigint = revision)
);
alter table public.user_ledgers enable row level security;
create policy "owners read their ledger" on public.user_ledgers for select using ((select auth.uid()) = user_id);
create policy "owners create their ledger" on public.user_ledgers for insert with check ((select auth.uid()) = user_id);
create policy "owners update their ledger" on public.user_ledgers for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "owners delete their ledger" on public.user_ledgers for delete using ((select auth.uid()) = user_id);

create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_date date not null default (now() at time zone 'Asia/Kolkata')::date,
  request_count integer not null default 0 check (request_count between 0 and 1000),
  primary key(user_id,bucket_date)
);
alter table public.ai_usage enable row level security;
-- Only the service role can read or update quota counters.

create or replace function public.claim_pilot_invite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.pilot_invites set claimed_by=new.id,claimed_at=now()
  where email=lower(new.email) and claimed_by is null;
  if not found then raise exception 'A valid pilot invitation is required'; end if;
  return new;
end $$;
create trigger require_pilot_invite before insert on auth.users for each row execute function public.claim_pilot_invite();

create or replace function public.save_ledger(p_ledger jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare current_revision bigint; next_revision bigint; result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if pg_column_size(p_ledger)>25000000 then raise exception 'Ledger exceeds 25 MB'; end if;
  select revision into current_revision from public.user_ledgers where user_id=auth.uid() for update;
  if found and current_revision<>p_expected_revision then raise exception 'Revision conflict'; end if;
  if not found and p_expected_revision<>0 then raise exception 'Revision conflict'; end if;
  next_revision:=p_expected_revision+1;
  result:=jsonb_set(p_ledger,'{revision}',to_jsonb(next_revision),true);
  insert into public.user_ledgers(user_id,ledger,revision) values(auth.uid(),result,next_revision)
  on conflict(user_id) do update set ledger=excluded.ledger,revision=excluded.revision,updated_at=now();
  return result;
end $$;
revoke all on function public.save_ledger(jsonb,bigint) from public;
grant execute on function public.save_ledger(jsonb,bigint) to authenticated;

create index user_ledgers_updated_idx on public.user_ledgers(updated_at);

-- Normalized analytical projections. These are populated by a later verified
-- migration/import job; the encrypted transport contract remains the versioned ledger.
create table public.transactions (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 occurred_on date not null, kind text not null check(kind in('expense','income','refund')),
 amount_paise bigint not null check(amount_paise>0), category_id text not null,
 merchant text not null check(length(merchant)<=120), description text not null default '',
 source text not null, exceptional boolean not null default false, refund_of uuid references public.transactions(id),
 schedule_id uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index transactions_owner_date_idx on public.transactions(user_id,occurred_on desc);
create index transactions_owner_category_date_idx on public.transactions(user_id,category_id,occurred_on desc);
alter table public.transactions enable row level security;
create policy "transaction owner access" on public.transactions for all using((select auth.uid())=user_id) with check((select auth.uid())=user_id);

create table public.financial_records (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 record_type text not null check(record_type in('category','budget','cash_checkpoint','scheduled_item','schedule_occurrence','financial_goal','goal_allocation','recurring_candidate','insight','notification','user_preference','import_batch','scenario')),
 record_key text not null, payload jsonb not null, occurred_on date, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,record_type,record_key)
);
create index financial_records_owner_type_idx on public.financial_records(user_id,record_type);
alter table public.financial_records enable row level security;
create policy "financial record owner access" on public.financial_records for all using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
