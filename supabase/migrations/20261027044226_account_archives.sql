-- Account history is independent of auth.users. No automatic expiry or restoration.
alter table public.user_roles drop constraint user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check (role in ('super_admin', 'admin', 'content_writer'));

create table private.account_archives (
  id uuid primary key default gen_random_uuid(),
  original_user_id uuid not null unique,
  name text not null,
  contact text,
  closed_at timestamptz not null default now(),
  status text not null default 'archived' check (status in ('archived', 'deleting')),
  schema_version integer not null default 1,
  snapshot jsonb not null,
  files jsonb not null default '[]',
  deletion_reason text
);
create index account_archives_closed on private.account_archives (closed_at desc);
alter table private.account_archives enable row level security;
revoke all on private.account_archives from public, anon, authenticated;

create function private.archive_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'super_admin'))
$$;

create function private.live_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where id = auth.uid())
$$;

create function private.archive_event(p_id uuid, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id text := 'aud_' || gen_random_uuid();
begin
  if not private.archive_staff() then perform private.fail('FORBIDDEN', 'Halaman ini di luar akses akun kamu.'); end if;
  insert into public.audit_log (id, actor_id, doc)
  values (v_id, auth.uid(), jsonb_build_object(
    'id', v_id,
    'actor', jsonb_build_object('id', auth.uid(), 'name', (select full_name from public.profiles where id = auth.uid()),
      'contact', (select email from public.profiles where id = auth.uid())),
    'action', p_action, 'resource', jsonb_build_object('type', 'account_archive', 'id', p_id, 'label', 'Arsip akun'),
    'reason', p_reason, 'occurredAt', now()));
end $$;

create or replace function private.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  p public.profiles;
  v_files jsonb;
begin
  if v_uid is null then perform private.fail('AUTH_REQUIRED', 'Sesi berakhir. Silakan masuk lagi.'); end if;
  -- Serialize the rare closure with writes/jobs/uploads; snapshot and cascades commit together.
  lock table public.profiles, public.applications, public.mortgages, public.activities,
    public.consents, public.admin_notes, public.cover_letters, public.user_changes,
    public.reminder_deliveries, storage.objects in share row exclusive mode;
  if not exists (select 1 from auth.users where id = v_uid) then return; end if;
  if private.is_staff() then perform private.fail('FORBIDDEN', 'Akun staf tidak bisa dihapus melalui profil pengguna.'); end if;
  if exists (select 1 from public.applications where user_id = v_uid and status in
    ('submitted', 'docs_verification', 'additional_docs_requested', 'bank_processing', 'appraisal', 'approved', 'old_mortgage_settlement', 'akad')) then
    perform private.fail('INVALID_STATE_TRANSITION', 'Masih ada pengajuan yang sedang diproses bank. Batalkan atau tunggu sampai selesai sebelum menghapus akun.');
  end if;
  select * into strict p from public.profiles where id = v_uid;
  select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_id, 'path', name, 'size', metadata->'size')), '[]') into v_files
    from storage.objects where bucket_id in ('application-documents', 'payment-proofs') and split_part(name, '/', 1) = v_uid::text;
  insert into private.account_archives (original_user_id, name, contact, snapshot, files)
  values (v_uid, p.full_name, p.email, jsonb_build_object(
    'profile', p.personal || jsonb_build_object('fullName', p.full_name, 'email', p.email, 'phone', p.phone, 'nik', p.nik),
    'finance', p.finance,
    'profileRecord', to_jsonb(p),
    'applications', (select coalesce(jsonb_agg(doc), '[]') from public.applications where user_id = v_uid),
    'mortgages', (select coalesce(jsonb_agg(doc), '[]') from public.mortgages where user_id = v_uid),
    'activities', (select coalesce(jsonb_agg(doc), '[]') from public.activities where user_id = v_uid),
    'consents', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.consents c where user_id = v_uid),
    'userChanges', (select coalesce(jsonb_agg(doc || jsonb_build_object('occurredAt', occurred_at)), '[]') from public.user_changes where user_id = v_uid),
    'adminNotes', (select coalesce(jsonb_agg(n.doc), '[]') from public.admin_notes n join public.applications a on a.id = n.application_id where a.user_id = v_uid),
    'coverLetters', (select coalesce(jsonb_agg(c.doc), '[]') from public.cover_letters c join public.applications a on a.id = c.id where a.user_id = v_uid),
    'reminders', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.reminder_deliveries r where user_id = v_uid)
  ), v_files);
  -- Relinquish ownership only; never delete Storage metadata or move object paths with SQL.
  update storage.objects set owner = null, owner_id = null
    where bucket_id in ('application-documents', 'payment-proofs') and split_part(name, '/', 1) = v_uid::text;
  delete from auth.users where id = v_uid; -- cascades sessions and active data, never the archive
