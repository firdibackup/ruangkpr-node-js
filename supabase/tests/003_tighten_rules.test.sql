-- Run: npx supabase test db (local) or through the /pg runner: everything rolls back.
-- Linter follow-ups (one permissive policy per action, FK index) and the disbursement rule for staff-made KPRs.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000000a3', 'a3@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000c3', 's3@test.local', '{}', 'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000000c3', 'super_admin');
insert into public.applications (id, user_id, doc) values
  ('app_t3_done', '00000000-0000-4000-8000-0000000000a3', '{"status":"disbursed","productType":"primary"}'),
  ('app_t3_akad', '00000000-0000-4000-8000-0000000000a3', '{"status":"akad","productType":"primary"}');

select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE'), 1, 'profiles has one UPDATE policy');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'user_roles' and cmd = 'SELECT'), 1, 'user_roles has one SELECT policy');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'admin_notes' and indexdef like '%(application_id)%'), 'admin_notes.application_id is indexed');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
select lives_ok($$update public.profiles set full_name = 'User A3' where id = '00000000-0000-4000-8000-0000000000a3'$$, 'a user still edits their own profile');
select is((select count(*)::int from public.user_roles), 0, 'a user still sees no roles but their own');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c3","role":"authenticated"}', true);
select lives_ok($$update public.profiles set phone = '081200000000' where id = '00000000-0000-4000-8000-0000000000a3'$$, 'a super admin still edits a user profile');
select is((select count(*)::int from public.user_roles where user_id = '00000000-0000-4000-8000-0000000000c3'), 1, 'a super admin still reads roles');
select throws_ok($$insert into public.mortgages (id, user_id, doc) values ('mtg_t3_free', '00000000-0000-4000-8000-0000000000a3', '{"status":"active"}')$$, 'P0001', 'KPR aktif hanya dibuat dari pengajuan yang sudah cair.', 'staff cannot create an active KPR out of nothing');
select throws_ok($$insert into public.mortgages (id, user_id, doc) values ('mtg_t3_akad', '00000000-0000-4000-8000-0000000000a3', '{"status":"active","applicationId":"app_t3_akad"}')$$, 'P0001', 'KPR aktif hanya dibuat dari pengajuan yang sudah cair.', 'nor from an application that is not disbursed yet');
select lives_ok($$insert into public.mortgages (id, user_id, doc) values ('mtg_t3_ok', '00000000-0000-4000-8000-0000000000a3', '{"status":"active","applicationId":"app_t3_done"}')$$, 'staff creates the KPR of a disbursed application');
reset role;

select * from finish();
rollback;
