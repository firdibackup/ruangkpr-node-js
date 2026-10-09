-- App data (spec 2026-10-09, Amandemen): one row per mockApi.js entity. `doc` holds the object exactly as the app
-- logic keeps it; promoted columns are derived from `doc` by trigger (never trusted from the client) and drive RLS,
-- constraints and the status rules. Writes from the app go through public.apply_writes: one transaction, RLS on.

-- ---------- helpers ----------

-- Reads user_roles for the caller only; SECURITY DEFINER so policies on user_roles itself can use it.
create or replace function private.has_role(p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = p_role)
$$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()))
$$;

-- Migrations, SECURITY DEFINER code and secret-key scripts skip the per-user rules below.
create or replace function private.trusted()
returns boolean language sql stable set search_path = '' as $$
  select current_user in ('postgres', 'service_role', 'supabase_admin')
$$;

-- Data writes wait until the user has agreed to the S&K and privacy text (/welcome).
create or replace function private.has_consented()
returns boolean language sql stable set search_path = '' as $$
  select count(distinct c.type) = 2 from public.consents c where c.user_id = (select auth.uid())
$$;

create or replace function private.today()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Jakarta')::date
$$;

-- Same matrix as NEXT_STATUS / allowedTransitions in mockApi.js.
create or replace function private.next_status_ok(p_from text, p_to text, p_type text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(case p_from
    when 'submitted' then p_to = 'docs_verification'
    when 'docs_verification' then p_to in ('additional_docs_requested', 'bank_processing')
    when 'bank_processing' then p_to in ('appraisal', 'rejected')
    when 'appraisal' then p_to in ('approved', 'rejected')
    when 'approved' then p_to = case when p_type = 'takeover' then 'old_mortgage_settlement' else 'akad' end
    when 'old_mortgage_settlement' then p_to = 'akad'
    when 'akad' then p_to = 'disbursed'
  end, false)
$$;

-- The `required: true` documents of requiredDocuments() in documentRules.js.
create or replace function private.required_documents(p_doc jsonb)
returns text[] language sql immutable set search_path = '' as $$
  select case when p_doc ->> 'productType' = 'primary'
    then array['ktp', 'npwp', 'income_proof', 'property_document']
    else array['ktp', 'family_card', 'npwp']
      || case when p_doc #>> '{data,personal,maritalStatus}' = 'married' then array['marriage_document'] else '{}'::text[] end
      || array['income_proof', 'bank_statement', 'old_loan_agreement', 'outstanding_letter', 'latest_payment_proof', 'certificate', 'building_permit', 'land_tax']
  end
$$;

-- ---------- tables ----------

create table public.applications (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'draft',
  product_type text not null default 'primary',
  superseded boolean not null default false,
  doc jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- activeApplication(): one application in progress per user.
create unique index applications_one_active on public.applications (user_id)
  where status <> 'disbursed' and not (status = 'rejected' and superseded);

create table public.mortgages (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'draft',
  doc jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index mortgages_one_active on public.mortgages (user_id) where status = 'active';

create table public.activities (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  doc jsonb not null,
  occurred_at timestamptz not null default now(),
  read_at timestamptz
);
create index activities_user on public.activities (user_id, occurred_at desc);

create table public.banks (
  id text primary key,
  active boolean not null default true,
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.bank_products (
  id text primary key,
  bank_id text,
  status text not null default 'draft',
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.articles (
  id text primary key,
  slug text not null unique,
  status text not null default 'draft',
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.app_config (
  id integer primary key default 1 check (id = 1),
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.health_configs (
  version integer primary key,
  doc jsonb not null,
  published_at timestamptz not null default now()
);

create table public.audit_log (
  id text primary key,
  actor_id uuid not null default auth.uid(),
  doc jsonb not null,
  occurred_at timestamptz not null default now()
);

create table public.admin_notes (
  id text primary key,
  application_id text not null references public.applications (id) on delete cascade,
  author_id uuid not null default auth.uid(),
  doc jsonb not null,
  created_at timestamptz not null default now()
);

-- ---------- triggers: promote from doc + status rules ----------

create or replace function private.check_submit(p_doc jsonb)
returns void language plpgsql stable set search_path = '' as $$
declare
  v_sel jsonb := p_doc -> 'selection';
  v_product jsonb;
  v_bank_active boolean;
  v_fixed integer;
  v_floating integer;
begin
  if not coalesce((p_doc #>> '{consents,dataAccuracy}')::boolean, false) or not coalesce((p_doc #>> '{consents,sendToBank}')::boolean, false) then
    perform private.fail('CONSENT_REQUIRED', 'Centang kedua persetujuan untuk submit.');
  end if;
  if coalesce(p_doc #>> '{data,personal,nik}', '') !~ '^[0-9]{16}$' then
    perform private.fail('VALIDATION_FAILED', 'Data pribadi belum lengkap.');
  end if;
  select p.doc, coalesce(b.active, false) into v_product, v_bank_active
    from public.bank_products p left join public.banks b on b.id = p.bank_id
   where p.id = v_sel ->> 'bankProductId';
  -- The chosen program must still be on offer, unchanged, at the catalog's own rates.
  select (r ->> 'rateBps')::integer into v_fixed from jsonb_array_elements(v_product -> 'ratePeriods') r where r ->> 'type' = 'fixed' limit 1;
  select (r ->> 'rateBps')::integer into v_floating from jsonb_array_elements(v_product -> 'ratePeriods') r where r ->> 'type' = 'floating' limit 1;
  if v_sel is null or v_product is null or v_product ->> 'status' <> 'published' or not v_bank_active
     or (v_product ->> 'effectiveFrom')::date > private.today() or (v_product ->> 'effectiveUntil')::date < private.today()
     or (v_product ->> 'version')::integer is distinct from (v_sel ->> 'productVersion')::integer
     or (v_sel ->> 'fixedRateBps')::integer is distinct from v_fixed
     or (v_sel ->> 'floatingRateBps')::integer is distinct from v_floating then
    perform private.fail('BANK_PRODUCT_EXPIRED', 'Program yang dipilih sudah berubah. Bandingkan ulang sebelum submit.');
  end if;
  if exists (select 1 from unnest(private.required_documents(p_doc)) t
              where coalesce(p_doc #>> array['documents', t, 'status'], '') not in ('uploaded', 'verified')) then
    perform private.fail('DOCUMENTS_INCOMPLETE', 'Lengkapi dokumen wajib sebelum submit.');
  end if;
end $$;

create or replace function private.applications_write()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  -- What a re-upload the bank asked for may touch (recordDocument in mockApi.js).
  v_reupload text[] := array['status', 'statusHistory', 'pendingActions', 'documents', 'updatedAt', 'version'];
  v_flag text[] := array['superseded', 'updatedAt', 'version'];
begin
  new.status := coalesce(new.doc ->> 'status', 'draft');
  new.product_type := coalesce(new.doc ->> 'productType', 'primary');
  new.superseded := coalesce((new.doc ->> 'superseded')::boolean, false);
  new.doc := jsonb_set(new.doc, '{id}', to_jsonb(new.id));
  if private.trusted() then return new; end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from v_uid then perform private.fail('FORBIDDEN', 'Pengajuan hanya bisa dibuat untuk akun sendiri.'); end if;
    if new.status <> 'draft' or new.superseded then perform private.fail('INVALID_STATE_TRANSITION', 'Pengajuan baru selalu dimulai sebagai draft.'); end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
    perform private.fail('FORBIDDEN', 'Pemilik pengajuan tidak bisa diubah.');
  end if;

  if old.user_id = v_uid then
    if old.status = 'draft' and new.status = 'draft' then return new; end if;
    if old.status = 'draft' and new.status = 'submitted' then perform private.check_submit(new.doc); return new; end if;
    if old.status = 'rejected' and not old.superseded and new.status = 'draft' then return new; end if; -- retry at the same bank
    if old.status = 'rejected' and not old.superseded and new.status = 'rejected' and new.superseded
       and (old.doc - v_flag) = (new.doc - v_flag) then return new; end if; -- copied to another bank
    if old.status = 'additional_docs_requested' and (old.doc - v_reupload) = (new.doc - v_reupload)
       and (new.status = 'additional_docs_requested'
            or (new.status = 'docs_verification' and jsonb_array_length(coalesce(new.doc -> 'pendingActions', '[]'::jsonb)) = 0)) then
      return new;
    end if;
    perform private.fail('INVALID_STATE_TRANSITION', 'Pengajuan pada tahap ini tidak bisa diubah.');
  end if;

  -- The team works on submitted applications only; drafts are the user's private work.
  if (select private.has_role('super_admin')) and old.status <> 'draft' then
    if new.status = old.status or private.next_status_ok(old.status, new.status, old.product_type) then return new; end if;
    perform private.fail('INVALID_STATE_TRANSITION', 'Pengajuan pada tahap ini tidak bisa dipindah ke status tersebut.');
  end if;
  perform private.fail('FORBIDDEN', 'Halaman ini di luar akses akun kamu.');
end $$;

create or replace function private.mortgages_write()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_staff boolean := (select private.has_role('super_admin'));
begin
  new.status := coalesce(new.doc ->> 'status', 'draft');
  new.doc := jsonb_set(new.doc, '{id}', to_jsonb(new.id));
  if private.trusted() then return new; end if;

  if tg_op = 'INSERT' then
    if new.user_id = v_uid and new.status = 'draft' then return new; end if;
    if v_staff and new.status = 'active' then return new; end if; -- disbursement turns akad terms into the active KPR
    perform private.fail('INVALID_STATE_TRANSITION', 'KPR baru selalu dimulai dari pengaturan.');
  end if;

  if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
    perform private.fail('FORBIDDEN', 'Pemilik KPR tidak bisa diubah.');
  end if;
  if old.user_id = v_uid and old.status in ('draft', 'active')
     and (new.status = old.status or (old.status = 'draft' and new.status = 'active')) then return new; end if;
  if v_staff and (new.status = old.status or (old.status = 'active' and new.status = 'replaced')) then return new; end if;
  perform private.fail('INVALID_STATE_TRANSITION', 'Data KPR ini tidak bisa diubah.');
end $$;

create or replace function private.promote_doc()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'activities' then
    new.occurred_at := coalesce((new.doc ->> 'occurredAt')::timestamptz, now());
    new.read_at := (new.doc ->> 'readAt')::timestamptz;
  elsif tg_table_name = 'banks' then
    new.active := coalesce((new.doc ->> 'active')::boolean, true);
    new.updated_at := now();
  elsif tg_table_name = 'bank_products' then
    new.status := coalesce(new.doc ->> 'status', 'draft');
    new.bank_id := new.doc #>> '{bank,id}';
    new.updated_at := now();
  elsif tg_table_name = 'articles' then
    new.status := coalesce(new.doc ->> 'status', 'draft');
    new.slug := new.doc ->> 'slug';
    new.updated_at := now();
  elsif tg_table_name = 'health_configs' then
    new.version := (new.doc ->> 'version')::integer;
  elsif tg_table_name = 'app_config' then
    new.updated_at := now();
  elsif tg_table_name = 'audit_log' then
    if not private.trusted() then
      new.actor_id := (select auth.uid());
      new.doc := jsonb_set(new.doc, '{actor,id}', to_jsonb(new.actor_id::text));
    end if;
    new.occurred_at := coalesce((new.doc ->> 'occurredAt')::timestamptz, now());
  elsif tg_table_name = 'admin_notes' then
    if not private.trusted() then new.author_id := (select auth.uid()); end if;
  end if;
  return new;
end $$;

create trigger applications_write before insert or update on public.applications for each row execute function private.applications_write();
create trigger applications_bump_version before update on public.applications for each row execute function private.bump_version();
create trigger mortgages_write before insert or update on public.mortgages for each row execute function private.mortgages_write();
create trigger mortgages_bump_version before update on public.mortgages for each row execute function private.bump_version();
create trigger activities_promote before insert or update on public.activities for each row execute function private.promote_doc();
create trigger banks_promote before insert or update on public.banks for each row execute function private.promote_doc();
create trigger bank_products_promote before insert or update on public.bank_products for each row execute function private.promote_doc();
create trigger articles_promote before insert or update on public.articles for each row execute function private.promote_doc();
create trigger health_configs_promote before insert on public.health_configs for each row execute function private.promote_doc();
create trigger app_config_promote before insert or update on public.app_config for each row execute function private.promote_doc();
create trigger audit_log_promote before insert on public.audit_log for each row execute function private.promote_doc();
create trigger admin_notes_promote before insert on public.admin_notes for each row execute function private.promote_doc();

-- ---------- privileges ----------

alter table public.applications enable row level security;
alter table public.mortgages enable row level security;
alter table public.activities enable row level security;
alter table public.banks enable row level security;
alter table public.bank_products enable row level security;
alter table public.articles enable row level security;
alter table public.app_config enable row level security;
alter table public.health_configs enable row level security;
alter table public.audit_log enable row level security;
alter table public.admin_notes enable row level security;

revoke all on public.applications, public.mortgages, public.activities, public.banks, public.bank_products, public.articles,
  public.app_config, public.health_configs, public.audit_log, public.admin_notes from anon, authenticated;
grant all on public.applications, public.mortgages, public.activities, public.banks, public.bank_products, public.articles,
  public.app_config, public.health_configs, public.audit_log, public.admin_notes to service_role;

grant select, insert, update, delete on public.applications, public.mortgages to authenticated;
grant select, insert, update on public.activities, public.banks, public.bank_products, public.articles, public.app_config to authenticated;
grant select, insert on public.health_configs, public.audit_log, public.admin_notes to authenticated;

create policy applications_select on public.applications for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('super_admin')));
create policy applications_insert on public.applications for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.has_consented()));
create policy applications_update on public.applications for update to authenticated
  using ((user_id = (select auth.uid()) and (select private.has_consented())) or (select private.has_role('super_admin')))
  with check ((user_id = (select auth.uid()) and (select private.has_consented())) or (select private.has_role('super_admin')));
create policy applications_delete on public.applications for delete to authenticated
  using (user_id = (select auth.uid())
         and status in ('draft', 'submitted', 'docs_verification', 'additional_docs_requested', 'bank_processing', 'appraisal'));

create policy mortgages_select on public.mortgages for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('super_admin')));
create policy mortgages_insert on public.mortgages for insert to authenticated
  with check ((user_id = (select auth.uid()) and (select private.has_consented())) or (select private.has_role('super_admin')));
create policy mortgages_update on public.mortgages for update to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('super_admin')))
  with check (user_id = (select auth.uid()) or (select private.has_role('super_admin')));
create policy mortgages_delete on public.mortgages for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'draft');

create policy activities_select on public.activities for select to authenticated using (user_id = (select auth.uid()));
create policy activities_insert on public.activities for insert to authenticated
  with check ((user_id = (select auth.uid()) and (select private.has_consented())) or (select private.has_role('super_admin')));
create policy activities_update on public.activities for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy banks_select on public.banks for select to authenticated using (active or (select private.has_role('super_admin')));
create policy banks_insert on public.banks for insert to authenticated with check ((select private.has_role('super_admin')));
create policy banks_update on public.banks for update to authenticated
  using ((select private.has_role('super_admin'))) with check ((select private.has_role('super_admin')));

create policy bank_products_select on public.bank_products for select to authenticated
  using ((status = 'published' and exists (select 1 from public.banks b where b.id = bank_id and b.active))
         or (select private.has_role('super_admin')));
create policy bank_products_insert on public.bank_products for insert to authenticated with check ((select private.has_role('super_admin')));
create policy bank_products_update on public.bank_products for update to authenticated
  using ((select private.has_role('super_admin'))) with check ((select private.has_role('super_admin')));

create policy articles_select on public.articles for select to authenticated
  using (status = 'published' or (select private.is_staff()));
create policy articles_insert on public.articles for insert to authenticated with check ((select private.is_staff()));
create policy articles_update on public.articles for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));

create policy app_config_select on public.app_config for select to authenticated using (true);
create policy app_config_insert on public.app_config for insert to authenticated with check ((select private.has_role('super_admin')));
create policy app_config_update on public.app_config for update to authenticated
  using ((select private.has_role('super_admin'))) with check ((select private.has_role('super_admin')));

create policy health_configs_select on public.health_configs for select to authenticated using (true);
create policy health_configs_insert on public.health_configs for insert to authenticated with check ((select private.has_role('super_admin')));

create policy audit_log_select on public.audit_log for select to authenticated using ((select private.has_role('super_admin')));
create policy audit_log_insert on public.audit_log for insert to authenticated with check ((select private.is_staff()));

create policy admin_notes_select on public.admin_notes for select to authenticated using ((select private.has_role('super_admin')));
create policy admin_notes_insert on public.admin_notes for insert to authenticated with check ((select private.has_role('super_admin')));

-- Admins read every role (to tell staff from users) and edit user profiles (reason + audit happen in the app).
create policy user_roles_select_admin on public.user_roles for select to authenticated using ((select private.has_role('super_admin')));
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select private.has_role('super_admin'))) with check ((select private.has_role('super_admin')));

