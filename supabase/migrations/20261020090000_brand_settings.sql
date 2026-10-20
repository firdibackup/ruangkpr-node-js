-- Brand from the admin (spec 2026-10-20 brand CMS). Two rows: the draft only the super admin sees, and the published
-- brand every visitor reads, signed in or not, so the login page wears it too. No row = the look the files ship.
create table public.brand_settings (
  id text primary key check (id in ('draft', 'published')),
  doc jsonb not null
);

alter table public.brand_settings enable row level security;
revoke all on public.brand_settings from anon, authenticated;
grant all on public.brand_settings to service_role;
grant select on public.brand_settings to anon, authenticated;
grant insert, update, delete on public.brand_settings to authenticated;

-- anon has no access to schema private, so the published read is a policy of its own.
create policy brand_settings_select_published on public.brand_settings for select to anon, authenticated
  using (id = 'published');
create policy brand_settings_select_admin on public.brand_settings for select to authenticated
  using ((select private.has_role('super_admin')));
create policy brand_settings_insert on public.brand_settings for insert to authenticated
  with check ((select private.has_role('super_admin')));
create policy brand_settings_update on public.brand_settings for update to authenticated
  using ((select private.has_role('super_admin'))) with check ((select private.has_role('super_admin')));
create policy brand_settings_delete on public.brand_settings for delete to authenticated
  using ((select private.has_role('super_admin')));

-- Logo and favicon: a public bucket only the super admin writes, with the bank logos' limits.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('brand-assets', 'brand-assets', true, 1048576, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- {uuid}.{ext}; reading goes through the public URL. remove() needs select as well as delete.
create policy brand_assets_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'brand-assets' and (select private.has_role('super_admin')));
create policy brand_assets_select on storage.objects for select to authenticated using (
  bucket_id = 'brand-assets' and (select private.has_role('super_admin')));
create policy brand_assets_delete on storage.objects for delete to authenticated using (
  bucket_id = 'brand-assets' and (select private.has_role('super_admin')));

-- As in 20261016090000_cover_letters, with brand_settings writable.
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
    "cover_letters": ["id", "doc"],
    "brand_settings": ["id", "doc"]
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
