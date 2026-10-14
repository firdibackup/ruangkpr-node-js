-- User change history (spec 2026-10-09, Amandemen 4): what a user changes in their own profile, finance and active
-- KPR (payments included), old → new, for the admin user and KPR pages. Only these triggers write it, so a user can
-- neither skip nor forge an entry. Admin edits are not logged here: audit_log already has them, with a reason.

create table public.user_changes (
  id text primary key default 'chg_' || gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  doc jsonb not null, -- { action, resource: { type, id, label }, before: { key: value }, after: { key: value } }
  occurred_at timestamptz not null default now()
);
create index user_changes_user on public.user_changes (user_id, occurred_at desc);

alter table public.user_changes enable row level security;
revoke all on public.user_changes from anon, authenticated;
grant all on public.user_changes to service_role;
grant select on public.user_changes to authenticated;
create policy user_changes_select on public.user_changes for select to authenticated using ((select private.has_role('super_admin')));

-- The keys whose value differs, as { key: old } and { key: new }. Missing, JSON null and "" count as the same empty.
create or replace function private.changed(p_old jsonb, p_new jsonb, p_keys text[], p_prefix text default '')
returns table (before jsonb, after jsonb) language sql immutable set search_path = '' as $$
  with v as (
    select k, nullif(nullif(p_old -> k, 'null'::jsonb), '""'::jsonb) as o, nullif(nullif(p_new -> k, 'null'::jsonb), '""'::jsonb) as n
    from unnest(p_keys) k
  )
  select coalesce(jsonb_object_agg(p_prefix || k, coalesce(o, 'null'::jsonb)), '{}'::jsonb),
         coalesce(jsonb_object_agg(p_prefix || k, coalesce(n, 'null'::jsonb)), '{}'::jsonb)
  from v where o is distinct from n
$$;

-- Same mask as maskNik() in the app: first 4 and last 4 digits.
create or replace function private.mask_nik(p_nik text)
returns text language sql immutable set search_path = '' as $$
  select case when p_nik is null then null else left(p_nik, 4) || '********' || right(p_nik, 4) end
$$;

create or replace function private.log_change(p_user uuid, p_action text, p_resource jsonb, p_before jsonb, p_after jsonb)
returns void language sql set search_path = '' as $$
  insert into public.user_changes (user_id, doc)
  values (p_user, jsonb_build_object('action', p_action, 'resource', p_resource, 'before', p_before, 'after', p_after))
$$;

create or replace function private.log_profile_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_res jsonb := jsonb_build_object('type', 'user', 'id', new.id, 'label', new.full_name);
  v_b jsonb;
  v_a jsonb;
begin
  -- Only the owner's own edits: admin edits are in audit_log, jobs and migrations have no auth.uid().
  if new.id is distinct from (select auth.uid()) then return null; end if;
  select c.before, c.after into v_b, v_a from private.changed(
    old.personal || jsonb_build_object('fullName', old.full_name, 'phone', old.phone, 'nik', private.mask_nik(old.nik)),
    new.personal || jsonb_build_object('fullName', new.full_name, 'phone', new.phone, 'nik', private.mask_nik(new.nik)),
    array['fullName', 'nik', 'birthPlace', 'birthDate', 'gender', 'maritalStatus', 'address', 'phone', 'occupation', 'companyName', 'jobTitle', 'workYears', 'workMonths']) c;
  if v_a <> '{}'::jsonb then perform private.log_change(new.id, 'profile', v_res, v_b, v_a); end if;
  select c.before, c.after into v_b, v_a from private.changed(old.finance, new.finance,
    array['monthlyIncome', 'jointIncome', 'partnerIncome', 'vehicleDebt', 'cardDebt', 'otherDebt']) c;
  if v_a <> '{}'::jsonb then perform private.log_change(new.id, 'finance', v_res, v_b, v_a); end if;
  return null;
end $$;

-- Setup drafts are not history; an active KPR logs its data, property and reminders, and each payment marked or undone.
-- Its finance copy is left out: it follows the profile, which logs it once.
create or replace function private.log_mortgage_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_res jsonb := jsonb_build_object('type', 'mortgage', 'id', new.id, 'label', concat_ws(' · ', nullif(new.doc ->> 'bankName', ''), nullif(new.doc ->> 'productName', '')));
  v_old_pay jsonb := coalesce(old.doc -> 'payments', '[]'::jsonb);
  v_new_pay jsonb := coalesce(new.doc -> 'payments', '[]'::jsonb);
  v_b jsonb;
  v_a jsonb;
  v_b2 jsonb;
  v_a2 jsonb;
  v_b3 jsonb;
  v_a3 jsonb;
  v_p jsonb;
begin
  if new.user_id is distinct from (select auth.uid()) then return null; end if;
  if old.status = 'draft' and new.status = 'active' then
    perform private.log_change(new.user_id, 'mortgage.activate', v_res, '{}'::jsonb, '{}'::jsonb);
    return null;
  end if;
  if old.status <> 'active' or new.status <> 'active' then return null; end if;

  select c.before, c.after into v_b, v_a from private.changed(old.doc, new.doc,
    array['bankName', 'productName', 'scheme', 'originalPrincipal', 'originalTenorMonths', 'startDate', 'dueDay', 'currentPayment',
          'outstandingPrincipal', 'remainingTenorMonths', 'currentRateBps', 'currentRateType', 'fixedUntil', 'estimatedFloatingRateBps']) c;
  select c.before, c.after into v_b2, v_a2 from private.changed(old.doc -> 'property', new.doc -> 'property',
    array['type', 'address', 'city', 'landArea', 'buildingArea', 'certificateType', 'certificateOwner', 'estimatedValue', 'valueAsOf', 'disputed'], 'property.') c;
  select c.before, c.after into v_b3, v_a3 from private.changed(old.doc -> 'reminders', new.doc -> 'reminders',
    array['payment', 'fixedExpiry', 'channels'], 'reminders.') c;
  if (v_a || v_a2 || v_a3) <> '{}'::jsonb then
    perform private.log_change(new.user_id, 'mortgage.update', v_res, v_b || v_b2 || v_b3, v_a || v_a2 || v_a3);
  end if;

  for v_p in select x from jsonb_array_elements(v_new_pay) x where not v_old_pay @> jsonb_build_array(jsonb_build_object('id', x -> 'id')) loop
    perform private.log_change(new.user_id, 'payment.mark', v_res, '{}'::jsonb,
      jsonb_build_object('dueDate', v_p -> 'dueDate', 'amount', v_p -> 'amount', 'paidAt', v_p -> 'paidAt'));
  end loop;
  for v_p in select x from jsonb_array_elements(v_old_pay) x where not v_new_pay @> jsonb_build_array(jsonb_build_object('id', x -> 'id')) loop
    perform private.log_change(new.user_id, 'payment.unmark', v_res, jsonb_build_object('dueDate', v_p -> 'dueDate', 'amount', v_p -> 'amount'), '{}'::jsonb);
  end loop;
  return null;
end $$;

create trigger profiles_log_change after update on public.profiles for each row execute function private.log_profile_change();
create trigger mortgages_log_change after update on public.mortgages for each row execute function private.log_mortgage_change();

revoke all on function private.changed(jsonb, jsonb, text[], text), private.mask_nik(text),
  private.log_change(uuid, text, jsonb, jsonb, jsonb), private.log_profile_change(), private.log_mortgage_change() from public, anon, authenticated;
