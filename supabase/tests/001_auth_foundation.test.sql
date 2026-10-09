-- Run: npx supabase test db (local) or paste into the Studio SQL Editor: everything rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'a@test.local', '{"full_name":"User A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'b@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000c', 'c@test.local', '{"name":"Admin C"}', 'authenticated', 'authenticated');
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-00000000000c', 'super_admin');

select is((select full_name from public.profiles where id = '00000000-0000-4000-8000-00000000000a'), 'User A', 'signing up creates a profile with the Google name');
select is((select email from public.profiles where id = '00000000-0000-4000-8000-00000000000b'), 'b@test.local', 'the profile copies the login email');

set local role anon;
select throws_ok('select 1 from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok($$select public.accept_consents('Anon', true, true, '2026-09-01')$$, '42501', null, 'anon cannot call accept_consents');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles), 1, 'a user sees only their own profile');
select throws_ok($$update public.profiles set email = 'x@test.local'$$, '42501', null, 'the login email is not writable');
update public.profiles set full_name = 'Hacked' where id = '00000000-0000-4000-8000-00000000000b';
select throws_ok($$select public.accept_consents('Al', true, false, '2026-09-01')$$, 'P0001', 'Periksa kembali data kamu.', 'a short name and a missing privacy consent are rejected');
select lives_ok($$select public.accept_consents('  User Alpha ', true, true, '2026-09-01')$$, 'a valid consent succeeds');
select is((select count(*)::int from public.consents), 2, 'terms and privacy are recorded once');
select throws_ok($$insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-00000000000a', 'super_admin')$$, '42501', null, 'a user cannot grant themselves a role');
select throws_ok($$delete from public.consents$$, '42501', null, 'consents cannot be deleted');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.profiles where email like '%@test.local'), 3, 'a super admin reads every profile');
reset role;

select is((select full_name from public.profiles where id = '00000000-0000-4000-8000-00000000000b'), '', 'user A cannot rename user B');
select is((select full_name from public.profiles where id = '00000000-0000-4000-8000-00000000000a'), 'User Alpha', 'accept_consents stores the trimmed name');

select * from finish();
rollback;
