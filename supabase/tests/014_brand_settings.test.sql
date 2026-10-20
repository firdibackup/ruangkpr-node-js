-- Run: npx supabase test db (local) or through the /pg runner: everything rolls back.
-- Visitors: anon (not signed in), A (consented user), S (super_admin).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000014a1', 'brand-a@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000014c1', 'brand-s@test.local', '{}', 'authenticated', 'authenticated');
insert into public.consents (user_id, type, version) values
  ('00000000-0000-4000-8000-0000000014a1', 'terms', '2026-09-01'), ('00000000-0000-4000-8000-0000000014a1', 'privacy', '2026-09-01');
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000014c1', 'super_admin');
delete from public.brand_settings;
insert into public.brand_settings (id, doc) values ('draft', '{"version":2}'), ('published', '{"version":1}');

select is((select public from storage.buckets where id = 'brand-assets'), true, 'brand assets are public to read');
select is((select allowed_mime_types from storage.buckets where id = 'brand-assets'), array['image/jpeg', 'image/png'], 'a logo or favicon is a JPG or PNG');

-- ---------- anon ----------
set local role anon;
select is((select array_agg(id) from public.brand_settings), array['published'], 'a visitor who is not signed in reads only the published brand');
select throws_ok($$update public.brand_settings set doc = '{}' where id = 'published'$$, '42501', null, 'a visitor cannot change the brand');

-- ---------- user A ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000014a1","role":"authenticated"}', true);
select is((select array_agg(id) from public.brand_settings), array['published'], 'a user reads only the published brand, never the draft');
select is_empty($$update public.brand_settings set doc = '{"version":9}' where id = 'published' returning id$$, 'a user cannot change the published brand');
select throws_ok($$insert into public.brand_settings (id, doc) values ('draft', '{}') on conflict (id) do update set doc = excluded.doc$$, '42501', null, 'a user cannot write a draft');
select throws_ok($$select public.apply_writes('[{"op":"update","table":"brand_settings","id":"published","values":{"doc":{}}}]')$$, 'P0001', null, 'a user cannot publish through apply_writes');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('brand-assets', 'uji-a.png')$$, '42501', null, 'a user cannot upload a logo');

-- ---------- super admin S ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000014c1","role":"authenticated"}', true);
select is((select count(*)::int from public.brand_settings), 2, 'the super admin reads the draft and the published brand');
select lives_ok($$select public.apply_writes('[{"op":"update","table":"brand_settings","id":"published","values":{"doc":{"version":2}}}]')$$, 'the super admin publishes through apply_writes');
select lives_ok($$select public.apply_writes('[{"op":"delete","table":"brand_settings","id":"draft"}]')$$, 'the super admin removes the draft (back to default)');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('brand-assets', 'uji-s.png')$$, 'the super admin uploads a logo');

select * from finish();
rollback;
