-- A submit goes straight into document verification: the separate "submitted" stage only waited for the team to
-- press "Mulai verifikasi dokumen", so it is gone. The owner now moves draft → docs_verification (same checks as
-- before), staff no longer have a submitted → docs_verification move, and rows still waiting as "submitted" move on.
-- The history keeps its "submitted" entry; submittedAt stays the date the user sent it.

-- Same matrix as NEXT_STATUS / allowedTransitions in applicationApi.js.
create or replace function private.next_status_ok(p_from text, p_to text, p_type text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(case p_from
    when 'docs_verification' then p_to in ('additional_docs_requested', 'bank_processing')
    when 'bank_processing' then p_to in ('appraisal', 'rejected')
    when 'appraisal' then p_to in ('approved', 'rejected')
    when 'approved' then p_to = case when p_type = 'takeover' then 'old_mortgage_settlement' else 'akad' end
    when 'old_mortgage_settlement' then p_to = 'akad'
    when 'akad' then p_to = 'disbursed'
  end, false)
$$;

-- As in 20261014090000_submit_fresh_documents, with the owner's submit landing on docs_verification.
create or replace function private.applications_write()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  -- What a re-upload the bank asked for may touch (recordDocument in applicationApi.js).
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
    if old.status = 'draft' and new.status = 'docs_verification' then
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

-- Applications still waiting as "submitted" enter verification from the moment they were sent, so the admin queue
-- keeps counting their wait from the submit. The doc version moves on like any other change (touch in applicationApi.js).
update public.applications
   set doc = doc || jsonb_build_object(
         'status', 'docs_verification',
         'version', coalesce((doc ->> 'version')::integer, 0) + 1,
         'statusHistory', coalesce(doc -> 'statusHistory', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
           'status', 'docs_verification',
           'at', coalesce(nullif(doc -> 'submittedAt', 'null'::jsonb), to_jsonb(to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))))))
 where status = 'submitted';
