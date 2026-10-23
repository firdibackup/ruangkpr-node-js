-- Rebrand existing installations as well as fresh installs. Keep delivery addresses,
-- permissions, cron identity, and retry logic intact; only presentation strings change.
do $$
declare
  signature text;
  definition text;
begin
  foreach signature in array array[
    'private.email_html(text,text,text,text)',
    'private.send_email(text,text,text,text)',
    'public.send_email_hook(jsonb)',
    'private.send_reminder_emails(date)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    definition := replace(definition, 'RuangKPR', 'Maxi');
    definition := replace(definition, '#003da5', '#03313a');
    definition := replace(definition, '#0b1b33', '#03313a');
    definition := replace(definition, '#f4f6fa', '#f7f8f6');
    definition := replace(definition, '#4a5568', '#56675f');
    execute definition;
  end loop;
end $$;

-- Only seeded educational copy, not account data, audit history or user documents.
update public.articles
   set doc = jsonb_set(doc, '{body}', replace((doc -> 'body')::text, 'RuangKPR', 'Maxi')::jsonb),
       updated_at = now()
 where id in ('art_fixed-vs-floating', 'art_biaya-tersembunyi')
   and (doc -> 'body')::text like '%RuangKPR%';
