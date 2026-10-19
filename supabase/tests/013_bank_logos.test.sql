-- Run: npx supabase test db (local) or through the /pg runner: everything rolls back.
-- Users: A (consented user), S (super_admin).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000013a1', 'logo-a@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000013c1', 'logo-s@test.local', '{}', 'authenticated', 'authenticated');
insert into public.consents (user_id, type, version) values
  ('00000000-0000-4000-8000-0000000013a1', 'terms', '2026-09-01'), ('00000000-0000-4000-8000-0000000013a1', 'privacy', '2026-09-01');
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000013c1', 'super_admin');
insert into public.banks (id, doc) values ('bnk_test_off', '{"id":"bnk_test_off","name":"Bank Uji Nonaktif","mark":"UJN","active":false,"version":1}');

select is((select public from storage.buckets where id = 'bank-logos'), true, 'bank logos are public to read');
select is((select file_size_limit from storage.buckets where id = 'bank-logos'), 1048576::bigint, 'a logo is at most 1 MB');
select is((select allowed_mime_types from storage.buckets where id = 'bank-logos'), array['image/jpeg', 'image/png'], 'a logo is a JPG or PNG');

-- ---------- user A ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000013a1","role":"authenticated"}', true);
select is((select count(*)::int from public.banks where id = 'bnk_test_off'), 1, 'a user still reads an inactive bank (their KPR may be there)');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('bank-logos', 'uji-a.png')$$, '42501', null, 'a user cannot upload a bank logo');

-- ---------- super admin S ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000013c1","role":"authenticated"}', true);
select lives_ok($$insert into storage.objects (bucket_id, name) values ('bank-logos', 'uji-s.png')$$, 'the super admin uploads a bank logo');
select is((select count(*)::int from storage.objects where bucket_id = 'bank-logos' and name = 'uji-s.png'), 1, 'the super admin sees the logo to replace or remove it');

select * from finish();
rollback;
