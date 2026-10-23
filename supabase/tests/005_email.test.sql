-- Run through the /pg runner (or npx supabase test db): everything rolls back, so pg_net never sends these emails.
-- OTP emails (Send Email Hook) and reminder emails through Resend's HTTP API.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- A key only for this transaction when the real one is not in Vault yet.
select vault.create_secret('re_test_only', 'resend_api_key') where not exists (select 1 from vault.secrets where name = 'resend_api_key');

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000005e1', 'e1@test.local', '{"full_name":"Rina Uji"}', 'authenticated', 'authenticated');
insert into public.mortgages (id, user_id, doc) values
  ('mtg_e1', '00000000-0000-4000-8000-0000000005e1', '{"status":"active","bankName":"Bank <b>Uji</b>","dueDay":30,"currentRateType":"fixed","fixedUntil":"2026-12-23","payments":[],"reminders":{"payment":[7,3,1],"fixedExpiry":[90,60,30,14,7],"channels":{"inApp":true,"email":true}}}');

create temp table sent_before as select coalesce(max(id), 0) as id from net.http_request_queue;

select is(public.send_email_hook('{"user":{"email":"e1@test.local"},"email_data":{"token":"654321","email_action_type":"magiclink"}}'), '{}'::jsonb, 'the hook answers success to the auth server');
select ok(exists (select 1 from net.http_request_queue q where q.id > (select id from sent_before) and q.url = 'https://api.resend.com/emails'
                  and convert_from(q.body, 'UTF8') like '%654321%' and convert_from(q.body, 'UTF8') like '%e1@test.local%'
                  and convert_from(q.body, 'UTF8') like '%Kode masuk Maxi%'), 'the code email is queued to Resend for that address');
select ok(exists (select 1 from net.http_request_queue q where q.id > (select id from sent_before) and q.headers ->> 'Authorization' like 'Bearer re_%'), 'Resend gets the key from Vault');
select ok(public.send_email_hook('{"user":{},"email_data":{}}') ? 'error', 'a payload without address or code is refused');
select ok(not has_function_privilege('anon', 'public.send_email_hook(jsonb)', 'execute'), 'visitors cannot call the hook');
select ok(not has_function_privilege('authenticated', 'public.send_email_hook(jsonb)', 'execute'), 'signed-in users cannot call the hook');
select ok(has_function_privilege('supabase_auth_admin', 'public.send_email_hook(jsonb)', 'execute'), 'the auth server can call the hook');

insert into public.reminder_deliveries (user_id, mortgage_id, kind, target_date, offset_days, channel, status, created_at)
values ('00000000-0000-4000-8000-0000000005e1', 'mtg_e1', 'payment', '2026-10-30', 7, 'email', 'queued', '2026-10-23 01:00+00');

select is(private.run_reminders('2026-11-23 08:00+07'), 2, 'the morning run sends the two reminder emails of the day');
select is((select count(*)::int from public.reminder_deliveries where mortgage_id = 'mtg_e1' and channel = 'email' and status = 'sending'), 2, 'both emails are handed to Resend');
select is((select status from public.reminder_deliveries where mortgage_id = 'mtg_e1' and target_date = '2026-10-30'), 'skipped', 'an email left from an earlier day is skipped, never sent late');
select ok(exists (select 1 from net.http_request_queue q where q.id > (select id from sent_before)
                  and convert_from(q.body, 'UTF8') like '%Cicilan KPR jatuh tempo 30 Nov 2026%'), 'the payment email names the due date');
select ok(exists (select 1 from net.http_request_queue q where q.id > (select id from sent_before)
                  and convert_from(q.body, 'UTF8') like '%Bank &lt;b&gt;Uji&lt;/b&gt;%'), 'names from user data are HTML-escaped');

select * from finish();
rollback;
