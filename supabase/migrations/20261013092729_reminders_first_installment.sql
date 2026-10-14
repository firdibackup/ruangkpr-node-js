-- The akad day is never an installment (src/domains/mortgages/derive.js firstDue). A KPR monitored from its akad day,
-- with the due day on that same date, was reminded "Cicilan jatuh tempo hari ini" on the akad day itself. On or before
-- the akad the next due date now counts from the day after it, as the app does. Everything else is unchanged.
create or replace function private.enqueue_reminders(p_today date default private.today())
returns integer language plpgsql security definer set search_path = '' as $$
declare
  m record;
  v_from date;
  v_due date;
  v_offset integer;
  v_days integer;
  v_made integer := 0;
begin
  for m in select id, user_id, doc from public.mortgages where status = 'active' loop
    -- Payment: H-x before the next due date that is not marked paid yet; the akad day is not one.
    if coalesce(m.doc ->> 'dueDay', '') ~ '^[0-9]+$' then
      v_from := case when coalesce(m.doc ->> 'startDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
                     then greatest(p_today, (m.doc ->> 'startDate')::date + 1) else p_today end;
      v_due := private.next_due_date(v_from, (m.doc ->> 'dueDay')::integer);
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
