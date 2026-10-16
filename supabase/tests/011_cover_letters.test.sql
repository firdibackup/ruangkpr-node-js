-- Run: npx supabase test db (local) or through the /pg runner: everything rolls back.
-- Users: A (applicant), S (super_admin), W (content_writer). A's application app_t11b is at the bank, app_t11v still in
-- document verification.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000011a1', 'a11@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000011c1', 's11@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000011d1', 'w11@test.local', '{}', 'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-0000000011c1', 'super_admin'), ('00000000-0000-4000-8000-0000000011d1', 'content_writer');
insert into public.applications (id, user_id, doc) values
  ('app_t11b', '00000000-0000-4000-8000-0000000011a1', '{"status":"bank_processing","productType":"primary"}'),
  ('app_t11v', '00000000-0000-4000-8000-0000000011a1', '{"status":"docs_verification","productType":"primary"}');

set local role authenticated;

-- ---------- the applicant and the content writer cannot write a letter ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000011a1","role":"authenticated"}', true);
select throws_ok($$insert into public.cover_letters (id, doc) values ('app_t11b', '{"salesOfficer":"A"}')$$, '42501', 'new row violates row-level security policy for table "cover_letters"', 'the applicant cannot write a letter for their own application');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000011d1","role":"authenticated"}', true);
select throws_ok($$insert into public.cover_letters (id, doc) values ('app_t11b', '{"salesOfficer":"W"}')$$, '42501', 'new row violates row-level security policy for table "cover_letters"', 'a content writer cannot write a letter');

-- ---------- the super admin writes one once the application is at the bank ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000011c1","role":"authenticated"}', true);
select throws_ok($$insert into public.cover_letters (id, doc) values ('app_t11v', '{"salesOfficer":"S"}')$$, '42501', 'new row violates row-level security policy for table "cover_letters"', 'no letter before the application is at the bank');
select lives_ok($$insert into public.cover_letters (id, doc) values ('app_t11b', '{"id":"app_t11b","salesOfficer":"Hilda"}')$$, 'the super admin writes a letter for an application at the bank');
select is((select count(*)::int from public.cover_letters), 1, 'the super admin reads the letter');
select lives_ok($$select public.apply_writes('[{"op":"update","table":"cover_letters","id":"app_t11b","values":{"doc":{"id":"app_t11b","salesOfficer":"Rudi"}}}]')$$, 'apply_writes updates a letter');

-- ---------- the applicant never sees it ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000011a1","role":"authenticated"}', true);
select is((select count(*)::int from public.cover_letters), 0, 'the applicant reads no letter');
select lives_ok($$update public.cover_letters set doc = '{"salesOfficer":"A"}' where id = 'app_t11b'$$, 'an update by the applicant touches no row');
reset role;
select is((select doc ->> 'salesOfficer' from public.cover_letters where id = 'app_t11b'), 'Rudi', 'the letter is unchanged by the applicant');

-- ---------- a rejected application's letter is frozen; deleting the application deletes it ----------
update public.applications set doc = doc || '{"status":"rejected"}' where id = 'app_t11b';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000011c1","role":"authenticated"}', true);
select throws_ok($$update public.cover_letters set doc = '{"salesOfficer":"S"}' where id = 'app_t11b'$$, '42501', 'new row violates row-level security policy for table "cover_letters"', 'no edits once the application is rejected');
reset role;
delete from public.applications where id = 'app_t11b';
select is((select count(*)::int from public.cover_letters), 0, 'deleting the application deletes its letter');

select * from finish();
rollback;
