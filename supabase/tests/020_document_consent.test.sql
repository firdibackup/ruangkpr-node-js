begin;
create extension if not exists pgtap with schema extensions;
select plan(10);
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
 ('00000000-0000-4000-8000-0000000000e1', 'consent-a@test.local', '{}', 'authenticated', 'authenticated'),
 ('00000000-0000-4000-8000-0000000000e2', 'consent-b@test.local', '{}', 'authenticated', 'authenticated');
insert into public.consents(user_id,type,version) values
 ('00000000-0000-4000-8000-0000000000e1','terms','2026-11-06'),
 ('00000000-0000-4000-8000-0000000000e1','privacy','2026-11-06');
insert into public.applications(id,user_id,doc) values
 ('consent_app','00000000-0000-4000-8000-0000000000e1','{"status":"draft","productType":"primary","documents":{}}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}',true);
select throws_ok($$insert into storage.objects(bucket_id,name) values('application-documents','00000000-0000-4000-8000-0000000000e1/consent_app/ktp/a.pdf')$$,'42501',null,'direct upload without consent fails');
select throws_ok($$insert into public.document_consents(file_path,application_id,user_id,version,notice) values('00000000-0000-4000-8000-0000000000e1/consent_app/ktp/a.pdf','consent_app','00000000-0000-4000-8000-0000000000e1','old','wrong')$$,'23514',null,'old or forged notice fails');
select lives_ok($$insert into public.document_consents(file_path,application_id,user_id,version,notice,accepted_at) values('00000000-0000-4000-8000-0000000000e1/consent_app/ktp/a.pdf','consent_app','00000000-0000-4000-8000-0000000000e1','2026-11-06','Saya menyetujui pemrosesan dokumen untuk verifikasi identitas dan pengajuan yang saya pilih, termasuk penyimpanan arsip setelah proses selesai sebagaimana dijelaskan dalam Kebijakan Privasi. Saya berwenang menyerahkan dokumen ini.','2000-01-01')$$,'owner records notice');
select ok((select accepted_at = now() from public.document_consents where application_id='consent_app'),'server owns the timestamp');
select lives_ok($$insert into storage.objects(bucket_id,name) values('application-documents','00000000-0000-4000-8000-0000000000e1/consent_app/ktp/a.pdf')$$,'recorded file may upload');
select throws_ok($$insert into storage.objects(bucket_id,name) values('application-documents','00000000-0000-4000-8000-0000000000e1/consent_app/ktp/b.pdf')$$,'42501',null,'consent is bound to exact file path');
select throws_ok($$update public.document_consents set notice='changed' where application_id='consent_app'$$,'42501',null,'evidence cannot be rewritten');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}',true);
select is((select count(*)::int from public.document_consents),0,'another user cannot read evidence');
reset role;
delete from public.applications where id='consent_app';
select is((select count(*)::int from public.document_consents where application_id='consent_app'),1,'cancellation preserves consent for retained files');
select ok(not has_table_privilege('authenticated','public.document_consents','TRUNCATE'),'authenticated cannot truncate evidence');
select * from finish();
rollback;