-- ---------- apply_writes: the app's save, one transaction, RLS and triggers in force ----------

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
    "profiles": ["full_name", "phone", "nik", "personal", "finance", "dashboard_layout", "tours_seen", "takeover_kept", "simulation"],
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

revoke all on function public.apply_writes(jsonb) from public, anon;
grant execute on function public.apply_writes(jsonb) to authenticated;

-- ---------- delete my account ----------

create or replace function private.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    perform private.fail('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.');
  end if;
  if exists (select 1 from public.applications a where a.user_id = v_uid
              and a.status in ('submitted', 'docs_verification', 'additional_docs_requested', 'bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad')) then
    perform private.fail('INVALID_STATE_TRANSITION', 'Masih ada pengajuan yang sedang diproses bank. Batalkan atau tunggu sampai selesai sebelum menghapus akun.');
  end if;
  delete from auth.users where id = v_uid; -- cascades to every row of this user
end $$;

create or replace function public.delete_my_account()
returns void language sql security invoker set search_path = '' as $$
  select private.delete_my_account()
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function private.fail(text, text, jsonb), private.has_role(text), private.is_staff(), private.trusted(),
  private.has_consented(), private.today(), private.next_status_ok(text, text, text), private.required_documents(jsonb),
  private.check_submit(jsonb), private.delete_my_account() to authenticated, service_role;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- storage ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('application-documents', 'application-documents', false, 20971520, array['image/jpeg', 'image/png', 'application/pdf']),
  ('payment-proofs', 'payment-proofs', false, 20971520, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- {user_id}/{application_id}/{document_type}/{file}: uploads only into a draft, or for a document the bank asked again.
create policy application_documents_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'application-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.applications a
               where a.id = (storage.foldername(name))[2] and a.user_id = (select auth.uid())
                 and (a.status = 'draft' or a.doc #>> array['documents', (storage.foldername(name))[3], 'status'] = 'needs_update')));
create policy application_documents_select on storage.objects for select to authenticated using (
  bucket_id = 'application-documents'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.has_role('super_admin'))));
create policy application_documents_delete on storage.objects for delete to authenticated using (
  bucket_id = 'application-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- {user_id}/{mortgage_id}/{file}
create policy payment_proofs_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy payment_proofs_select on storage.objects for select to authenticated using (
  bucket_id = 'payment-proofs'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.has_role('super_admin'))));
create policy payment_proofs_delete on storage.objects for delete to authenticated using (
  bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
