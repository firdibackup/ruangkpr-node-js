-- Per-file evidence must exist before Storage accepts document bytes.
create table public.document_consents (
  file_path text primary key,
  application_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null check (version = '2026-11-06'),
  notice text not null check (notice = 'Saya menyetujui pemrosesan dokumen untuk verifikasi identitas dan pengajuan yang saya pilih, termasuk penyimpanan arsip setelah proses selesai sebagaimana dijelaskan dalam Kebijakan Privasi. Saya berwenang menyerahkan dokumen ini.'),
  accepted_at timestamptz not null default now()
);
alter table public.document_consents enable row level security;
revoke all on public.document_consents from public, anon, authenticated;
grant select, insert on public.document_consents to authenticated;
grant all on public.document_consents to service_role;

create policy document_consents_read on public.document_consents for select to authenticated
using (user_id = (select auth.uid()) or (select private.has_role('super_admin')));
create policy document_consents_insert on public.document_consents for insert to authenticated
with check (
  user_id = (select auth.uid())
  and split_part(file_path, '/', 1) = (select auth.uid())::text
  and split_part(file_path, '/', 2) = application_id
  and exists (select 1 from public.applications a where a.id = application_id and a.user_id = (select auth.uid())
    and (a.status = 'draft' or a.doc #>> array['documents', split_part(file_path, '/', 3), 'status'] = 'needs_update'))
);

create function private.document_consent_time() returns trigger language plpgsql set search_path = '' as $$
begin
  new.accepted_at := now();
  return new;
end $$;
revoke all on function private.document_consent_time() from public, anon;
create trigger document_consent_time before insert on public.document_consents
for each row execute function private.document_consent_time();

create policy application_documents_consent on storage.objects as restrictive for insert to authenticated
with check (bucket_id <> 'application-documents' or exists (
  select 1 from public.document_consents c
  where c.file_path = name and c.user_id = (select auth.uid()) and c.version = '2026-11-06'
));

-- Account closure retains files: retain their consent evidence in the same archive before FK cascades run.
create function private.archive_document_consents() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  lock table public.document_consents in share row exclusive mode;
  new.snapshot := new.snapshot || jsonb_build_object('documentConsents', (
    select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
    from public.document_consents c where c.user_id = new.original_user_id
  ));
  return new;
end $$;
revoke all on function private.archive_document_consents() from public, anon, authenticated;
create trigger archive_document_consents before insert on private.account_archives
for each row execute function private.archive_document_consents();

-- Runs after the existing application validation; reused documents are covered by this new submission consent.
create function private.application_consent() returns trigger language plpgsql set search_path = '' as $$
begin
  if not private.trusted() and old.status = 'draft' and new.status = 'docs_verification' then
    if new.doc #>> '{consents,version}' is distinct from '2026-11-06'
      or new.doc #>> '{consents,bankProductId}' is distinct from new.doc #>> '{selection,bankProductId}' then
      perform private.fail('CONSENT_REQUIRED', 'Tinjau dan setujui pengiriman dokumen ke program yang dipilih.');
    end if;
    new.doc := jsonb_set(new.doc, '{consents,acceptedAt}', to_jsonb(now()));
  end if;
  return new;
end $$;
revoke all on function private.application_consent() from public, anon, authenticated;
create trigger z_application_consent before update on public.applications
for each row execute function private.application_consent();
