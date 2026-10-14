-- Run: npx supabase test db (local) or through the /pg runner: everything rolls back.
-- User A (consented): what a cancelled application left behind lives in profiles.kept and is saved through apply_writes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000010a1', 'a10@test.local', '{}', 'authenticated', 'authenticated');
insert into public.consents (user_id, type, version) values
  ('00000000-0000-4000-8000-0000000010a1', 'terms', '2026-09-01'), ('00000000-0000-4000-8000-0000000010a1', 'privacy', '2026-09-01');

select has_column('public', 'profiles', 'kept', 'profiles keeps what cancelled applications left behind in kept');
select hasnt_column('public', 'profiles', 'takeover_kept', 'the Take Over-only column is gone');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000010a1","role":"authenticated"}', true);
select lives_ok($$select public.apply_writes('[{"op":"update","table":"profiles","id":"00000000-0000-4000-8000-0000000010a1","values":{"kept":{"primary":{"loan":{"downPayment":100}},"documents":{"ktp":{"status":"uploaded","path":"00000000-0000-4000-8000-0000000010a1/app_x/ktp/a.pdf"}}}}}]')$$, 'the owner saves kept data through apply_writes');
select is((select kept #>> '{documents,ktp,path}' from public.profiles where id = '00000000-0000-4000-8000-0000000010a1'), '00000000-0000-4000-8000-0000000010a1/app_x/ktp/a.pdf', 'the kept document is stored');
reset role;

select * from finish();
rollback;
