-- New job list (OCCUPATIONS in src/lib/format.js): TNI / Polri joined "PNS / BUMN / TNI / Polri" (civil_servant),
-- and "Profesional" is no longer a listed job, so it stays as a job the admin typed. Only bank products held the
-- old values; profiles and applications had none when this ran.
create function pg_temp.new_jobs(p_jobs jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(distinct case j when 'military_police' then 'civil_servant' when 'professional' then 'Profesional' else j end), '[]'::jsonb)
  from jsonb_array_elements_text(p_jobs) j
$$;

update public.bank_products
set doc = jsonb_set(doc, '{eligibility,occupations}', pg_temp.new_jobs(doc #> '{eligibility,occupations}'))
where doc #> '{eligibility,occupations}' ?| array['military_police', 'professional'];

update public.bank_products
set doc = jsonb_set(doc, '{pendingRevision,eligibility,occupations}', pg_temp.new_jobs(doc #> '{pendingRevision,eligibility,occupations}'))
where doc #> '{pendingRevision,eligibility,occupations}' ?| array['military_police', 'professional'];

drop function pg_temp.new_jobs(jsonb);
