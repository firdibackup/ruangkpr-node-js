-- Fase 4a (spec 2026-10-09 §5): a daily job writes in-app reminders before each due date and before the fixed rate
-- ends, from each active KPR's own reminder settings. Email deliveries are left `queued` for the sender (Fase 4b).
-- ponytail: no catch-up for a missed day (the next offset still fires); add one if a run is ever skipped.

create extension if not exists pg_cron;

create table public.reminder_deliveries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mortgage_id text not null references public.mortgages (id) on delete cascade,
  kind text not null check (kind in ('payment', 'fixed_expiry')),
  target_date date not null,
  offset_days integer not null,
  channel text not null check (channel in ('in_app', 'email')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  -- One reminder per event and channel, however often the job runs.
  constraint reminder_deliveries_once unique (mortgage_id, kind, target_date, offset_days, channel)
);
create index reminder_deliveries_queue on public.reminder_deliveries (status, channel) where status = 'queued';
create index reminder_deliveries_user on public.reminder_deliveries (user_id);

-- Only the job (postgres) and the email sender (service_role) work with it; no user ever reads it.
alter table public.reminder_deliveries enable row level security;
revoke all on public.reminder_deliveries from anon, authenticated;
grant all on public.reminder_deliveries to service_role;

-- nextDueDate() in src/calculations/dates.js: the first due date on or after p_today, clamped to the month end.
create or replace function private.next_due_date(p_today date, p_due_day integer)
returns date language sql immutable set search_path = '' as $$
  select case when this_month >= p_today then this_month else next_month end
  from (
    select date_trunc('month', p_today)::date
             + (least(p_due_day, extract(day from date_trunc('month', p_today) + interval '1 month - 1 day')::integer) - 1) as this_month,
           (date_trunc('month', p_today) + interval '1 month')::date
             + (least(p_due_day, extract(day from date_trunc('month', p_today) + interval '2 month - 1 day')::integer) - 1) as next_month
  ) d
$$;

-- dateShort() in src/lib/format.js: "30 Nov 2026".
create or replace function private.date_label(p_date date)
returns text language sql immutable set search_path = '' as $$
  select extract(day from p_date)::integer || ' '
         || (array['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'])[extract(month from p_date)::integer]
         || ' ' || extract(year from p_date)::integer
$$;

-- Records one delivery per enabled channel; the in-app one becomes an Activity right away. Returns 1 when the
-- in-app notification was new.
create or replace function private.remind(p_mortgage record, p_kind text, p_target date, p_offset integer, p_activity jsonb)
returns integer language plpgsql set search_path = '' as $$
declare
  v_channel text;
  v_new integer;
  v_made integer := 0;
  v_id text;
begin
  foreach v_channel in array array['in_app', 'email'] loop
    continue when not coalesce((p_mortgage.doc #>> array['reminders', 'channels', case v_channel when 'in_app' then 'inApp' else 'email' end])::boolean, false);
    insert into public.reminder_deliveries (user_id, mortgage_id, kind, target_date, offset_days, channel, status, sent_at)
    values (p_mortgage.user_id, p_mortgage.id, p_kind, p_target, p_offset, v_channel,
            case v_channel when 'in_app' then 'sent' else 'queued' end, case v_channel when 'in_app' then now() end)
    on conflict on constraint reminder_deliveries_once do nothing;
    get diagnostics v_new = row_count;
    if v_new > 0 and v_channel = 'in_app' then
      v_id := 'act_' || gen_random_uuid();
      insert into public.activities (id, user_id, doc)
      values (v_id, p_mortgage.user_id, p_activity || jsonb_build_object(
        'id', v_id,
        'occurredAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'readAt', null));
      v_made := 1;
    end if;
  end loop;
  return v_made;
end $$;

create or replace function private.enqueue_reminders(p_today date default private.today())
returns integer language plpgsql security definer set search_path = '' as $$
declare
  m record;
  v_due date;
  v_offset integer;
  v_days integer;
  v_made integer := 0;
begin
  for m in select id, user_id, doc from public.mortgages where status = 'active' loop
    -- Payment: H-x before the next due date that is not marked paid yet.
    if coalesce(m.doc ->> 'dueDay', '') ~ '^[0-9]+$' then
      v_due := private.next_due_date(p_today, (m.doc ->> 'dueDay')::integer);
      v_offset := v_due - p_today;
      if exists (select 1 from jsonb_array_elements_text(coalesce(m.doc #> '{reminders,payment}', '[]'::jsonb)) x where x::integer = v_offset)
         and not exists (select 1 from jsonb_array_elements(coalesce(m.doc -> 'payments', '[]'::jsonb)) p
                          where p ->> 'dueDate' = v_due::text and coalesce(p ->> 'status', 'paid') = 'paid') then
        v_made := v_made + private.remind(m, 'payment', v_due, v_offset, jsonb_build_object(
          'type', 'payment_due_reminder',
          'category', 'reminder',
          'title', case when v_offset = 0 then 'Cicilan jatuh tempo hari ini' else format('Cicilan jatuh tempo %s hari lagi', v_offset) end,
          'body', format('Jatuh tempo %s di %s. Tandai pembayaran setelah kamu bayar.', private.date_label(v_due), coalesce(m.doc ->> 'bankName', 'bank')),
          'action', jsonb_build_object('label', 'Lihat pembayaran', 'route', '/my-kpr/payment')));
      end if;
    end if;
    -- Fixed rate: H-90/60/30/14/7 before it turns floating.
    if m.doc ->> 'currentRateType' = 'fixed' and coalesce(m.doc ->> 'fixedUntil', '') ~ '^\d{4}-\d{2}-\d{2}$' then
      v_days := (m.doc ->> 'fixedUntil')::date - p_today;
      if v_days > 0 and exists (select 1 from jsonb_array_elements_text(coalesce(m.doc #> '{reminders,fixedExpiry}', '[]'::jsonb)) x where x::integer = v_days) then
        v_made := v_made + private.remind(m, 'fixed_expiry', (m.doc ->> 'fixedUntil')::date, v_days, jsonb_build_object(
          'type', 'fixed_expiry_warning',
          'category', 'warning',
          'title', format('Fixed rate berakhir dalam %s hari', v_days),
          'body', 'Lihat estimasi dampak ke cicilan kamu.',
          'action', jsonb_build_object('label', 'Lihat dampak', 'route', '/my-kpr/rate')));
      end if;
    end if;
  end loop;
  return v_made;
end $$;

revoke all on function private.next_due_date(date, integer), private.date_label(date),
  private.remind(record, text, date, integer, jsonb), private.enqueue_reminders(date) from public, anon, authenticated;

-- 00:00 UTC = 07:00 WIB. Scheduling under the same name replaces the job.
select cron.schedule('ruangkpr-reminders', '0 0 * * *', $$select private.enqueue_reminders()$$);
