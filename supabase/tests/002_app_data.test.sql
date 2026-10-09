-- Run: npx supabase test db (local) or through the /pg runner: everything rolls back.
-- Users: A (consented user), B (signed in, no consent yet), S (super_admin), W (content_writer).
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000000a1', 'a@test.local', '{"full_name":"User A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b1', 'b@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c1', 's@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d1', 'w@test.local', '{}', 'authenticated', 'authenticated');
insert into public.consents (user_id, type, version) values
  ('00000000-0000-4000-8000-0000000000a1', 'terms', '2026-09-01'), ('00000000-0000-4000-8000-0000000000a1', 'privacy', '2026-09-01');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000000c1', 'super_admin'), ('00000000-0000-4000-8000-0000000000d1', 'content_writer');
insert into public.banks (id, doc) values ('bnk_test', '{"id":"bnk_test","name":"Bank Uji","mark":"UJI","active":true,"version":1}');
insert into public.bank_products (id, doc) values
  ('bpr_test', '{"id":"bpr_test","version":1,"status":"published","bank":{"id":"bnk_test","name":"Bank Uji","mark":"UJI"},"name":"KPR Uji","productTypes":["primary"],"effectiveFrom":"2026-01-01","effectiveUntil":"2099-12-31","ratePeriods":[{"type":"fixed","durationMonths":60,"rateBps":550},{"type":"floating","durationMonths":null,"rateBps":1050}]}'),
  ('bpr_test_draft', '{"id":"bpr_test_draft","version":1,"status":"draft","bank":{"id":"bnk_test","name":"Bank Uji","mark":"UJI"},"name":"KPR Draft","productTypes":["primary"],"effectiveFrom":"2026-01-01","effectiveUntil":"2099-12-31","ratePeriods":[{"type":"fixed","durationMonths":60,"rateBps":550},{"type":"floating","durationMonths":null,"rateBps":1050}]}');
insert into public.articles (id, doc) values ('art_test_draft', '{"id":"art_test_draft","slug":"uji-draft","title":"Draft","status":"draft"}');
insert into public.applications (id, user_id, doc) values ('app_test_done', '00000000-0000-4000-8000-0000000000a1', '{"status":"disbursed","productType":"primary"}');
insert into public.applications (id, user_id, doc) values ('app_test_b', '00000000-0000-4000-8000-0000000000b1', '{"id":"app_test_b","status":"draft","productType":"primary","superseded":false,"data":{},"documents":{}}');

-- ---------- user A ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$insert into public.applications (id, doc) values ('app_test_a', '{"id":"app_test_a","status":"draft","productType":"primary","superseded":false,"data":{"personal":{"fullName":"User A","nik":"3174012345678901"}},"documents":{},"version":1}')$$, 'a consented user creates a draft for themselves');
select is((select status from public.applications where id = 'app_test_a'), 'draft', 'status is derived from doc');
select throws_ok($$insert into public.applications (id, doc) values ('app_test_a2', '{"status":"approved","productType":"primary"}')$$, 'P0001', 'Pengajuan baru selalu dimulai sebagai draft.', 'a new application cannot start approved');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{status}', '"approved"') where id = 'app_test_a'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the owner cannot jump to approved');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('application-documents', '00000000-0000-4000-8000-0000000000a1/app_test_a/ktp/f1.pdf')$$, 'the owner uploads into their draft folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('application-documents', '00000000-0000-4000-8000-0000000000b1/app_test_b/ktp/f1.pdf')$$, '42501', null, 'nobody uploads into another user folder');
select throws_ok($$update public.applications set doc = doc || '{"status":"submitted"}' where id = 'app_test_a'$$, 'P0001', 'Centang kedua persetujuan untuk submit.', 'submit needs both consents');
select throws_ok($$update public.applications set doc = doc || '{"status":"submitted","consents":{"dataAccuracy":true,"sendToBank":true},"selection":{"bankProductId":"bpr_test_draft","productVersion":1,"fixedRateBps":550,"floatingRateBps":1050}}' where id = 'app_test_a'$$, 'P0001', 'Program yang dipilih sudah berubah. Bandingkan ulang sebelum submit.', 'submit with an unpublished product is rejected');
select throws_ok($$update public.applications set doc = doc || '{"status":"submitted","consents":{"dataAccuracy":true,"sendToBank":true},"selection":{"bankProductId":"bpr_test","productVersion":1,"fixedRateBps":100,"floatingRateBps":1050}}' where id = 'app_test_a'$$, 'P0001', 'Program yang dipilih sudah berubah. Bandingkan ulang sebelum submit.', 'submit with a forged rate is rejected');
select throws_ok($$update public.applications set doc = doc || '{"status":"submitted","consents":{"dataAccuracy":true,"sendToBank":true},"selection":{"bankProductId":"bpr_test","productVersion":1,"fixedRateBps":550,"floatingRateBps":1050}}' where id = 'app_test_a'$$, 'P0001', 'Lengkapi dokumen wajib sebelum submit.', 'submit with missing documents is rejected');
select lives_ok($$update public.applications set doc = doc || '{"status":"submitted","consents":{"dataAccuracy":true,"sendToBank":true},"selection":{"bankProductId":"bpr_test","productVersion":1,"fixedRateBps":550,"floatingRateBps":1050},"documents":{"ktp":{"status":"uploaded"},"npwp":{"status":"uploaded"},"income_proof":{"status":"uploaded"},"property_document":{"status":"uploaded"}}}' where id = 'app_test_a'$$, 'a complete submit passes');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{data,personal,fullName}', '"Changed"') where id = 'app_test_a'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'submitted data is locked for the owner');
delete from public.applications where id = 'app_test_b';
select is((select count(*)::int from public.applications), 2, 'A sees only their own applications');
select is((select count(*)::int from public.bank_products where id like 'bpr_test%'), 1, 'users see published products only');
select is((select count(*)::int from public.articles where id = 'art_test_draft'), 0, 'users do not see draft articles');
select throws_ok($$insert into public.mortgages (id, doc) values ('mtg_test_a', '{"status":"active"}')$$, 'P0001', 'KPR baru selalu dimulai dari pengaturan.', 'the owner cannot create an active KPR directly');
select lives_ok($$insert into public.activities (id, doc) values ('act_test_a', '{"id":"act_test_a","type":"x","occurredAt":"2026-10-09T03:00:00Z","readAt":null}')$$, 'the owner logs their own activity');
select throws_ok($$select public.apply_writes('[{"op":"update","table":"applications","id":"app_test_a","version":99,"values":{"doc":{"status":"submitted"}}}]')$$, 'P0001', 'Data ini sudah diubah sejak kamu buka. Muat ulang lalu ulangi.', 'apply_writes reports a stale version as a conflict');

