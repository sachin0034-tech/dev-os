-- =============================================================================
-- database.sql — ContractIQ complete database setup
--
-- Run once: Supabase Dashboard → SQL Editor → New query → paste this file → Run.
-- Safe to re-run (idempotent). Requires Supabase Postgres 15+.
--
-- Single source of truth: docs/specs/supabase-schema.sql (this file is a copy;
-- also mirrored at supabase/migrations/20261011000000_initial_schema.sql).
-- Covers: enums, 9 tables, indexes, updated_at triggers, profile-creation
-- trigger, custom-term limit, immutable AI values, replace_key_terms and
-- rate_limit_hit RPCs, 2 views, RLS policies on every table, column-level
-- grants, and the private `contracts` Storage bucket with per-user policies.
-- =============================================================================

-- =============================================================================
-- ContractIQ — Supabase schema (paste-and-run)
-- Source: docs/engineering/engineering-doc.md §7, docs/specs/database.md
--
-- How to run: Supabase Dashboard → SQL Editor → New query → paste this whole
-- file → Run. Safe to re-run: uses IF NOT EXISTS / OR REPLACE / DROP … IF EXISTS.
-- Target: Supabase Postgres 15+.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;  -- gen_random_uuid(), digest()


-- -----------------------------------------------------------------------------
-- 2. Enum types
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.contract_type as enum ('NDA', 'MSA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contract_status as enum ('uploading', 'ready', 'processing', 'completed', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.chat_role as enum ('user', 'assistant');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.usage_event_type as enum ('extraction', 'chat');
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- 3. Shared trigger function: updated_at
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. Tables (dependency order)
-- -----------------------------------------------------------------------------

-- 4.1 profiles ---------------------------------------------------------------
create table if not exists public.profiles (
  id                       uuid primary key references auth.users (id) on delete cascade,
  email                    text not null,
  full_name                text check (full_name is null or char_length(full_name) <= 120),
  plan                     text not null default 'trial'
                           check (plan in ('trial', 'starter', 'growth', 'pro')),
  trial_ends_at            timestamptz not null default (now() + interval '14 days'),
  onboarding_completed_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- 4.2 contracts --------------------------------------------------------------
create table if not exists public.contracts (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users (id) on delete cascade,
  file_name                text not null check (char_length(file_name) between 1 and 120),
  file_size_bytes          integer not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  contract_type            public.contract_type not null,
  status                   public.contract_status not null default 'uploading',
  contract_text            text,
  page_count               smallint check (page_count between 1 and 20),
  word_count               integer check (word_count >= 100),
  token_count              integer check (token_count > 0 and token_count <= 15000),
  file_path                text,
  error_code               text,
  error_message            text,
  prompt_version           text,
  processing_started_at    timestamptz,
  processing_completed_at  timestamptz,
  processing_ms            integer check (processing_ms is null or processing_ms >= 0),
  last_accessed_at         timestamptz not null default now(),
  pdf_deleted_at           timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint contracts_text_after_upload
    check (status = 'uploading' or contract_text is not null)
);

-- 4.3 custom_key_terms -------------------------------------------------------
create table if not exists public.custom_key_terms (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references public.contracts (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  term_name    text not null check (char_length(btrim(term_name)) between 2 and 80),
  created_at   timestamptz not null default now()
);

-- 4.4 key_terms --------------------------------------------------------------
create table if not exists public.key_terms (
  id                uuid primary key default gen_random_uuid(),
  contract_id       uuid not null references public.contracts (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  term_name         text not null check (char_length(term_name) between 1 and 80),
  term_key          text not null check (term_key ~ '^[a-z0-9_]{1,100}$'),
  value             text check (value is null or char_length(value) <= 2000),
  original_value    text check (original_value is null or char_length(original_value) <= 2000),
  page_number       smallint check (page_number is null or page_number >= 1),
  confidence_score  smallint not null check (confidence_score between 0 and 100),
  source_sentence   text check (source_sentence is null or char_length(source_sentence) <= 1000),
  is_custom         boolean not null default false,
  is_edited         boolean not null default false,
  edited_at         timestamptz,
  display_order     smallint not null,
  validation_flags  text[] not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint key_terms_contract_term_key_unique unique (contract_id, term_key)
);

-- 4.5 chat_sessions ----------------------------------------------------------
create table if not exists public.chat_sessions (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null unique references public.contracts (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 4.6 chat_messages ----------------------------------------------------------
create table if not exists public.chat_messages (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.chat_sessions (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  role               public.chat_role not null,
  content            text not null check (char_length(content) between 1 and 8000),
  cited_pages        smallint[] not null default '{}',
  missing_citation   boolean not null default false,
  query_type         text check (query_type is null or query_type in ('contract', 'history', 'both')),
  is_partial         boolean not null default false,
  prompt_tokens      integer,
  completion_tokens  integer,
  created_at         timestamptz not null default now()
);

-- 4.7 user_feedback ----------------------------------------------------------
create table if not exists public.user_feedback (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references public.contracts (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  rating       smallint not null check (rating in (-1, 1)),
  comment      text check (comment is null or char_length(comment) <= 1000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint user_feedback_contract_user_unique unique (contract_id, user_id)
);

-- 4.8 usage_events -----------------------------------------------------------
create table if not exists public.usage_events (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  contract_id        uuid references public.contracts (id) on delete set null,
  event_type         public.usage_event_type not null,
  model              text not null,
  prompt_version     text,
  prompt_tokens      integer not null default 0 check (prompt_tokens >= 0),
  completion_tokens  integer not null default 0 check (completion_tokens >= 0),
  cost_usd           numeric(10, 6) not null default 0 check (cost_usd >= 0),
  latency_ms         integer check (latency_ms is null or latency_ms >= 0),
  success            boolean not null,
  error_code         text,
  created_at         timestamptz not null default now()
);

-- 4.9 rate_limit_events (sliding-window rate limiting, service role only) ------
create table if not exists public.rate_limit_events (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users (id) on delete cascade,
  subject     text        not null check (char_length(subject) between 1 and 200),
  action      text        not null check (char_length(action) between 1 and 64),
  created_at  timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- 5. Indexes
-- -----------------------------------------------------------------------------
create index if not exists contracts_user_created_idx
  on public.contracts (user_id, created_at desc);
create index if not exists contracts_user_type_idx
  on public.contracts (user_id, contract_type);
create index if not exists contracts_retention_idx
  on public.contracts (last_accessed_at) where file_path is not null;
create index if not exists contracts_status_idx
  on public.contracts (status) where status in ('uploading', 'processing');

create unique index if not exists custom_key_terms_contract_name_unique
  on public.custom_key_terms (contract_id, lower(btrim(term_name)));
create index if not exists custom_key_terms_contract_idx
  on public.custom_key_terms (contract_id);

create index if not exists key_terms_contract_order_idx
  on public.key_terms (contract_id, display_order);
create index if not exists key_terms_edited_idx
  on public.key_terms (edited_at) where is_edited;

create index if not exists chat_sessions_user_idx
  on public.chat_sessions (user_id);
create index if not exists chat_messages_session_created_idx
  on public.chat_messages (session_id, created_at);

create index if not exists user_feedback_user_idx
  on public.user_feedback (user_id);

create index if not exists usage_events_quota_idx
  on public.usage_events (user_id, event_type, created_at) where success;
create index if not exists usage_events_created_idx
  on public.usage_events (created_at);

create index if not exists idx_rate_limit_events_lookup
  on public.rate_limit_events (subject, action, created_at desc);
create index if not exists idx_rate_limit_events_user
  on public.rate_limit_events (user_id, action, created_at desc);
create index if not exists idx_rate_limit_events_created
  on public.rate_limit_events (created_at);


-- -----------------------------------------------------------------------------
-- 6. updated_at triggers (every table with updated_at)
-- -----------------------------------------------------------------------------
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists contracts_set_updated_at on public.contracts;
create trigger contracts_set_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

drop trigger if exists key_terms_set_updated_at on public.key_terms;
create trigger key_terms_set_updated_at
  before update on public.key_terms
  for each row execute function public.set_updated_at();

drop trigger if exists chat_sessions_set_updated_at on public.chat_sessions;
create trigger chat_sessions_set_updated_at
  before update on public.chat_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists user_feedback_set_updated_at on public.user_feedback;
create trigger user_feedback_set_updated_at
  before update on public.user_feedback
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 7. Domain triggers & functions
-- -----------------------------------------------------------------------------

-- 7.1 Create a profile for every new auth user --------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7.2 Max 5 custom terms per contract (serialised per contract) ---------------
create or replace function public.enforce_custom_term_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Lock the parent contract row so concurrent inserts are serialised.
  perform 1 from public.contracts where id = new.contract_id for update;

  if (select count(*) from public.custom_key_terms where contract_id = new.contract_id) >= 5 then
    raise exception 'CUSTOM_TERM_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists custom_key_terms_enforce_limit on public.custom_key_terms;
create trigger custom_key_terms_enforce_limit
  before insert on public.custom_key_terms
  for each row execute function public.enforce_custom_term_limit();

-- 7.3 Immutable columns on key_terms (original AI value is never overwritten) -
create or replace function public.protect_key_term_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.original_value := old.original_value;
  new.term_key       := old.term_key;
  new.term_name      := old.term_name;
  new.contract_id    := old.contract_id;
  new.user_id        := old.user_id;
  new.is_custom      := old.is_custom;
  return new;
end;
$$;

drop trigger if exists key_terms_protect_columns on public.key_terms;
create trigger key_terms_protect_columns
  before update on public.key_terms
  for each row execute function public.protect_key_term_columns();

-- 7.4 Atomically replace all key terms for a contract (service role only) -----
create or replace function public.replace_key_terms(
  p_contract_id uuid,
  p_user_id     uuid,
  p_terms       jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  if not exists (
    select 1 from public.contracts where id = p_contract_id and user_id = p_user_id
  ) then
    raise exception 'CONTRACT_NOT_FOUND' using errcode = 'P0002';
  end if;

  delete from public.key_terms where contract_id = p_contract_id;

  insert into public.key_terms (
    contract_id, user_id, term_name, term_key, value, original_value,
    page_number, confidence_score, source_sentence, is_custom,
    display_order, validation_flags
  )
  select
    p_contract_id, p_user_id, t.term_name, t.term_key, t.value, t.value,
    t.page_number, t.confidence_score, t.source_sentence, coalesce(t.is_custom, false),
    t.display_order, coalesce(t.validation_flags, '{}')
  from jsonb_to_recordset(p_terms) as t(
    term_name        text,
    term_key         text,
    value            text,
    page_number      smallint,
    confidence_score smallint,
    source_sentence  text,
    is_custom        boolean,
    display_order    smallint,
    validation_flags text[]
  );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

-- 7.5 Sliding-window rate limiter (service role only) -------------------------
-- Returns 0 when allowed (and records the event), otherwise seconds until retry.
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


-- -----------------------------------------------------------------------------
-- 8. Views (security_invoker → caller's RLS applies)
-- -----------------------------------------------------------------------------
create or replace view public.term_corrections
with (security_invoker = true) as
select
  kt.id,
  kt.user_id,
  kt.contract_id,
  c.contract_type,
  kt.term_key,
  kt.original_value,
  kt.value          as corrected_value,
  kt.confidence_score,
  kt.edited_at
from public.key_terms kt
join public.contracts c on c.id = kt.contract_id
where kt.is_edited;

create or replace view public.contract_list_items
with (security_invoker = true) as
select
  c.id,
  c.user_id,
  c.file_name,
  c.contract_type,
  c.status,
  c.page_count,
  c.processing_started_at,
  c.processing_completed_at,
  c.created_at,
  coalesce(lc.low_confidence_count, 0)::integer as low_confidence_count
from public.contracts c
left join lateral (
  select count(*) as low_confidence_count
  from public.key_terms kt
  where kt.contract_id = c.id and kt.confidence_score < 50
) lc on true
where c.status <> 'uploading';


-- -----------------------------------------------------------------------------
-- 9. Row Level Security — enable on every table
-- -----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.contracts         enable row level security;
alter table public.custom_key_terms  enable row level security;
alter table public.key_terms         enable row level security;
alter table public.chat_sessions     enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.user_feedback     enable row level security;
alter table public.usage_events      enable row level security;
alter table public.rate_limit_events enable row level security;  -- no policies: service role only


-- -----------------------------------------------------------------------------
-- 10. RLS policies
-- -----------------------------------------------------------------------------

-- profiles
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- contracts
drop policy if exists contracts_select_own on public.contracts;
create policy contracts_select_own on public.contracts
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists contracts_insert_own on public.contracts;
create policy contracts_insert_own on public.contracts
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists contracts_update_own on public.contracts;
create policy contracts_update_own on public.contracts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists contracts_delete_own on public.contracts;
create policy contracts_delete_own on public.contracts
  for delete to authenticated using (user_id = (select auth.uid()));

-- custom_key_terms
drop policy if exists custom_key_terms_select_own on public.custom_key_terms;
create policy custom_key_terms_select_own on public.custom_key_terms
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists custom_key_terms_insert_own on public.custom_key_terms;
create policy custom_key_terms_insert_own on public.custom_key_terms
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id and c.user_id = (select auth.uid())
    )
  );

drop policy if exists custom_key_terms_delete_own on public.custom_key_terms;
create policy custom_key_terms_delete_own on public.custom_key_terms
  for delete to authenticated using (user_id = (select auth.uid()));

-- key_terms (inserts/deletes only via replace_key_terms or cascade)
drop policy if exists key_terms_select_own on public.key_terms;
create policy key_terms_select_own on public.key_terms
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists key_terms_update_own on public.key_terms;
create policy key_terms_update_own on public.key_terms
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- chat_sessions
drop policy if exists chat_sessions_select_own on public.chat_sessions;
create policy chat_sessions_select_own on public.chat_sessions
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists chat_sessions_insert_own on public.chat_sessions;
create policy chat_sessions_insert_own on public.chat_sessions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id and c.user_id = (select auth.uid())
    )
  );

-- chat_messages (users may only insert their own 'user' messages)
drop policy if exists chat_messages_select_own on public.chat_messages;
create policy chat_messages_select_own on public.chat_messages
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists chat_messages_insert_own_user_role on public.chat_messages;
create policy chat_messages_insert_own_user_role on public.chat_messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'user'
    and exists (
      select 1 from public.chat_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );

-- user_feedback
drop policy if exists user_feedback_select_own on public.user_feedback;
create policy user_feedback_select_own on public.user_feedback
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists user_feedback_insert_own on public.user_feedback;
create policy user_feedback_insert_own on public.user_feedback
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.contracts c
      where c.id = contract_id and c.user_id = (select auth.uid())
    )
  );

drop policy if exists user_feedback_update_own on public.user_feedback;
create policy user_feedback_update_own on public.user_feedback
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- usage_events (read-only for users; writes via service role)
drop policy if exists usage_events_select_own on public.usage_events;
create policy usage_events_select_own on public.usage_events
  for select to authenticated using (user_id = (select auth.uid()));


-- -----------------------------------------------------------------------------
-- 11. Privileges (defence in depth on top of RLS)
-- -----------------------------------------------------------------------------

-- Baseline grants. Explicit so the schema works even on projects where
-- "automatically expose new tables" is turned off; RLS still restricts rows.
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on
  public.profiles, public.contracts, public.custom_key_terms, public.key_terms,
  public.chat_sessions, public.chat_messages, public.user_feedback, public.usage_events
  to authenticated;
grant select on public.term_corrections, public.contract_list_items to authenticated;

-- No anonymous access to any app table or view.
revoke all on all tables in schema public from anon;

-- profiles: users may only change cosmetic/onboarding columns (not plan/trial).
revoke update on public.profiles from authenticated;
grant  update (full_name, onboarding_completed_at) on public.profiles to authenticated;

-- contracts: status/text/timings are server-managed.
revoke update on public.contracts from authenticated;
grant  update (file_name, last_accessed_at) on public.contracts to authenticated;

-- key_terms: users may only edit the value.
revoke insert, delete on public.key_terms from authenticated;
revoke update on public.key_terms from authenticated;
grant  update (value, is_edited, edited_at) on public.key_terms to authenticated;

-- chat: messages are append-only.
revoke update, delete on public.chat_messages from authenticated;
revoke update, delete on public.chat_sessions from authenticated;

-- usage ledger & rate limits: server only.
revoke insert, update, delete on public.usage_events from authenticated;
revoke all on public.rate_limit_events from authenticated;

-- Server-only functions.
revoke all on function public.replace_key_terms(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_key_terms(uuid, uuid, jsonb) to service_role;

revoke all on function public.rate_limit_hit(text, uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, uuid, text, integer, integer) to service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.enforce_custom_term_limit() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 12. Storage: private bucket for contract PDFs
--     Object key: {user_id}/{contract_id}/source.pdf
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contracts', 'contracts', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists contracts_objects_insert_own on storage.objects;
create policy contracts_objects_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists contracts_objects_select_own on storage.objects;
create policy contracts_objects_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists contracts_objects_delete_own on storage.objects;
create policy contracts_objects_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'contracts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- =============================================================================
-- End of schema
-- =============================================================================
