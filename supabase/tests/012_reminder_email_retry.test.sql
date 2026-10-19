-- Run through the /pg runner (or npx supabase test db): everything rolls back, so pg_net never sends these emails.
-- Reminder emails read Resend's answer and are tried again; the hourly job stays quiet before 07:00 WIB.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- A key only for this transaction when the real one is not in Vault yet.
select vault.create_secret('re_test_only', 'resend_api_key') where not exists (select 1 from vault.secrets where name = 'resend_api_key');

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000012a1', 'x1@test.local', '{"full_name":"Rina Uji"}', 'authenticated', 'authenticated');
insert into public.mortgages (id, user_id, doc) values
  -- due day 30 → H-7 on 23 Nov, both channels
  ('mtg_x0', '00000000-0000-4000-8000-0000000012a1', '{"status":"active","bankName":"Bank Uji","dueDay":30,"currentRateType":"floating","payments":[],"reminders":{"payment":[7],"fixedExpiry":[],"channels":{"inApp":true,"email":true}}}'),
  -- a draft only holds the hand-made emails below; the job never reminds it on its own
  ('mtg_x1', '00000000-0000-4000-8000-0000000012a1', '{"status":"draft","bankName":"Bank Draf","payments":[]}');

-- Resend's answers as pg_net stores them (made-up ids), and one request pg_net has not sent yet.
insert into net._http_response (id, status_code, content, error_msg) values
  (-1201, 200, '{"id":"ok"}', null),
  (-1202, 500, '{"message":"Internal error"}', null),
  (-1203, 429, '{"message":"Too many requests"}', null),
  (-1204, null, null, 'Timeout of 10000 ms reached');
create temp table pending as select net.http_get('https://api.resend.com/never-sent') as id;

insert into public.reminder_deliveries (user_id, mortgage_id, kind, target_date, offset_days, channel, status, attempts, request_id, sent_at) values
  ('00000000-0000-4000-8000-0000000012a1', 'mtg_x1', 'payment', '2026-11-30', 1, 'email', 'sending', 1, -1201, now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000012a1', 'mtg_x1', 'payment', '2026-11-30', 7, 'email', 'sending', 1, -1202, now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000012a1', 'mtg_x1', 'payment', '2026-11-30', 3, 'email', 'sending', 3, -1203, now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000012a1', 'mtg_x1', 'payment', '2026-11-30', 2, 'email', 'sending', 1, -1204, now() - interval '1 hour'),
  -- no answer and not in pg_net's queue: lost in a restart
  ('00000000-0000-4000-8000-0000000012a1', 'mtg_x1', 'payment', '2026-10-30', 7, 'email', 'sending', 1, -1205, now() - interval '1 hour'),
  -- handed over a moment ago, and one still waiting in pg_net's queue
  ('00000000-0000-4000-8000-0000000012a1', 'mtg_x1', 'payment', '2026-11-30', 5, 'email', 'sending', 1, -1206, now()),
  ('00000000-0000-4000-8000-0000000012a1', 'mtg_x1', 'payment', '2026-11-30', 4, 'email', 'sending', 1, (select id from pending), now() - interval '1 hour');

select ok(private.check_reminder_emails() >= 5, 'the check settles every email that has an answer');
select is((select status from public.reminder_deliveries where mortgage_id = 'mtg_x1' and offset_days = 1), 'sent', 'a 2xx from Resend marks the email sent');
select is((select status || ' / ' || last_error from public.reminder_deliveries where mortgage_id = 'mtg_x1' and offset_days = 7 and target_date = '2026-11-30'), 'queued / HTTP 500: {"message":"Internal error"}', 'a refused email waits for the next try, with Resend''s answer');
select is((select status || ' / ' || last_error from public.reminder_deliveries where mortgage_id = 'mtg_x1' and offset_days = 3), 'failed / HTTP 429: {"message":"Too many requests"}', 'after the third try it stays failed');
select is((select status || ' / ' || last_error from public.reminder_deliveries where mortgage_id = 'mtg_x1' and offset_days = 2), 'queued / Timeout of 10000 ms reached', 'a timeout is tried again');
select is((select status from public.reminder_deliveries where mortgage_id = 'mtg_x1' and target_date = '2026-10-30'), 'queued', 'an answer lost in a restart is tried again');
select is((select array_agg(offset_days order by offset_days) from public.reminder_deliveries where mortgage_id = 'mtg_x1' and status = 'sending'), array[4, 5], 'an email still on its way is left alone');

select is(private.run_reminders('2026-11-23 06:30+07'), 0, 'before 07:00 WIB the job sends nothing');
select is((select count(*)::int from public.reminder_deliveries where mortgage_id = 'mtg_x0'), 0, 'and reminds nobody yet');

select ok(private.run_reminders('2026-11-23 08:00+07') >= 3, 'from 07:00 WIB the job reminds and sends');
select ok(exists (select 1 from public.reminder_deliveries d join net.http_request_queue q on q.id = d.request_id
                  where d.mortgage_id = 'mtg_x0' and d.channel = 'email' and d.status = 'sending' and d.attempts = 1), 'a new reminder email is handed to Resend and waits for its answer');
select is((select status || ' / ' || attempts from public.reminder_deliveries where mortgage_id = 'mtg_x1' and offset_days = 7 and target_date = '2026-11-30'), 'sending / 2', 'a refused email of today is tried again');
select is((select status from public.reminder_deliveries where mortgage_id = 'mtg_x1' and target_date = '2026-10-30'), 'skipped', 'an email from an earlier day is never retried late');

select private.run_reminders('2026-11-23 09:00+07');
select is((select count(*)::int from public.reminder_deliveries where mortgage_id = 'mtg_x0'), 2, 'the next hour adds nothing: one in-app and one email reminder');
select is((select count(*)::int from public.activities where user_id = '00000000-0000-4000-8000-0000000012a1'), 1, 'the user gets one notification');

select ok(not has_function_privilege('authenticated', 'private.run_reminders(timestamptz)', 'execute')
          and not has_function_privilege('authenticated', 'private.check_reminder_emails()', 'execute'), 'signed-in users cannot run the job');

select * from finish();
rollback;
