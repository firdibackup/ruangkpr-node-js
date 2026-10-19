-- Bank logos (spec 2026-10-19): a public bucket only the super admin writes; every signed-in user reads every bank,
-- since a KPR may sit at a bank that left matching; records saved before bankId get it when their bank name matches.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('bank-logos', 'bank-logos', true, 1048576, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- {uuid}.{ext}; reading goes through the public URL. remove() needs select as well as delete.
create policy bank_logos_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'bank-logos' and (select private.has_role('super_admin')));
create policy bank_logos_select on storage.objects for select to authenticated using (
  bucket_id = 'bank-logos' and (select private.has_role('super_admin')));
create policy bank_logos_delete on storage.objects for delete to authenticated using (
  bucket_id = 'bank-logos' and (select private.has_role('super_admin')));

-- "Nonaktif" only takes a bank out of matching (bank_products_select still checks b.active).
drop policy banks_select on public.banks;
create policy banks_select on public.banks for select to authenticated using (true);

-- Runs as postgres (private.trusted), so the status triggers pass it and no user change is logged.
update public.mortgages m set doc = m.doc || jsonb_build_object('bankId', b.id)
  from public.banks b
 where m.doc ->> 'bankId' is null and b.doc ->> 'name' = m.doc ->> 'bankName';
update public.applications a set doc = jsonb_set(a.doc, '{selection,bankId}', to_jsonb(p.bank_id))
  from public.bank_products p
 where jsonb_typeof(a.doc -> 'selection') = 'object' and a.doc #>> '{selection,bankId}' is null
   and p.id = a.doc #>> '{selection,bankProductId}' and p.bank_id is not null;
update public.applications a set doc = jsonb_set(a.doc, '{data,oldLoan,bankId}', to_jsonb(b.id))
  from public.banks b
 where jsonb_typeof(a.doc #> '{data,oldLoan}') = 'object' and a.doc #>> '{data,oldLoan,bankId}' is null
   and b.doc ->> 'name' = a.doc #>> '{data,oldLoan,bankName}';
