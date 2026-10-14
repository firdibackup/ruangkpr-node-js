-- Run: npx supabase test db (local) or through the /pg runner: everything rolls back.
-- Users: A (consented user), S (super_admin). A's KPR starts as a setup draft and is activated during the test.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000006a1', 'a6@test.local', '{"full_name":"User A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000006c1', 's6@test.local', '{}', 'authenticated', 'authenticated');
insert into public.consents (user_id, type, version) values
  ('00000000-0000-4000-8000-0000000006a1', 'terms', '2026-09-01'), ('00000000-0000-4000-8000-0000000006a1', 'privacy', '2026-09-01');
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-8000-0000000006c1', 'super_admin');
update public.profiles set personal = '{"address":"Jl. Lama 1"}', finance = '{"monthlyIncome":10000000}' where id = '00000000-0000-4000-8000-0000000006a1';
insert into public.mortgages (id, user_id, doc) values
  ('mtg_t6', '00000000-0000-4000-8000-0000000006a1', '{"status":"draft","bankName":"Bank Lama","productName":"KPR Uji","currentPayment":5000000,"property":{"estimatedValue":800000000},"reminders":{"payment":[7,3,1]},"payments":[],"finance":{"monthlyIncome":10000000}}');

create temp view t6 as select doc, occurred_at from public.user_changes where user_id = '00000000-0000-4000-8000-0000000006a1';

-- ---------- user A edits their own data ----------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000006a1","role":"authenticated"}', true);
update public.profiles set personal = personal || '{"address":"Jl. Baru 2"}', nik = '3174012345678901' where id = '00000000-0000-4000-8000-0000000006a1';
update public.profiles set tours_seen = '{home}', dashboard_layout = '[]' where id = '00000000-0000-4000-8000-0000000006a1';
update public.profiles set finance = finance || '{"monthlyIncome":12000000}' where id = '00000000-0000-4000-8000-0000000006a1';
update public.mortgages set doc = doc || '{"bankName":"Bank Uji"}' where id = 'mtg_t6';
update public.mortgages set doc = doc || '{"status":"active"}' where id = 'mtg_t6';
update public.mortgages set doc = jsonb_set(doc, '{property,estimatedValue}', '900000000') where id = 'mtg_t6';
update public.mortgages set doc = jsonb_set(doc, '{finance,monthlyIncome}', '12000000') where id = 'mtg_t6';
update public.mortgages set doc = jsonb_set(doc, '{payments}', '[{"id":"pay_t6","dueDate":"2026-10-22","amount":5000000,"paidAt":"2026-10-21"}]') where id = 'mtg_t6';
update public.mortgages set doc = jsonb_set(doc, '{payments}', '[]') where id = 'mtg_t6';
select is((select count(*)::int from public.user_changes), 0, 'a user cannot read the change history');
select throws_ok($$insert into public.user_changes (user_id, doc) values ('00000000-0000-4000-8000-0000000006a1', '{}')$$, '42501', null, 'a user cannot write the change history');

-- ---------- super admin S edits A, then reads the history ----------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000006c1","role":"authenticated"}', true);
update public.profiles set personal = personal || '{"address":"Jl. Admin 3"}' where id = '00000000-0000-4000-8000-0000000006a1';
select is((select count(*)::int from public.user_changes where user_id = '00000000-0000-4000-8000-0000000006a1'), 6, 'super admin reads the history; admin edits, view settings, the finance copy and draft edits add nothing');
reset role;

select is((select doc -> 'after' from t6 where doc ->> 'action' = 'profile'), '{"address":"Jl. Baru 2","nik":"3174********8901"}', 'profile change: new values, NIK masked');
select is((select doc -> 'before' from t6 where doc ->> 'action' = 'profile'), '{"address":"Jl. Lama 1","nik":null}', 'profile change: old values');
select is((select doc #>> '{resource,type}' from t6 where doc ->> 'action' = 'profile'), 'user', 'profile change points at the user');
select is((select doc -> 'after' from t6 where doc ->> 'action' = 'finance'), '{"monthlyIncome":12000000}', 'finance change: new income');
select is((select doc -> 'before' from t6 where doc ->> 'action' = 'finance'), '{"monthlyIncome":10000000}', 'finance change: old income');
select is((select doc -> 'after' from t6 where doc ->> 'action' = 'mortgage.update'), '{"property.estimatedValue":900000000}', 'KPR change: property value, keyed by its path');
select is((select doc #>> '{resource,id}' from t6 where doc ->> 'action' = 'mortgage.update'), 'mtg_t6', 'KPR change points at the KPR');
select is((select doc #>> '{resource,label}' from t6 where doc ->> 'action' = 'mortgage.update'), 'Bank Uji · KPR Uji', 'KPR change carries the KPR name');
select is((select doc -> 'after' from t6 where doc ->> 'action' = 'payment.mark'), '{"dueDate":"2026-10-22","amount":5000000,"paidAt":"2026-10-21"}', 'marking a payment is logged with its due date and amount');
select is((select doc -> 'before' from t6 where doc ->> 'action' = 'payment.unmark'), '{"dueDate":"2026-10-22","amount":5000000}', 'undoing a payment mark is logged');
select is((select doc #>> '{resource,label}' from t6 where doc ->> 'action' = 'mortgage.activate'), 'Bank Uji · KPR Uji', 'activating a monitored KPR is logged');
select is((select count(*)::int from t6 where doc #>> '{resource,id}' = 'mtg_t6'), 4, 'setup draft edits and the finance copy are not logged (activate, update, mark, unmark)');
select is((select count(*)::int from t6 where doc -> 'after' ? 'address' and doc #>> '{after,address}' = 'Jl. Admin 3'), 0, 'admin edits stay out of the user history');

select * from finish();
rollback;
