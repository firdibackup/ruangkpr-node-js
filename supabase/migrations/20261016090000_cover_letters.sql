-- Surat pengantar per pengajuan (spec 2026-10-16). Only super admins read or write a letter, and only while its
-- application is at the bank or later. Kept out of applications.doc: the applicant reads that row and may rewrite it
-- as a draft after a rejection.
create table public.cover_letters (
  id text primary key references public.applications (id) on delete cascade,
  doc jsonb not null
);

alter table public.cover_letters enable row level security;
revoke all on public.cover_letters from anon, authenticated;
grant all on public.cover_letters to service_role;
grant select, insert, update on public.cover_letters to authenticated;

create policy cover_letters_select on public.cover_letters for select to authenticated
  using ((select private.has_role('super_admin')));
create policy cover_letters_insert on public.cover_letters for insert to authenticated
  with check ((select private.has_role('super_admin')) and exists (
    select 1 from public.applications a
     where a.id = cover_letters.id
       and a.status in ('bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad', 'disbursed')));
create policy cover_letters_update on public.cover_letters for update to authenticated
  using ((select private.has_role('super_admin')))
  with check ((select private.has_role('super_admin')) and exists (
    select 1 from public.applications a
     where a.id = cover_letters.id
       and a.status in ('bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad', 'disbursed')));

-- As in 20261014100000_kept_application_data, with cover_letters writable.
create or replace function public.apply_writes(p_ops jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_op jsonb;
  v_table text;
  v_cols text;
  v_key text;
  v_count integer;
  -- Writable columns per table; anything else in `values` is ignored.
  v_allowed constant jsonb := '{
    "applications": ["id", "user_id", "doc"],
    "mortgages": ["id", "user_id", "doc"],
    "activities": ["id", "user_id", "doc"],
    "profiles": ["full_name", "phone", "nik", "personal", "finance", "dashboard_layout", "tours_seen", "kept", "simulation"],
    "banks": ["id", "doc"],
    "bank_products": ["id", "doc"],
    "articles": ["id", "doc"],
    "app_config": ["id", "doc"],
    "health_configs": ["version", "doc"],
    "audit_log": ["id", "doc"],
    "admin_notes": ["id", "application_id", "doc"],
    "cover_letters": ["id", "doc"]
  }';
  v_versioned constant text[] := array['applications', 'mortgages', 'profiles'];
begin
  for v_op in select value from jsonb_array_elements(p_ops) loop
    v_table := v_op ->> 'table';
    if not v_allowed ? v_table then
      perform private.fail('VALIDATION_FAILED', 'Data tidak dikenal.');
    end if;
    select string_agg(format('%I', k), ', ') into v_cols
      from jsonb_object_keys(coalesce(v_op -> 'values', '{}'::jsonb)) k where (v_allowed -> v_table) ? k;
    v_key := case v_table when 'profiles' then 'id = $2::uuid' when 'app_config' then 'id = $2::integer' else 'id = $2' end;

    if v_op ->> 'op' = 'insert' then
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)', v_table, v_cols, v_cols, v_table)
        using v_op -> 'values';
    elsif v_op ->> 'op' = 'update' then
      execute format('update public.%I set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where %s%s',
                     v_table, v_cols, v_cols, v_table, v_key,
                     case when v_table = any (v_versioned) and v_op ? 'version' then ' and version = $3' else '' end)
        using v_op -> 'values', v_op ->> 'id', (v_op ->> 'version')::integer;
      get diagnostics v_count = row_count;
      if v_count = 0 then
        execute format('select count(*) from public.%I where %s', v_table, v_key) into v_count using null::jsonb, v_op ->> 'id';
        if v_count = 0 then perform private.fail('FORBIDDEN', 'Halaman ini di luar akses akun kamu.'); end if;
        perform private.fail('CONFLICT_VERSION', 'Data ini sudah diubah sejak kamu buka. Muat ulang lalu ulangi.');
      end if;
    elsif v_op ->> 'op' = 'delete' then
      execute format('delete from public.%I where %s', v_table, v_key) using null::jsonb, v_op ->> 'id';
    else
      perform private.fail('VALIDATION_FAILED', 'Operasi tidak dikenal.');
    end if;
  end loop;
end $$;
