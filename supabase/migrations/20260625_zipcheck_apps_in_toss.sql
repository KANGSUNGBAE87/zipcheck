create extension if not exists pgcrypto;

create table if not exists public.core_users (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  default_locale text not null default 'ko',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.authmap_user_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.core_users (id) on delete cascade,
  provider text not null,
  provider_subject text not null,
  provider_metadata jsonb not null default '{}'::jsonb,
  linked_at timestamptz not null default now(),
  unlinked_at timestamptz,
  constraint authmap_user_identities_provider_check check (provider in ('toss', 'google', 'apple', 'kakao', 'github', 'anonymous')),
  constraint authmap_user_identities_provider_subject_unique unique (provider, provider_subject)
);

create table if not exists public.zipcheck_cases (
  id uuid primary key,
  owner_auth_user_id uuid not null references auth.users (id) on delete cascade,
  core_user_id uuid references public.core_users (id) on delete set null,
  template_id text not null,
  title text not null,
  active_phase_key text not null,
  reference_anchor_id text,
  completed boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_opened_at timestamptz not null,
  last_completed_at timestamptz,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.zipcheck_case_alerts (
  case_id uuid not null references public.zipcheck_cases (id) on delete cascade,
  alert_id text not null,
  owner_auth_user_id uuid not null references auth.users (id) on delete cascade,
  phase_key text not null,
  title_key text not null,
  detail_key text,
  status text not null check (status in ('pending', 'done', 'reference')),
  done_at timestamptz,
  memo_ids text[] not null default '{}',
  wrapped_label_safe boolean not null default true,
  position integer not null,
  primary key (case_id, alert_id)
);

create table if not exists public.zipcheck_memos (
  memo_id uuid primary key,
  case_id uuid not null references public.zipcheck_cases (id) on delete cascade,
  owner_auth_user_id uuid not null references auth.users (id) on delete cascade,
  target_type text not null check (target_type in ('case', 'alert')),
  target_id text not null,
  text text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  locale_at_write text not null check (locale_at_write in ('ko', 'en'))
);

create table if not exists public.zipcheck_events (
  id uuid primary key,
  case_id uuid references public.zipcheck_cases (id) on delete cascade,
  owner_auth_user_id uuid not null references auth.users (id) on delete cascade,
  alert_id text,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists public.zipcheck_guide_sources (
  id text primary key,
  title text not null,
  url text not null,
  source_type text not null,
  locale text not null default 'ko',
  updated_at timestamptz not null default now()
);

create table if not exists public.zipcheck_guide_entries (
  id text primary key,
  alert_id text not null,
  locale text not null default 'ko',
  title text not null,
  body text not null,
  is_published boolean not null default false,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.zipcheck_guide_entry_sources (
  guide_entry_id text not null references public.zipcheck_guide_entries (id) on delete cascade,
  source_id text not null references public.zipcheck_guide_sources (id) on delete cascade,
  primary key (guide_entry_id, source_id)
);

create table if not exists public.zipcheck_guide_branches (
  id text primary key,
  guide_entry_id text not null references public.zipcheck_guide_entries (id) on delete cascade,
  property_type text not null,
  body text not null,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.zipcheck_app_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_auth_user_id uuid not null references auth.users (id) on delete cascade,
  core_user_id uuid references public.core_users (id) on delete set null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  platform_referrer text,
  locale text check (locale in ('ko', 'en')),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.core_users enable row level security;
alter table public.authmap_user_identities enable row level security;
alter table public.zipcheck_cases enable row level security;
alter table public.zipcheck_case_alerts enable row level security;
alter table public.zipcheck_memos enable row level security;
alter table public.zipcheck_events enable row level security;
alter table public.zipcheck_guide_sources enable row level security;
alter table public.zipcheck_guide_entries enable row level security;
alter table public.zipcheck_guide_entry_sources enable row level security;
alter table public.zipcheck_guide_branches enable row level security;
alter table public.zipcheck_app_sessions enable row level security;

create index if not exists zipcheck_cases_owner_updated_idx on public.zipcheck_cases (owner_auth_user_id, updated_at desc);
create index if not exists zipcheck_alerts_owner_case_idx on public.zipcheck_case_alerts (owner_auth_user_id, case_id, position);
create index if not exists zipcheck_memos_owner_case_idx on public.zipcheck_memos (owner_auth_user_id, case_id, created_at);
create index if not exists zipcheck_events_owner_time_idx on public.zipcheck_events (owner_auth_user_id, occurred_at);
create index if not exists zipcheck_app_sessions_owner_seen_idx on public.zipcheck_app_sessions (owner_auth_user_id, last_seen_at desc);

grant select, insert, update, delete on public.zipcheck_cases to authenticated;
grant select, insert, update, delete on public.zipcheck_case_alerts to authenticated;
grant select, insert, update, delete on public.zipcheck_memos to authenticated;
grant select, insert, update on public.zipcheck_events to authenticated;
grant select, insert, update on public.zipcheck_app_sessions to authenticated;
grant select on public.zipcheck_guide_sources to anon, authenticated;
grant select on public.zipcheck_guide_entries to anon, authenticated;
grant select on public.zipcheck_guide_entry_sources to anon, authenticated;
grant select on public.zipcheck_guide_branches to anon, authenticated;
grant select, insert, update on public.core_users to service_role;
grant select, insert, update on public.authmap_user_identities to service_role;

drop policy if exists "zipcheck cases select own" on public.zipcheck_cases;
create policy "zipcheck cases select own"
  on public.zipcheck_cases for select to authenticated
  using (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck cases insert own" on public.zipcheck_cases;
create policy "zipcheck cases insert own"
  on public.zipcheck_cases for insert to authenticated
  with check (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck cases update own" on public.zipcheck_cases;
create policy "zipcheck cases update own"
  on public.zipcheck_cases for update to authenticated
  using (owner_auth_user_id = auth.uid())
  with check (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck cases delete own" on public.zipcheck_cases;
create policy "zipcheck cases delete own"
  on public.zipcheck_cases for delete to authenticated
  using (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck alerts select own" on public.zipcheck_case_alerts;
create policy "zipcheck alerts select own"
  on public.zipcheck_case_alerts for select to authenticated
  using (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck alerts insert own" on public.zipcheck_case_alerts;
create policy "zipcheck alerts insert own"
  on public.zipcheck_case_alerts for insert to authenticated
  with check (
    owner_auth_user_id = auth.uid()
    and exists (
      select 1 from public.zipcheck_cases
      where zipcheck_cases.id = zipcheck_case_alerts.case_id
        and zipcheck_cases.owner_auth_user_id = auth.uid()
    )
  );

drop policy if exists "zipcheck alerts update own" on public.zipcheck_case_alerts;
create policy "zipcheck alerts update own"
  on public.zipcheck_case_alerts for update to authenticated
  using (owner_auth_user_id = auth.uid())
  with check (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck alerts delete own" on public.zipcheck_case_alerts;
create policy "zipcheck alerts delete own"
  on public.zipcheck_case_alerts for delete to authenticated
  using (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck memos select own" on public.zipcheck_memos;
create policy "zipcheck memos select own"
  on public.zipcheck_memos for select to authenticated
  using (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck memos insert own" on public.zipcheck_memos;
create policy "zipcheck memos insert own"
  on public.zipcheck_memos for insert to authenticated
  with check (
    owner_auth_user_id = auth.uid()
    and exists (
      select 1 from public.zipcheck_cases
      where zipcheck_cases.id = zipcheck_memos.case_id
        and zipcheck_cases.owner_auth_user_id = auth.uid()
    )
  );

drop policy if exists "zipcheck memos update own" on public.zipcheck_memos;
create policy "zipcheck memos update own"
  on public.zipcheck_memos for update to authenticated
  using (owner_auth_user_id = auth.uid())
  with check (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck memos delete own" on public.zipcheck_memos;
create policy "zipcheck memos delete own"
  on public.zipcheck_memos for delete to authenticated
  using (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck events select own" on public.zipcheck_events;
create policy "zipcheck events select own"
  on public.zipcheck_events for select to authenticated
  using (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck events insert own" on public.zipcheck_events;
create policy "zipcheck events insert own"
  on public.zipcheck_events for insert to authenticated
  with check (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck events update own" on public.zipcheck_events;
create policy "zipcheck events update own"
  on public.zipcheck_events for update to authenticated
  using (owner_auth_user_id = auth.uid())
  with check (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck app sessions select own" on public.zipcheck_app_sessions;
create policy "zipcheck app sessions select own"
  on public.zipcheck_app_sessions for select to authenticated
  using (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck app sessions insert own" on public.zipcheck_app_sessions;
create policy "zipcheck app sessions insert own"
  on public.zipcheck_app_sessions for insert to authenticated
  with check (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck app sessions update own" on public.zipcheck_app_sessions;
create policy "zipcheck app sessions update own"
  on public.zipcheck_app_sessions for update to authenticated
  using (owner_auth_user_id = auth.uid())
  with check (owner_auth_user_id = auth.uid());

drop policy if exists "zipcheck guide sources published read" on public.zipcheck_guide_sources;
create policy "zipcheck guide sources published read"
  on public.zipcheck_guide_sources for select to anon, authenticated
  using (
    exists (
      select 1
      from public.zipcheck_guide_entry_sources
      join public.zipcheck_guide_entries on zipcheck_guide_entries.id = zipcheck_guide_entry_sources.guide_entry_id
      where zipcheck_guide_entry_sources.source_id = zipcheck_guide_sources.id
        and zipcheck_guide_entries.is_published
    )
  );

drop policy if exists "zipcheck guide entries published read" on public.zipcheck_guide_entries;
create policy "zipcheck guide entries published read"
  on public.zipcheck_guide_entries for select to anon, authenticated
  using (is_published);

drop policy if exists "zipcheck guide entry sources published read" on public.zipcheck_guide_entry_sources;
create policy "zipcheck guide entry sources published read"
  on public.zipcheck_guide_entry_sources for select to anon, authenticated
  using (
    exists (
      select 1 from public.zipcheck_guide_entries
      where zipcheck_guide_entries.id = zipcheck_guide_entry_sources.guide_entry_id
        and zipcheck_guide_entries.is_published
    )
  );

drop policy if exists "zipcheck guide branches published read" on public.zipcheck_guide_branches;
create policy "zipcheck guide branches published read"
  on public.zipcheck_guide_branches for select to anon, authenticated
  using (is_published);
