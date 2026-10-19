-- Reminder emails learn Resend's answer and are tried again, and the job runs every hour so a missed morning is caught up.
-- Before, an email was `sent` as soon as pg_net queued it (a refused key stayed invisible) and a server that was down at
-- 07:00 WIB skipped that day. Now an email is `sending` until a later run reads Resend's answer from pg_net (kept 6
-- hours): a 2xx makes it `sent`; an error, a timeout or an answer lost in a restart queues it again, up to 3 tries, then
-- it is `failed` with `last_error`. A retry only happens on the email's own day: an older one is skipped, as before.
-- ponytail: an answer lost after Resend took the email (a crash in that window) sends it twice; pass Resend an
-- Idempotency-Key per delivery if that ever matters.

alter table public.reminder_deliveries add column request_id bigint;
alter table public.reminder_deliveries drop constraint reminder_deliveries_status_check,
  add constraint reminder_deliveries_status_check check (status in ('queued', 'sending', 'sent', 'failed', 'skipped'));

-- Settles every email handed to pg_net that has an answer, or lost it (no answer and no longer in pg_net's queue).
-- Returns how many were settled.
create or replace function private.check_reminder_emails()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_settled integer;
begin
  update public.reminder_deliveries d
     set status = case when a.ok then 'sent' when d.attempts < 3 then 'queued' else 'failed' end,
         last_error = case when a.ok then d.last_error else left(a.error, 500) end
    from (
      select s.id, r.status_code between 200 and 299 as ok,
             coalesce(r.error_msg, 'HTTP ' || r.status_code || ': ' || left(coalesce(r.content, ''), 300), 'No answer from Resend') as error
        from public.reminder_deliveries s
        left join net._http_response r on r.id = s.request_id
       where s.status = 'sending'
         and (r.id is not null
              or (s.sent_at < now() - interval '10 minutes'
                  and not exists (select 1 from net.http_request_queue q where q.id = s.request_id)))
    ) a
   where d.id = a.id;
  get diagnostics v_settled = row_count;
  return v_settled;
end $$;

-- Fase 4b: the reminder emails queued by enqueue_reminders. An email whose day (target date minus its H-x) has
-- passed is stale (the "7 hari lagi" would be wrong) and is skipped instead of sent late.
create or replace function private.send_reminder_emails(p_today date default private.today())
returns integer language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_sent integer := 0;
  v_app text := private.vault_secret('app_url');
  v_when text;
  v_subject text;
  v_line text;
  v_route text;
  v_request bigint;
begin
  perform private.check_reminder_emails();

  update public.reminder_deliveries set status = 'skipped'
   where channel = 'email' and status = 'queued' and target_date - offset_days < p_today;

  for r in
    select d.id, d.kind, d.target_date, d.offset_days, p.email, split_part(btrim(p.full_name), ' ', 1) as first_name,
           coalesce(m.doc ->> 'bankName', 'bank') as bank
      from public.reminder_deliveries d
      join public.profiles p on p.id = d.user_id
      join public.mortgages m on m.id = d.mortgage_id
     where d.channel = 'email' and d.status = 'queued'
     order by d.id
  loop
    v_when := case when r.offset_days = 0 then 'hari ini' else r.offset_days || ' hari lagi' end;
    if r.kind = 'payment' then
      v_subject := 'Cicilan KPR jatuh tempo ' || private.date_label(r.target_date);
      v_line := format('Cicilan KPR %s jatuh tempo %s (%s). Setelah membayar, tandai pembayaranmu di RuangKPR.', r.bank, private.date_label(r.target_date), v_when);
      v_route := '/my-kpr/payment';
    else
      v_subject := format('Masa fixed KPR berakhir dalam %s hari', r.offset_days);
      v_line := format('Bunga fixed KPR %s berakhir %s. Setelah itu cicilan mengikuti bunga floating. Lihat estimasi dampaknya di RuangKPR.', r.bank, private.date_label(r.target_date));
      v_route := '/my-kpr/rate';
    end if;
    begin
      v_request := private.send_email(
        r.email,
        v_subject,
        private.email_html(
          v_subject,
          '<p style="margin:0 0 12px;font-size:15px;line-height:22px">Halo ' || private.html_escape(coalesce(nullif(r.first_name, ''), 'kamu')) || ',</p>'
            || '<p style="margin:0;font-size:15px;line-height:22px">' || private.html_escape(v_line) || '</p>',
          case when v_app is null then null else rtrim(v_app, '/') || v_route end,
          'Kamu menerima email ini karena mengaktifkan pengingat email. Ubah di Profil → Pengaturan pengingat.'),
        'Halo ' || coalesce(nullif(r.first_name, ''), 'kamu') || ', ' || v_line);
      update public.reminder_deliveries set status = 'sending', request_id = v_request, sent_at = now(), attempts = attempts + 1 where id = r.id;
      v_sent := v_sent + 1;
    exception when others then
      update public.reminder_deliveries set status = case when attempts + 1 < 3 then 'queued' else 'failed' end,
             attempts = attempts + 1, last_error = left(sqlerrm, 500) where id = r.id;
    end;
  end loop;
  return v_sent;
end $$;

-- The hourly job. Before 07:00 WIB it only reads Resend's answers, so nobody is reminded at night; from 07:00 on each
-- run reminds and sends what is still due today (every step happens once), so the first run after a downtime catches
-- up. Returns the emails handed to Resend.
drop function private.run_daily_reminders(date);
create function private.run_reminders(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (p_now at time zone 'Asia/Jakarta')::date;
begin
  if extract(hour from p_now at time zone 'Asia/Jakarta') < 7 then
    perform private.check_reminder_emails();
    return 0;
  end if;
  perform private.enqueue_reminders(v_today);
  return private.send_reminder_emails(v_today);
end $$;

revoke all on function private.check_reminder_emails(), private.run_reminders(timestamptz) from public, anon, authenticated;

select cron.schedule('ruangkpr-reminders', '0 * * * *', $$select private.run_reminders()$$);
