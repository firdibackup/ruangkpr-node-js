-- Run: npx supabase test db (local) or through the /pg runner: everything rolls back.
-- Daily in-app reminders (Fase 4a). Every case runs on a fixed date: private.enqueue_reminders(p_today).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000004a1', 'r1@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000004a2', 'r2@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000004a3', 'r3@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000004a4', 'r4@test.local', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000004a5', 'r5@test.local', '{}', 'authenticated', 'authenticated');
insert into public.mortgages (id, user_id, doc) values
  -- due day 30 → 30 Nov is 7 days after 23 Nov; fixed ends 23 Dec (30 days); both channels
  ('mtg_r1', '00000000-0000-4000-8000-0000000004a1', '{"status":"active","bankName":"Bank Uji","dueDay":30,"currentRateType":"fixed","fixedUntil":"2026-12-23","payments":[],"reminders":{"payment":[7,3,1],"fixedExpiry":[90,60,30,14,7],"channels":{"inApp":true,"email":true}}}'),
  -- due day 31 is clamped to 30 Nov; in-app only; already floating
  ('mtg_r2', '00000000-0000-4000-8000-0000000004a2', '{"status":"active","bankName":"Bank Dua","dueDay":31,"currentRateType":"floating","payments":[],"reminders":{"payment":[7,3,1],"fixedExpiry":[90],"channels":{"inApp":true,"email":false}}}'),
  -- already marked paid for 30 Nov
  ('mtg_r3', '00000000-0000-4000-8000-0000000004a3', '{"status":"active","bankName":"Bank Tiga","dueDay":30,"currentRateType":"floating","payments":[{"dueDate":"2026-11-30","status":"paid"}],"reminders":{"payment":[7,3,1],"fixedExpiry":[],"channels":{"inApp":true,"email":true}}}'),
  -- a setup draft is not monitored yet
  ('mtg_r4', '00000000-0000-4000-8000-0000000004a4', '{"status":"draft","bankName":"Bank Empat","dueDay":30,"payments":[],"reminders":{"payment":[7],"fixedExpiry":[],"channels":{"inApp":true,"email":true}}}'),
  -- every channel switched off
  ('mtg_r5', '00000000-0000-4000-8000-0000000004a5', '{"status":"active","bankName":"Bank Lima","dueDay":30,"currentRateType":"floating","payments":[],"reminders":{"payment":[7],"fixedExpiry":[],"channels":{"inApp":false,"email":false}}}');

select is(private.next_due_date('2026-02-10', 31), '2026-02-28'::date, 'a due day past the month end falls on the last day');
select is(private.next_due_date('2026-02-28', 31), '2026-02-28'::date, 'today counts as the next due date');
select is(private.next_due_date('2026-03-01', 31), '2026-03-31'::date, 'after this month’s due date the next month counts');
select is(private.next_due_date('2026-01-31', 15), '2026-02-15'::date, 'rolls into the next month');

select is(private.enqueue_reminders('2026-11-23'), 3, 'payment for r1 and r2, fixed end for r1');
select is((select count(*)::int from public.activities where user_id = '00000000-0000-4000-8000-0000000004a1'), 2, 'r1 gets two notifications');
select ok(exists (select 1 from public.activities where user_id = '00000000-0000-4000-8000-0000000004a1' and doc ->> 'title' = 'Cicilan jatuh tempo 7 hari lagi'
                  and doc ->> 'body' = 'Jatuh tempo 30 Nov 2026 di Bank Uji. Tandai pembayaran setelah kamu bayar.' and doc ->> 'category' = 'reminder'
                  and doc #>> '{action,route}' = '/my-kpr/payment' and doc -> 'readAt' = 'null'::jsonb), 'the payment reminder reads like the app');
select ok(exists (select 1 from public.activities where user_id = '00000000-0000-4000-8000-0000000004a1' and doc ->> 'title' = 'Fixed rate berakhir dalam 30 hari'
                  and doc ->> 'category' = 'warning' and doc #>> '{action,route}' = '/my-kpr/rate'), 'the fixed-end warning reads like the app');
select is((select count(*)::int from public.reminder_deliveries where mortgage_id = 'mtg_r1'), 4, 'r1: in-app and email for both reminders');
select is((select count(*)::int from public.reminder_deliveries where mortgage_id = 'mtg_r1' and channel = 'email' and status = 'queued'), 2, 'emails wait for the sender (Fase 4b)');
select is((select target_date from public.reminder_deliveries where mortgage_id = 'mtg_r2'), '2026-11-30'::date, 'due day 31 is reminded for 30 Nov');
select is((select count(*)::int from public.activities where user_id in ('00000000-0000-4000-8000-0000000004a3', '00000000-0000-4000-8000-0000000004a4', '00000000-0000-4000-8000-0000000004a5')), 0, 'paid, draft and switched-off KPRs stay quiet');
select is(private.enqueue_reminders('2026-11-23'), 0, 'running twice the same day sends nothing new');
select is(private.enqueue_reminders('2026-11-24'), 0, 'H-6 is not on the schedule');
select is(private.enqueue_reminders('2026-11-27'), 2, 'H-3 reminds r1 and r2 again');
select ok(exists (select 1 from cron.job where jobname = 'ruangkpr-reminders' and schedule = '0 0 * * *'), 'the job runs daily at 07:00 WIB');

select * from finish();
rollback;
