begin;
create extension if not exists pgtap with schema extensions;
select plan(16);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000e01', 'archive-user@test.local', '{"full_name":"Arsip User"}'),
  ('00000000-0000-4000-8000-000000000e02', 'archive-admin@test.local', '{}'),
  ('00000000-0000-4000-8000-000000000e03', 'archive-writer@test.local', '{}'),
  ('00000000-0000-4000-8000-000000000e04', 'archive-super@test.local', '{}');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-000000000e02', 'admin'),
  ('00000000-0000-4000-8000-000000000e03', 'content_writer'),
  ('00000000-0000-4000-8000-000000000e04', 'super_admin');
insert into public.applications (id, user_id, doc) values ('archive_app', '00000000-0000-4000-8000-000000000e01', '{"id":"archive_app","status":"docs_verification","productType":"primary"}');
insert into storage.objects (bucket_id, name, owner, owner_id) values ('application-documents', '00000000-0000-4000-8000-000000000e01/archive_app/ktp/archive.pdf', '00000000-0000-4000-8000-000000000e01', '00000000-0000-4000-8000-000000000e01');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000e01","role":"authenticated"}', true);
select throws_ok($$select public.delete_my_account()$$, 'P0001', 'Masih ada pengajuan yang sedang diproses bank. Batalkan atau tunggu sampai selesai sebelum menghapus akun.', 'in-process application blocks closure');
reset role;
select is((select count(*)::int from private.account_archives where original_user_id = '00000000-0000-4000-8000-000000000e01'), 0, 'blocked closure creates no archive');
update public.applications set doc = doc || '{"status":"draft"}' where id = 'archive_app';
set local role authenticated;
select lives_ok($$select public.delete_my_account()$$, 'archive and login deletion commit together');
select is((select count(*)::int from storage.objects where name like '00000000-0000-4000-8000-000000000e01/%'), 0, 'old JWT cannot read archived files');
select throws_ok($$select public.list_account_archives()$$, 'P0001', 'Halaman ini di luar akses akun kamu.', 'old JWT cannot list archives');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('payment-proofs', '00000000-0000-4000-8000-000000000e01/new/proof.pdf')$$, '42501', null, 'old JWT cannot upload after closure');
reset role;
select is((select count(*)::int from auth.users where id = '00000000-0000-4000-8000-000000000e01'), 0, 'login is removed');
select is((select count(*)::int from public.applications where id = 'archive_app'), 0, 'active application is removed');
select is((select snapshot #>> '{applications,0,id}' from private.account_archives where original_user_id = '00000000-0000-4000-8000-000000000e01'), 'archive_app', 'application snapshot survives');
select is((select count(*)::int from storage.objects where name like '00000000-0000-4000-8000-000000000e01/%' and owner_id is null and owner is null), 1, 'file survives without old auth ownership');
select set_config('test.archive_id', (select id::text from private.account_archives where original_user_id = '00000000-0000-4000-8000-000000000e01'), true);
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-8000-000000000e05', 'archive-user@test.local', '{}');
select is((select finance from public.profiles where id = '00000000-0000-4000-8000-000000000e05'), '{}'::jsonb, 'same email starts with empty finance');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000e03","role":"authenticated"}', true);
select throws_ok($$select public.get_account_archive(current_setting('test.archive_id')::uuid)$$, 'P0001', 'Halaman ini di luar akses akun kamu.', 'content writer cannot open archive');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000e04","role":"authenticated"}', true);
select lives_ok($$select public.get_account_archive(current_setting('test.archive_id')::uuid)$$, 'super admin can open archive');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000e02","role":"authenticated"}', true);
select lives_ok($$select public.begin_delete_account_archive(current_setting('test.archive_id')::uuid, 'Manual deletion')$$, 'admin can begin manual deletion');
select throws_ok($$select public.finish_delete_account_archive(current_setting('test.archive_id')::uuid)$$, 'P0001', 'Berkas belum seluruhnya terhapus. Ulangi penghapusan arsip.', 'archive is retained until Storage deletion succeeds');
-- Test metadata only (no real object was uploaded); production deletes using the Storage API.
delete from storage.objects where name = '00000000-0000-4000-8000-000000000e01/archive_app/ktp/archive.pdf';
select lives_ok($$select public.finish_delete_account_archive(current_setting('test.archive_id')::uuid)$$, 'archive can be removed after files are gone');
select * from finish();
rollback;