-- ---------- user B (no consent yet) ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$insert into public.mortgages (id, doc) values ('mtg_test_b', '{"status":"draft"}')$$, '42501', null, 'writes need consent');

-- ---------- super admin S ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$update public.applications set doc = doc || '{"note":"x"}' where id = 'app_test_b'$$, 'P0001', 'Halaman ini di luar akses akun kamu.', 'staff cannot touch drafts');
select throws_ok($$update public.applications set doc = doc || '{"status":"approved"}' where id = 'app_test_a'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa dipindah ke status tersebut.', 'staff must follow the status matrix');
select lives_ok($$update public.applications set doc = doc || '{"status":"docs_verification"}' where id = 'app_test_a'$$, 'staff moves submitted → docs_verification');
select lives_ok($$insert into public.mortgages (id, user_id, doc) values ('mtg_test_s', '00000000-0000-4000-8000-0000000000a1', '{"status":"active","applicationId":"app_test_done"}')$$, 'disbursement by staff creates the owner active KPR');
select lives_ok($$insert into public.activities (id, user_id, doc) values ('act_test_s', '00000000-0000-4000-8000-0000000000a1', '{"id":"act_test_s","occurredAt":"2026-10-09T03:00:00Z"}')$$, 'staff can notify a user');
select lives_ok($$insert into public.audit_log (id, doc) values ('aud_test', '{"id":"aud_test","actor":{"id":"someone-else","name":"X"},"action":"x","resource":{"type":"x"}}')$$, 'staff write audit events');
select is((select doc #>> '{actor,id}' from public.audit_log where id = 'aud_test'), '00000000-0000-4000-8000-0000000000c1', 'the audit actor is always the signed-in staff member');
select throws_ok($$delete from public.audit_log where id = 'aud_test'$$, '42501', null, 'audit events cannot be deleted');
select is((select count(*)::int from public.profiles where email like '%@test.local'), 4, 'super admin reads every profile');

-- ---------- content writer W ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from public.applications where id like 'app_test%'), 0, 'a content writer cannot read applications');
reset role;
select is((select count(*)::int from public.applications where id = 'app_test_b'), 1, 'A cannot delete B application');

select * from finish();
rollback;
