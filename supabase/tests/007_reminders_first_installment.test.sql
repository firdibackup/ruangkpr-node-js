-- Run: npx supabase test db (local) or through the /pg runner: everything rolls back.
-- The akad day is never an installment (derive.js firstDue), so the payment reminder skips it. Only this test's KPR is
-- checked: the job also walks every real KPR in the database it runs on.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000007a1', 'a1@test.local', '{}', 'authenticated', 'authenticated');
insert into public.mortgages (id, user_id, doc) values
  -- akad on 13 Oct 2026 and jatuh tempo every 13th; reminded H-7 and on the due day, in-app only
  ('mtg_a1', '00000000-0000-4000-8000-0000000007a1', '{"status":"active","bankName":"Bank Akad","startDate":"2026-10-13","dueDay":13,"currentRateType":"floating","payments":[],"reminders":{"payment":[7,0],"fixedExpiry":[],"channels":{"inApp":true,"email":false}}}');

select lives_ok($$select private.enqueue_reminders('2026-10-13')$$, 'the job runs on the akad day');
select is((select count(*)::int from public.reminder_deliveries where mortgage_id = 'mtg_a1'), 0, 'the akad day itself is not reminded as a due date');
select lives_ok($$select private.enqueue_reminders('2026-11-06')$$, 'the job runs a week before the first installment');
select is((select array_agg(target_date) from public.reminder_deliveries where mortgage_id = 'mtg_a1'), array['2026-11-13'::date], 'H-7 reminds of 13 Nov, the first installment');
select lives_ok($$select private.enqueue_reminders('2026-11-13')$$, 'the job runs on that due date');
select is((select count(*)::int from public.reminder_deliveries where mortgage_id = 'mtg_a1' and offset_days = 0), 1, 'after the akad the due day itself is reminded as before');

select * from finish();
rollback;
