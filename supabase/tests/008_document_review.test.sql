-- Run: npx supabase test db (local) or through the /pg runner: everything rolls back.
-- Users: A (consented applicant), S (super_admin). A's KPR Primary application starts in document verification.
-- P waits on two re-uploads; T's Take Over application is in verification with one required document unchecked.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000008a1', 'a8@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000008b1', 'p8@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000008d1', 't8@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000008c1', 's8@test.local', '{}', 'authenticated', 'authenticated');
insert into public.consents (user_id, type, version) values
  ('00000000-0000-4000-8000-0000000008a1', 'terms', '2026-09-01'), ('00000000-0000-4000-8000-0000000008a1', 'privacy', '2026-09-01'),
  ('00000000-0000-4000-8000-0000000008b1', 'terms', '2026-09-01'), ('00000000-0000-4000-8000-0000000008b1', 'privacy', '2026-09-01');
insert into public.applications (id, user_id, doc) values
  ('app_t8p', '00000000-0000-4000-8000-0000000008b1',
   '{"status":"additional_docs_requested","productType":"primary",
     "statusHistory":[{"status":"submitted","at":"2026-10-01T02:00:00Z"},{"status":"docs_verification","at":"2026-10-02T02:00:00Z"},{"status":"additional_docs_requested","at":"2026-10-03T02:00:00Z"}],
     "pendingActions":[{"id":"pa_t8p1","type":"document_update","documentType":"npwp","message":"Buram / tidak terbaca","requestedAt":"2026-10-03T02:00:00Z"},
                       {"id":"pa_t8p2","type":"document_update","documentType":"income_proof","message":"Kedaluwarsa","requestedAt":"2026-10-03T02:00:00Z"}],
     "documents":{"ktp":{"status":"verified","fileName":"ktp.pdf"},"npwp":{"status":"needs_update","fileName":"npwp.pdf","invalidReason":"Buram / tidak terbaca"},
                  "income_proof":{"status":"needs_update","fileName":"slip.pdf","invalidReason":"Kedaluwarsa"},"property_document":{"status":"verified","fileName":"ppjb.pdf"}}}'),
  ('app_t8t', '00000000-0000-4000-8000-0000000008d1',
   '{"status":"docs_verification","productType":"takeover","pendingActions":[],"data":{"personal":{"maritalStatus":"single"}},
     "statusHistory":[{"status":"submitted","at":"2026-10-01T02:00:00Z"},{"status":"docs_verification","at":"2026-10-02T02:00:00Z"}],
     "documents":{"ktp":{"status":"verified"},"family_card":{"status":"verified"},"npwp":{"status":"verified"},"income_proof":{"status":"verified"},
                  "bank_statement":{"status":"verified"},"old_loan_agreement":{"status":"verified"},"outstanding_letter":{"status":"verified"},
                  "latest_payment_proof":{"status":"verified"},"certificate":{"status":"verified"},"building_permit":{"status":"verified"},"land_tax":{"status":"uploaded"}}}');
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000008c1', 'super_admin');
insert into public.applications (id, user_id, doc) values ('app_t8', '00000000-0000-4000-8000-0000000008a1',
  '{"status":"docs_verification","productType":"primary","pendingActions":[],
    "statusHistory":[{"status":"submitted","at":"2026-10-01T02:00:00Z"},{"status":"docs_verification","at":"2026-10-02T02:00:00Z"}],
    "documents":{"ktp":{"status":"uploaded","fileName":"ktp.pdf"},"npwp":{"status":"uploaded","fileName":"npwp.pdf"},
                 "income_proof":{"status":"uploaded","fileName":"slip.pdf"},"property_document":{"status":"uploaded","fileName":"ppjb.pdf"}}}');

-- ---------- super admin S verifies and turns NPWP back ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008c1","role":"authenticated"}', true);
select throws_ok($$update public.applications set doc = doc || '{"status":"bank_processing"}' where id = 'app_t8'$$, 'P0001', 'Semua dokumen wajib harus Sesuai sebelum diteruskan ke bank.', 'staff cannot forward unverified documents to the bank');
select lives_ok($$update public.applications set doc = jsonb_set(jsonb_set(jsonb_set(jsonb_set(doc, '{documents,ktp,status}', '"verified"'), '{documents,income_proof,status}', '"verified"'), '{documents,property_document,status}', '"verified"'), '{documents,npwp,review}', '{"reasonCode":"blurry","note":"","at":"2026-10-03T02:00:00Z"}') where id = 'app_t8'$$, 'staff verifies documents and drafts a rejection while verifying');
select lives_ok($$update public.applications set doc = jsonb_set(jsonb_set(doc, '{documents,npwp}', '{"status":"needs_update","fileName":"npwp.pdf","invalidReason":"Buram / tidak terbaca"}'), '{pendingActions}', '[{"id":"pa_t8","type":"document_update","documentType":"npwp","message":"Buram / tidak terbaca","requestedAt":"2026-10-03T02:00:00Z"}]') || '{"status":"additional_docs_requested"}' where id = 'app_t8'$$, 'staff sends the revision request');

