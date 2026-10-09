-- Auth foundation (spec 2026-10-09 §2–§3): profiles, consents, user_roles and shared helpers.
-- Every table: RLS on, inherited default grants revoked, then only the privileges the app needs.

create schema if not exists private;
revoke all on schema private from public;
-- supabase_auth_admin: GoTrue inserts into auth.users, which fires private.handle_new_user.
grant usage on schema private to authenticated, service_role, supabase_auth_admin;

-- Raises a domain error that src/data/supabase/errors.js maps to ApiError.
create or replace function private.fail(p_code text, p_message text, p_field_errors jsonb default '[]'::jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = p_message,
    detail = jsonb_build_object('code', p_code, 'fieldErrors', p_field_errors)::text;
end $$;

-- Optimistic concurrency (expectedVersion) for every table that carries `version`.
create or replace function private.bump_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;

-- ---------- tables ----------

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('super_admin', 'content_writer')),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  phone text,
  nik text check (nik is null or nik ~ '^[0-9]{16}$'),
  personal jsonb not null default '{}'::jsonb,
  finance jsonb not null default '{}'::jsonb,
  dashboard_layout jsonb,
  tours_seen text[] not null default '{}',
  takeover_kept jsonb,
  simulation jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('terms', 'privacy')),
  version text not null,
  accepted_at timestamptz not null default now(),
  constraint consents_once unique (user_id, type, version)
);

create trigger profiles_bump_version before update on public.profiles
  for each row execute function private.bump_version();

-- Reads the caller's own user_roles row (allowed by its RLS policy), so no SECURITY DEFINER is needed.
create or replace function private.has_role(p_role text)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = p_role)
$$;

-- Every new auth user gets a profile; the Google name is only a starting value, never used for authorization.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------- privileges ----------

alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.consents enable row level security;

revoke all on public.user_roles, public.profiles, public.consents from anon, authenticated;
grant all on public.user_roles, public.profiles, public.consents to service_role;
grant select on public.user_roles to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, nik, personal, finance, dashboard_layout, tours_seen, takeover_kept, simulation)
  on public.profiles to authenticated;
grant select, insert on public.consents to authenticated;

create policy user_roles_select_own on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.has_role('super_admin')));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy consents_select on public.consents for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('super_admin')));
create policy consents_insert_own on public.consents for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ---------- RPC ----------

-- Writes only what the user may write anyway (own name, own consents): SECURITY INVOKER keeps RLS in force.
create or replace function public.accept_consents(p_name text, p_terms boolean, p_privacy boolean, p_version text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_errors jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    perform private.fail('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.');
  end if;
  if char_length(btrim(coalesce(p_name, ''))) < 3 then
    v_errors := v_errors || jsonb_build_object('field', 'name', 'message', 'Nama minimal 3 huruf.');
  end if;
  if not coalesce(p_terms, false) then
    v_errors := v_errors || jsonb_build_object('field', 'acceptTerms', 'message', 'Centang persetujuan Syarat & Ketentuan untuk lanjut.');
  end if;
  if not coalesce(p_privacy, false) then
    v_errors := v_errors || jsonb_build_object('field', 'acceptPrivacy', 'message', 'Centang persetujuan Kebijakan Privasi untuk lanjut.');
  end if;
  if coalesce(p_version, '') = '' then
    v_errors := v_errors || jsonb_build_object('field', 'version', 'message', 'Versi persetujuan tidak dikenal.');
  end if;
  if jsonb_array_length(v_errors) > 0 then
    perform private.fail('VALIDATION_FAILED', 'Periksa kembali data kamu.', v_errors);
  end if;

  update public.profiles set full_name = btrim(p_name) where id = v_uid;
  insert into public.consents (user_id, type, version)
  values (v_uid, 'terms', p_version), (v_uid, 'privacy', p_version)
  on conflict on constraint consents_once do nothing;
end $$;

revoke all on function public.accept_consents(text, boolean, boolean, text) from public, anon;
grant execute on function public.accept_consents(text, boolean, boolean, text) to authenticated;

revoke all on all functions in schema private from public, anon;
grant execute on function private.fail(text, text, jsonb), private.has_role(text) to authenticated, service_role;
