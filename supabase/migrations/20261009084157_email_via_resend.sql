-- Emails through Resend's HTTP API, sent from Postgres (pg_net + Vault): the login code (Send Email Hook) and the
-- reminder emails (Fase 4b). Replaces SMTP, the template server and the Edge Function (spec Amandemen 2), so the
-- self-hosted auth server only needs two hook variables.
--
-- One-time setup (SQL Editor, never commit the key):
--   select vault.create_secret('re_…', 'resend_api_key', 'Resend sending key for RuangKPR emails');
-- Optional, for the button in reminder emails:
--   select vault.create_secret('https://<domain-app>', 'app_url');

create or replace function private.vault_secret(p_name text)
returns text language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1
$$;

create or replace function private.html_escape(p_text text)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(replace(coalesce(p_text, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

-- One RuangKPR email: same card as supabase/templates/otp.html. `p_body_html` is already escaped.
create or replace function private.email_html(p_heading text, p_body_html text, p_button_url text default null, p_footer text default null)
returns text language sql immutable set search_path = '' as $$
  select '<!doctype html><html lang="id"><body style="margin:0;padding:24px;background:#f4f6fa;font-family:Arial,sans-serif;color:#0b1b33">'
    || '<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:24px;padding:32px">'
    || '<p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#003da5">RuangKPR</p>'
    || '<h1 style="margin:0 0 16px;font-size:22px">' || private.html_escape(p_heading) || '</h1>'
    || p_body_html
    || case when p_button_url is null then '' else
         '<p style="margin:24px 0 0"><a href="' || private.html_escape(p_button_url) || '" style="display:inline-block;background:#003da5;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">Buka RuangKPR</a></p>' end
    || case when p_footer is null then '' else
         '<p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#4a5568">' || private.html_escape(p_footer) || '</p>' end
    || '</div></body></html>'
$$;

-- Queues one email with Resend; pg_net sends it after the transaction commits (a rollback sends nothing).
create or replace function private.send_email(p_to text, p_subject text, p_html text, p_text text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_key text := private.vault_secret('resend_api_key');
begin
  if v_key is null then
    raise exception 'resend_api_key is not in Vault';
  end if;
  return net.http_post(
    url := 'https://api.resend.com/emails',
    body := jsonb_build_object('from', 'RuangKPR <noreply@firdiaudi.my.id>', 'to', jsonb_build_array(p_to),
                               'subject', p_subject, 'html', p_html, 'text', p_text),
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    timeout_milliseconds := 10000);
end $$;

-- Send Email Hook (GOTRUE_HOOK_SEND_EMAIL_URI=pg-functions://postgres/public/send_email_hook): the auth server hands
-- over the 6-digit code instead of sending through SMTP. Sign-in only uses codes (magic link / new account).
create or replace function public.send_email_hook(event jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_to text := event #>> '{user,email}';
  v_token text := coalesce(event #>> '{email_data,token}', '');
begin
  if coalesce(v_to, '') = '' or v_token = '' then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400, 'message', 'Email atau kode tidak ada.'));
  end if;
  perform private.send_email(
    v_to,
    'Kode masuk RuangKPR',
    private.email_html(
      'Kode masuk kamu',
      '<p style="margin:0 0 16px;font-size:15px;line-height:22px">Masukkan kode ini di halaman verifikasi RuangKPR:</p>'
        || '<p style="margin:0 0 16px;font-size:32px;font-weight:800;letter-spacing:8px">' || private.html_escape(v_token) || '</p>'
        || '<p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#4a5568">Kode berlaku 10 menit. Jangan bagikan kode ini ke siapa pun, termasuk tim RuangKPR.</p>',
      null,
      'Tidak merasa meminta kode? Abaikan email ini.'),
    format('Kode masuk RuangKPR kamu: %s. Berlaku 10 menit. Jangan bagikan kode ini ke siapa pun, termasuk tim RuangKPR.', v_token));
  return '{}'::jsonb;
exception when others then
  return jsonb_build_object('error', jsonb_build_object('http_code', 500, 'message', 'Email kode belum bisa dikirim.'));
end $$;

revoke all on function public.send_email_hook(jsonb) from public, anon, authenticated;
grant execute on function public.send_email_hook(jsonb) to supabase_auth_admin;

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
begin
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
      perform private.send_email(
        r.email,
        v_subject,
        private.email_html(
          v_subject,
          '<p style="margin:0 0 12px;font-size:15px;line-height:22px">Halo ' || private.html_escape(coalesce(nullif(r.first_name, ''), 'kamu')) || ',</p>'
            || '<p style="margin:0;font-size:15px;line-height:22px">' || private.html_escape(v_line) || '</p>',
          case when v_app is null then null else rtrim(v_app, '/') || v_route end,
          'Kamu menerima email ini karena mengaktifkan pengingat email. Ubah di Profil → Pengaturan pengingat.'),
        'Halo ' || coalesce(nullif(r.first_name, ''), 'kamu') || ', ' || v_line);
      update public.reminder_deliveries set status = 'sent', sent_at = now(), attempts = attempts + 1 where id = r.id;
      v_sent := v_sent + 1;
    exception when others then
      update public.reminder_deliveries set status = 'failed', attempts = attempts + 1, last_error = left(sqlerrm, 500) where id = r.id;
    end;
  end loop;
  return v_sent;
end $$;

-- The daily job: in-app reminders first, then their emails. Returns the emails sent.
create or replace function private.run_daily_reminders(p_today date default private.today())
returns integer language plpgsql security definer set search_path = '' as $$
begin
  perform private.enqueue_reminders(p_today);
  return private.send_reminder_emails(p_today);
end $$;

revoke all on function private.vault_secret(text), private.html_escape(text), private.email_html(text, text, text, text),
  private.send_email(text, text, text, text), private.send_reminder_emails(date), private.run_daily_reminders(date)
  from public, anon, authenticated;
grant execute on function private.send_email(text, text, text, text), private.email_html(text, text, text, text),
  private.html_escape(text) to supabase_auth_admin;

select cron.schedule('ruangkpr-reminders', '0 0 * * *', $$select private.run_daily_reminders()$$);