-- ---------- user A re-uploads ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008a1","role":"authenticated"}', true);
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{documents,npwp,status}', '"verified"') where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot verify their own document');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{documents,ktp}', '{"status":"uploaded","fileName":"ktp-lain.pdf"}') where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot replace a document nobody asked for');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{documents,family_card}', '{"status":"uploaded","fileName":"kk.pdf"}') where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot add a document of their own');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{pendingActions}', '[]') || '{"status":"docs_verification"}' where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot drop the request without re-uploading');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{pendingActions}', (doc -> 'pendingActions') || '[{}]') where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot pad pendingActions with an empty object');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{statusHistory}', (doc -> 'statusHistory') || '[{"status":"docs_verification","at":"2026-10-04T02:00:00Z"}]') where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot claim a verification history entry while pendingActions is still open');
select throws_ok($$update public.applications set doc = (jsonb_set(doc, '{documents,npwp}', '{"status":"uploaded","fileName":"n.pdf"}') - 'pendingActions') || '{"status":"docs_verification"}' where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot drop the pendingActions key entirely to fake an empty queue');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{documents,npwp}', '{"status":"uploaded","fileName":"n.pdf","review":{"reasonCode":"other"}}') where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot attach an admin review field while re-uploading');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{documents,npwp}', '{"status":"uploaded","fileName":"n.pdf","invalidReason":"x"}') where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot leave invalidReason set on a re-upload');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{statusHistory}', '[]') where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot wipe statusHistory');
select throws_ok($$update public.applications set doc = doc || '{"stageNotes":{}}' where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot add a stage note while still in additional_docs_requested');
select lives_ok($$update public.applications set doc = jsonb_set(jsonb_set(jsonb_set(doc, '{documents,npwp}', '{"status":"uploaded","fileName":"npwp-baru.pdf","sizeBytes":1000,"contentType":"application/pdf","uploadedAt":"2026-10-04T02:00:00Z","invalidReason":null,"path":"x/app_t8/npwp/npwp-baru.pdf"}'), '{pendingActions}', '[]'), '{statusHistory}', (doc -> 'statusHistory') || '[{"status":"docs_verification","at":"2026-10-04T02:00:00Z"}]') || '{"status":"docs_verification"}' where id = 'app_t8'$$, 'the user re-uploads the asked document and the application returns to verification');

-- ---------- S checks the new file, forwards, and leaves a note ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008c1","role":"authenticated"}', true);
select throws_ok($$update public.applications set doc = doc || '{"status":"bank_processing"}' where id = 'app_t8'$$, 'P0001', 'Semua dokumen wajib harus Sesuai sebelum diteruskan ke bank.', 'the re-uploaded document is checked again before the bank');
select lives_ok($$update public.applications set doc = jsonb_set(doc, '{documents,npwp,status}', '"verified"') || '{"status":"bank_processing"}' where id = 'app_t8'$$, 'all required documents verified: staff forwards to the bank');
select lives_ok($$update public.applications set doc = doc || '{"stageNotes":{"bank_processing":{"message":"Bank minta 5 hari kerja.","schedule":null,"updatedAt":"2026-10-05T02:00:00Z"}}}' where id = 'app_t8'$$, 'staff writes the info for the user in the current stage');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008a1","role":"authenticated"}', true);
select throws_ok($$update public.applications set doc = doc || '{"stageNotes":{}}' where id = 'app_t8'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the user cannot change the team note');

-- ---------- user P re-uploads one of the two requested documents ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008b1","role":"authenticated"}', true);
select throws_ok($$update public.applications set doc = jsonb_set(jsonb_set(jsonb_set(doc, '{documents,npwp}', '{"status":"uploaded","fileName":"npwp-baru.pdf","invalidReason":null}'), '{pendingActions}', (doc -> 'pendingActions') - 0), '{statusHistory}', (doc -> 'statusHistory') || '[{"status":"docs_verification","at":"2026-10-04T02:00:00Z"}]') || '{"status":"docs_verification"}' where id = 'app_t8p'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'one of two re-uploads cannot return the application to verification');
select lives_ok($$update public.applications set doc = jsonb_set(jsonb_set(doc, '{documents,npwp}', '{"status":"uploaded","fileName":"npwp-baru.pdf","invalidReason":null}'), '{pendingActions}', (doc -> 'pendingActions') - 0) where id = 'app_t8p'$$, 'the user re-uploads one of two requested documents');
select is((select status from public.applications where id = 'app_t8p'), 'additional_docs_requested', 'after a partial re-upload the application still waits on the user');
select is((select jsonb_agg(a ->> 'documentType') from public.applications, jsonb_array_elements(doc -> 'pendingActions') a where id = 'app_t8p'), '["income_proof"]'::jsonb, 'the request for the other document remains');

-- ---------- S and a Take Over application: every required Take Over document counts ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000008c1","role":"authenticated"}', true);
select throws_ok($$update public.applications set doc = doc || '{"status":"bank_processing"}' where id = 'app_t8t'$$, 'P0001', 'Semua dokumen wajib harus Sesuai sebelum diteruskan ke bank.', 'a Take Over application with PBB not yet Sesuai cannot go to the bank');
select lives_ok($$update public.applications set doc = jsonb_set(doc, '{documents,land_tax,status}', '"verified"') || '{"status":"bank_processing"}' where id = 'app_t8t'$$, 'with PBB Sesuai too, the Take Over application goes to the bank');
reset role;

select is((select doc #>> '{stageNotes,bank_processing,message}' from public.applications where id = 'app_t8'), 'Bank minta 5 hari kerja.', 'the note is stored on the application');

select * from finish();
rollback;
