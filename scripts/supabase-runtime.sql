-- Run in the selected Supabase project, after an encrypted backup.
-- Existing operational rows are preserved. This SQL does not create demo users.
begin;
create table if not exists public.app_state (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.app_state add column if not exists updated_at timestamptz not null default clock_timestamp();
alter table public.app_state enable row level security;
revoke all on public.app_state from anon, authenticated;
grant select, insert, update on public.app_state to service_role;
commit;
