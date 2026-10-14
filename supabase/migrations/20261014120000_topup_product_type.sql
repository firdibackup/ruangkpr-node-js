-- "Take Over + Top-up" is its own product type now (admin "Jenis produk"): a top-up only compares products marked
-- 'topup', each with the purposes it accepts. The published Take Over products were offering top-up with no purposes
-- recorded, so they get the type and every purpose; the admin narrows them per bank.
update public.bank_products
set doc = jsonb_set(
  jsonb_set(doc, '{productTypes}', (doc -> 'productTypes') || '"topup"'),
  '{eligibility,purposes}',
  coalesce(nullif(doc #> '{eligibility,purposes}', '[]'), '["renovation", "education", "business", "debt_consolidation", "other"]')
)
where doc ->> 'status' = 'published'
  and doc -> 'productTypes' ? 'takeover'
  and not doc -> 'productTypes' ? 'topup';
