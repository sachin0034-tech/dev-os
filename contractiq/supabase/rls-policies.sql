-- =============================================================================
-- ContractIQ — security migration (Stage 7, /security-foundation)
--
-- Run once in Supabase Dashboard → SQL Editor on a database that already has
-- database.sql applied. Idempotent: safe to re-run.
--
-- 1. Sliding-window rate limiting (rate_limit_events + rate_limit_hit RPC),
--    replacing the fixed-window rate_limits / check_rate_limit objects.
-- 2. Row Level Security enabled on every table (re-asserted).
-- See docs/security/security-plan.md §3.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Sliding-window rate limiting
-- `subject` identifies who is limited: the user id for signed-in actions, or a
-- hashed IP / hashed email for unauthenticated auth endpoints (where no user
-- id exists yet). `user_id` is set when known (cascade-deleted with the user).
-- -----------------------------------------------------------------------------
create table if not exists public.rate_limit_events (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users (id) on delete cascade,
  subject     text        not null check (char_length(subject) between 1 and 200),
  action      text        not null check (char_length(action) between 1 and 64),
  created_at  timestamptz not null default now()
);

create index if not exists idx_rate_limit_events_lookup
  on public.rate_limit_events (subject, action, created_at desc);
create index if not exists idx_rate_limit_events_user
  on public.rate_limit_events (user_id, action, created_at desc);
create index if not exists idx_rate_limit_events_created
  on public.rate_limit_events (created_at);

alter table public.rate_limit_events enable row level security;
-- No user-facing policies — service role only.
revoke all on public.rate_limit_events from anon, authenticated;
grant all on public.rate_limit_events to service_role;

-- Atomic check-and-record. Returns 0 when allowed (and records the event),
-- otherwise the number of seconds until the oldest event leaves the window.
create or replace function public.rate_limit_hit(
  p_subject        text,
  p_user_id        uuid,
  p_action         text,
  p_limit          integer,
  p_window_seconds integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count  integer;
  v_oldest timestamptz;
begin
  -- Serialise concurrent requests for the same subject + action.
  perform pg_advisory_xact_lock(hashtextextended(p_subject || ':' || p_action, 0));

  select count(*), min(created_at)
    into v_count, v_oldest
    from public.rate_limit_events
   where subject = p_subject
     and action = p_action
     and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_limit then
    return greatest(
      1,
      ceil(extract(epoch from (v_oldest + make_interval(secs => p_window_seconds) - now())))::integer
    );
  end if;

  insert into public.rate_limit_events (user_id, subject, action)
  values (p_user_id, p_subject, p_action);
  return 0;
end;
$$;

revoke all on function public.rate_limit_hit(text, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, uuid, text, integer, integer) to service_role;

-- Retire the fixed-window limiter.
drop function if exists public.check_rate_limit(text, integer, integer);
drop table if exists public.rate_limits;

-- -----------------------------------------------------------------------------
-- 2. Row Level Security on every table (idempotent re-assertion)
-- -----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.contracts         enable row level security;
alter table public.custom_key_terms  enable row level security;
alter table public.key_terms         enable row level security;
alter table public.chat_sessions     enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.user_feedback     enable row level security;
alter table public.usage_events      enable row level security;
alter table public.rate_limit_events enable row level security;

-- Storage: the contracts bucket must stay private.
update storage.buckets set public = false where id = 'contracts';
