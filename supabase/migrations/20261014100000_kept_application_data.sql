-- What a cancelled application leaves for the next draft (applications.cancel in mockApi.js): the Take Over and
-- Primary data the user typed and the documents they uploaded, in one column instead of the Take Over data alone.
-- The column grant follows the rename.
alter table public.profiles rename column takeover_kept to kept;
update public.profiles set kept = jsonb_build_object('takeover', kept) where kept is not null;

-- As in 20261009071328_app_data, with "kept" in place of "takeover_kept".
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
    "admin_notes": ["id", "application_id", "doc"]
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