end $$;

create function private.archive_file_access(p_bucket text, p_path text, p_delete boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.archive_staff() and exists (
    select 1 from private.account_archives a
    where (not p_delete or a.status = 'deleting')
    and a.files @> jsonb_build_array(jsonb_build_object('bucket', p_bucket, 'path', p_path)))
$$;
-- An old JWT must not retain access to archived files, nor upload new orphaned proofs.
create policy account_files_live on storage.objects as restrictive for all to authenticated
  using (bucket_id not in ('application-documents', 'payment-proofs') or private.live_account())
  with check (bucket_id not in ('application-documents', 'payment-proofs') or private.live_account());
create policy account_archive_files_select on storage.objects for select to authenticated
  using (private.archive_file_access(bucket_id, name));
create policy account_archive_files_delete on storage.objects for delete to authenticated
  using (private.archive_file_access(bucket_id, name, true));

create function public.list_account_archives(p_query text default '', p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not private.archive_staff() then perform private.fail('FORBIDDEN', 'Halaman ini di luar akses akun kamu.'); end if;
  select coalesce(jsonb_agg(to_jsonb(a)), '[]') into result from (
    select id, name, contact, closed_at as "closedAt", status,
      jsonb_array_length(snapshot->'applications') as "applicationCount",
      jsonb_array_length(snapshot->'mortgages') as "mortgageCount", jsonb_array_length(files) as "fileCount"
    from private.account_archives
    where coalesce(name, '') ilike '%' || p_query || '%' or coalesce(contact, '') ilike '%' || p_query || '%'
    order by closed_at desc, id limit 50 offset greatest(p_offset, 0)
  ) a;
  return result;
end $$;

create function public.get_account_archive(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a private.account_archives;
begin
  if not private.archive_staff() then perform private.fail('FORBIDDEN', 'Halaman ini di luar akses akun kamu.'); end if;
  select * into a from private.account_archives where id = p_id;
  if not found then perform private.fail('RESOURCE_NOT_FOUND', 'Arsip tidak ditemukan.'); end if;
  perform private.archive_event(p_id, 'account_archive.view');
  return jsonb_build_object('id', a.id, 'name', a.name, 'contact', a.contact, 'originalUserId', a.original_user_id,
    'closedAt', a.closed_at, 'status', a.status, 'snapshot', a.snapshot, 'files', a.files);
end $$;

create function public.begin_delete_account_archive(p_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_files jsonb;
begin
  if not private.archive_staff() then perform private.fail('FORBIDDEN', 'Halaman ini di luar akses akun kamu.'); end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then perform private.fail('VALIDATION_FAILED', 'Isi alasan penghapusan (minimal 5 karakter).'); end if;
  update private.account_archives set status = 'deleting', deletion_reason = trim(p_reason) where id = p_id returning files into v_files;
  if not found then return '[]'; end if;
  perform private.archive_event(p_id, 'account_archive.delete_started', trim(p_reason));
  return v_files;
end $$;

create function public.finish_delete_account_archive(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a private.account_archives;
begin
  if not private.archive_staff() then perform private.fail('FORBIDDEN', 'Halaman ini di luar akses akun kamu.'); end if;
  select * into a from private.account_archives where id = p_id for update;
  if not found then return; end if;
  if a.status <> 'deleting' then perform private.fail('INVALID_STATE_TRANSITION', 'Konfirmasi penghapusan arsip terlebih dahulu.'); end if;
  if exists (select 1 from storage.objects o join jsonb_array_elements(a.files) f
    on o.bucket_id = f->>'bucket' and o.name = f->>'path') then
    perform private.fail('INVALID_STATE_TRANSITION', 'Berkas belum seluruhnya terhapus. Ulangi penghapusan arsip.');
  end if;
  perform private.archive_event(p_id, 'account_archive.delete', a.deletion_reason);
  delete from private.account_archives where id = p_id;
end $$;

revoke all on function private.archive_staff(), private.live_account(), private.archive_event(uuid,text,text),
  private.archive_file_access(text,text,boolean) from public, anon, authenticated;
grant execute on function private.archive_staff(), private.live_account(), private.archive_file_access(text,text,boolean) to authenticated;
revoke all on function public.list_account_archives(text,integer), public.get_account_archive(uuid),
  public.begin_delete_account_archive(uuid,text), public.finish_delete_account_archive(uuid) from public, anon;
grant execute on function public.list_account_archives(text,integer), public.get_account_archive(uuid),
  public.begin_delete_account_archive(uuid,text), public.finish_delete_account_archive(uuid) to authenticated;
