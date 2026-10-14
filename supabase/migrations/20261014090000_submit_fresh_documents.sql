-- Document review, final fixes (spec 2026-10-13 §3): a submit carries only fresh uploads, so nothing the user wrote
-- in the draft (a 'verified' status, a review draft, a stage note) reaches the team as if the team had written it;
-- retrySameBank in mockApi.js resets the documents and stage notes the same way. A re-upload's history entry keeps
-- a string timestamp, which the admin queue reads for everyone.

-- As in 20261013120000_document_review, plus: the appended history entry's "at" is a string.
create or replace function private.reupload_ok(p_old jsonb, p_new jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select
    not exists (
      select 1
        from (select jsonb_object_keys(coalesce(p_old -> 'documents', '{}'::jsonb)) as t
              union
              select jsonb_object_keys(coalesce(p_new -> 'documents', '{}'::jsonb))) k
       where (p_new -> 'documents' -> k.t) is distinct from (p_old -> 'documents' -> k.t)
         and not coalesce(
               p_old -> 'documents' -> k.t ->> 'status' = 'needs_update'
               and p_new -> 'documents' -> k.t ->> 'status' = 'uploaded'
               and not ((p_new -> 'documents' -> k.t) ? 'review')
               and coalesce(p_new -> 'documents' -> k.t ->> 'invalidReason', '') = '',
               false))
    and jsonb_typeof(p_new -> 'pendingActions') is not distinct from jsonb_typeof(p_old -> 'pendingActions')
    and jsonb_array_length(coalesce(p_new -> 'pendingActions', '[]'::jsonb)) <= jsonb_array_length(coalesce(p_old -> 'pendingActions', '[]'::jsonb))
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_new -> 'pendingActions', '[]'::jsonb)) a
       where not exists (select 1 from jsonb_array_elements(coalesce(p_old -> 'pendingActions', '[]'::jsonb)) b where b = a))
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_old -> 'pendingActions', '[]'::jsonb)) a
       where not exists (select 1 from jsonb_array_elements(coalesce(p_new -> 'pendingActions', '[]'::jsonb)) b where b = a)
         and coalesce(p_new -> 'documents' -> (a ->> 'documentType') ->> 'status', '') <> 'uploaded')
    and ((p_new -> 'statusHistory') is not distinct from (p_old -> 'statusHistory')
         or ((p_new -> 'statusHistory') = coalesce(p_old -> 'statusHistory', '[]'::jsonb) || jsonb_build_array((p_new -> 'statusHistory') -> -1)
             and ((p_new -> 'statusHistory') -> -1) ->> 'status' = 'docs_verification'
             and jsonb_typeof(((p_new -> 'statusHistory') -> -1) -> 'at') = 'string'
             and jsonb_array_length(coalesce(p_new -> 'pendingActions', '[]'::jsonb)) = 0))
$$;

-- As in 20261013120000_document_review, plus the fresh-upload check on draft → submitted.
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
    if old.status = 'draft' and new.status = 'submitted' then
      perform private.check_submit(new.doc);
      -- Only the team verifies, reviews, or writes stage notes; a draft carries fresh uploads only.
      if exists (select 1 from jsonb_each(coalesce(new.doc -> 'documents', '{}'::jsonb)) d
                  where d.value ->> 'status' is distinct from 'uploaded' or d.value ? 'review')
         or coalesce(new.doc -> 'stageNotes', '{}'::jsonb) <> '{}'::jsonb then
        perform private.fail('INVALID_STATE_TRANSITION', 'Dokumen pengajuan perlu diunggah ulang sebelum dikirim.');
      end if;
      return new;
    end if;
    if old.status = 'rejected' and not old.superseded and new.status = 'draft' then return new; end if; -- retry at the same bank
    if old.status = 'rejected' and not old.superseded and new.status = 'rejected' and new.superseded
       and (old.doc - v_flag) = (new.doc - v_flag) then return new; end if; -- copied to another bank
    if old.status = 'additional_docs_requested' and (old.doc - v_reupload) = (new.doc - v_reupload)
       and private.reupload_ok(old.doc, new.doc)
       and (new.status = 'additional_docs_requested'
            or (new.status = 'docs_verification' and jsonb_array_length(coalesce(new.doc -> 'pendingActions', '[]'::jsonb)) = 0)) then
      return new;
    end if;
    perform private.fail('INVALID_STATE_TRANSITION', 'Pengajuan pada tahap ini tidak bisa diubah.');
  end if;

  -- The team works on submitted applications only; drafts are the user's private work.
  if (select private.has_role('super_admin')) and old.status <> 'draft' then
    if new.status = 'bank_processing' and old.status <> 'bank_processing'
       and exists (select 1 from unnest(private.required_documents(new.doc)) t
                    where coalesce(new.doc #>> array['documents', t, 'status'], '') <> 'verified') then
      perform private.fail('INVALID_STATE_TRANSITION', 'Semua dokumen wajib harus Sesuai sebelum diteruskan ke bank.');
    end if;
    if new.status = old.status or private.next_status_ok(old.status, new.status, old.product_type) then return new; end if;
    perform private.fail('INVALID_STATE_TRANSITION', 'Pengajuan pada tahap ini tidak bisa dipindah ke status tersebut.');
  end if;
  perform private.fail('FORBIDDEN', 'Halaman ini di luar akses akun kamu.');
end $$;

-- 20261013120000 created reupload_ok after the schema-wide revoke, so it still carried the default PUBLIC execute.
revoke all on function private.reupload_ok(jsonb, jsonb) from public, anon;
grant execute on function private.reupload_ok(jsonb, jsonb) to authenticated, service_role;
