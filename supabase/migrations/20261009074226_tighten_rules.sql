-- Follow-ups from the Supabase linter (splinter) and review, 2026-10-09:
-- one permissive policy per role and action (Postgres evaluates every permissive policy on every row), an index for
-- the admin_notes foreign key, and staff may only create an active KPR from a disbursed application.

drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select private.has_role('super_admin')))
  with check (id = (select auth.uid()) or (select private.has_role('super_admin')));

drop policy if exists user_roles_select_own on public.user_roles;
drop policy if exists user_roles_select_admin on public.user_roles;
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_role('super_admin')));

create index if not exists admin_notes_application on public.admin_notes (application_id);

create or replace function private.mortgages_write()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_staff boolean := (select private.has_role('super_admin'));
begin
  new.status := coalesce(new.doc ->> 'status', 'draft');
  new.doc := jsonb_set(new.doc, '{id}', to_jsonb(new.id));
  if private.trusted() then return new; end if;

  if tg_op = 'INSERT' then
    if new.user_id = v_uid and new.status = 'draft' then return new; end if;
    -- Disbursement turns the akad terms of that user's disbursed application into the active KPR (mortgageFromApplication).
    if v_staff and new.status = 'active' then
      if exists (select 1 from public.applications a
                  where a.id = new.doc ->> 'applicationId' and a.user_id = new.user_id and a.status = 'disbursed') then
        return new;
      end if;
      perform private.fail('INVALID_STATE_TRANSITION', 'KPR aktif hanya dibuat dari pengajuan yang sudah cair.');
    end if;
    perform private.fail('INVALID_STATE_TRANSITION', 'KPR baru selalu dimulai dari pengaturan.');
  end if;

  if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
    perform private.fail('FORBIDDEN', 'Pemilik KPR tidak bisa diubah.');
  end if;
  if old.user_id = v_uid and old.status in ('draft', 'active')
     and (new.status = old.status or (old.status = 'draft' and new.status = 'active')) then return new; end if;
  if v_staff and (new.status = old.status or (old.status = 'active' and new.status = 'replaced')) then return new; end if;
  perform private.fail('INVALID_STATE_TRANSITION', 'Data KPR ini tidak bisa diubah.');
end $$;

revoke all on function private.mortgages_write() from public, anon;
