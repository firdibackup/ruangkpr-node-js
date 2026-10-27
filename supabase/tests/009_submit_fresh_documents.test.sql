-- Run: npx supabase test db (local) or through the /pg runner: everything rolls back.
-- Users A and B (consented applicants; one active application each). A's app_t9: rejected after appraisal with every
-- document verified and a stage note, about to be retried at the same bank. B's app_t9r: waiting on a re-upload of NPWP.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000009a1', 'a9@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000009b1', 'b9@test.local', '{}', 'authenticated', 'authenticated');
insert into public.consents (user_id, type, version) values
  ('00000000-0000-4000-8000-0000000009a1', 'terms', '2026-09-01'), ('00000000-0000-4000-8000-0000000009a1', 'privacy', '2026-09-01'),
  ('00000000-0000-4000-8000-0000000009b1', 'terms', '2026-09-01'), ('00000000-0000-4000-8000-0000000009b1', 'privacy', '2026-09-01');
insert into public.banks (id, doc) values ('bnk_t9', '{"id":"bnk_t9","name":"Bank Uji","mark":"UJI","active":true,"version":1}');
insert into public.bank_products (id, doc) values
  ('bpr_t9', '{"id":"bpr_t9","version":1,"status":"published","bank":{"id":"bnk_t9","name":"Bank Uji","mark":"UJI"},"name":"KPR Uji","productTypes":["primary"],"effectiveFrom":"2026-01-01","effectiveUntil":"2099-12-31","ratePeriods":[{"type":"fixed","durationMonths":60,"rateBps":550},{"type":"floating","durationMonths":null,"rateBps":1050}]}');
insert into public.applications (id, user_id, doc) values
  ('app_t9', '00000000-0000-4000-8000-0000000009a1',
   '{"status":"rejected","productType":"primary","superseded":false,"data":{"personal":{"fullName":"User A9","nik":"3174012345678909"}},
     "selection":{"bankProductId":"bpr_t9","productVersion":1,"fixedRateBps":550,"floatingRateBps":1050},
     "documents":{"ktp":{"status":"verified","fileName":"ktp.pdf"},"npwp":{"status":"verified","fileName":"npwp.pdf"},
                  "income_proof":{"status":"verified","fileName":"slip.pdf"},"property_document":{"status":"verified","fileName":"ppjb.pdf"}},
     "stageNotes":{"appraisal":{"message":"","schedule":{"date":"2026-10-05","time":"10:00","location":"Jl. Melati 12"},"updatedAt":"2026-10-04T02:00:00Z"}}}'),
  ('app_t9r', '00000000-0000-4000-8000-0000000009b1',
   '{"status":"additional_docs_requested","productType":"primary",
     "statusHistory":[{"status":"submitted","at":"2026-10-01T02:00:00Z"},{"status":"docs_verification","at":"2026-10-02T02:00:00Z"},{"status":"additional_docs_requested","at":"2026-10-03T02:00:00Z"}],
     "pendingActions":[{"id":"pa_t9","type":"document_update","documentType":"npwp","message":"Buram / tidak terbaca","requestedAt":"2026-10-03T02:00:00Z"}],
     "documents":{"ktp":{"status":"verified","fileName":"ktp.pdf"},"npwp":{"status":"needs_update","fileName":"npwp.pdf","invalidReason":"Buram / tidak terbaca"}}}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000009a1","role":"authenticated"}', true);

-- ---------- retry at the same bank, then submit ----------
select lives_ok($$update public.applications set doc = doc || '{"status":"draft"}' where id = 'app_t9'$$, 'the rejected application goes back to draft for a retry at the same bank');
select throws_ok($$update public.applications set doc = doc || '{"status":"docs_verification","consents":{"dataAccuracy":true,"sendToBank":true}}' where id = 'app_t9'$$, 'P0001', 'Dokumen pengajuan perlu diunggah ulang sebelum dikirim.', 'documents verified in the earlier attempt cannot be submitted as already checked');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{documents}', '{"ktp":{"status":"uploaded"},"npwp":{"status":"uploaded"},"income_proof":{"status":"uploaded"},"property_document":{"status":"uploaded"}}') || '{"status":"docs_verification","consents":{"dataAccuracy":true,"sendToBank":true}}' where id = 'app_t9'$$, 'P0001', 'Dokumen pengajuan perlu diunggah ulang sebelum dikirim.', 'a stage note from the earlier attempt cannot travel into a new submit');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{documents}', '{"ktp":{"status":"uploaded"},"npwp":{"status":"uploaded","review":{"reasonCode":"blurry","note":"","at":"2026-10-06T02:00:00Z"}},"income_proof":{"status":"uploaded"},"property_document":{"status":"uploaded"}}') || '{"status":"docs_verification","consents":{"dataAccuracy":true,"sendToBank":true},"stageNotes":{}}' where id = 'app_t9'$$, 'P0001', 'Dokumen pengajuan perlu diunggah ulang sebelum dikirim.', 'a review written by the user cannot be submitted');
select throws_ok($$update public.applications set doc = jsonb_set(doc, '{documents}', '{"ktp":{"status":"uploaded"},"npwp":{"status":"uploaded"},"income_proof":{"status":"uploaded"},"property_document":{"status":"uploaded"},"additional":{"status":"verified"}}') || '{"status":"docs_verification","consents":{"dataAccuracy":true,"sendToBank":true},"stageNotes":{}}' where id = 'app_t9'$$, 'P0001', 'Dokumen pengajuan perlu diunggah ulang sebelum dikirim.', 'an optional document the user marked verified cannot be submitted either');
select lives_ok($$update public.applications set doc = jsonb_set(doc, '{documents}', '{"ktp":{"status":"uploaded","fileName":"ktp.pdf"},"npwp":{"status":"uploaded","fileName":"npwp.pdf"},"income_proof":{"status":"uploaded","fileName":"slip.pdf"},"property_document":{"status":"uploaded","fileName":"ppjb.pdf"}}') || '{"status":"docs_verification","consents":{"dataAccuracy":true,"sendToBank":true},"stageNotes":{}}' where id = 'app_t9'$$, 'a submit of fresh uploads with no stage notes passes');
select is((select status from public.applications where id = 'app_t9'), 'docs_verification', 'the retried application goes straight to document verification');

-- ---------- user B re-uploads: the history entry keeps a string timestamp ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000009b1","role":"authenticated"}', true);
select throws_ok($$update public.applications set doc = jsonb_set(jsonb_set(jsonb_set(doc, '{documents,npwp}', '{"status":"uploaded","fileName":"npwp-baru.pdf","invalidReason":null}'), '{pendingActions}', '[]'), '{statusHistory}', (doc -> 'statusHistory') || '[{"status":"docs_verification","at":5}]') || '{"status":"docs_verification"}' where id = 'app_t9r'$$, 'P0001', 'Pengajuan pada tahap ini tidak bisa diubah.', 'the history entry of a re-upload needs a string timestamp');
select lives_ok($$update public.applications set doc = jsonb_set(jsonb_set(jsonb_set(doc, '{documents,npwp}', '{"status":"uploaded","fileName":"npwp-baru.pdf","invalidReason":null}'), '{pendingActions}', '[]'), '{statusHistory}', (doc -> 'statusHistory') || '[{"status":"docs_verification","at":"2026-10-04T02:00:00Z"}]') || '{"status":"docs_verification"}' where id = 'app_t9r'$$, 'a re-upload with a string timestamp still returns to verification');
reset role;

select * from finish();
rollback;
