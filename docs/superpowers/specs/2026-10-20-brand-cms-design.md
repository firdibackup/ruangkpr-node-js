# Brand CMS: admin edits colours, fonts, card radius and logo at runtime

Builds on `2026-10-20-brand-theming-design.md`. The files in `src/brand/` and `public/brand/` stay the defaults;
a published brand from the admin overrides them for every visitor without a deploy.

## Decisions

- **Who:** super admin, page `/admin/brand` (module `brand`).
- **What:** three base colours (primary, secondary, CTA accent) with generated 11-step scales, an advanced panel to
  paste exact palettes, body and heading font from a curated list, card radius, logo and favicon (JPG/PNG, 1 MB,
  same rules as bank logos). Name, tagline, illustrations and status colours stay in files.
- **Flow:** save draft → preview the whole site with the draft (only that admin, until reload) → publish with a
  reason (audit log). "Kembalikan ke default" removes draft and published brand (reason, audit).
- **Out of scope:** email templates (static on the Supabase server), illustrations, dark mode.

## Data

Table `brand_settings` (`id` = `draft` | `published`, `doc` jsonb). RLS: everyone, signed in or not, reads
`published`; only the super admin reads `draft` and writes either. Bucket `brand-assets`: public read, super admin
writes, 1 MB, JPG/PNG. `apply_writes` learns the table. pgTAP: `014_brand_settings.test.sql`.

Doc (`settings`): `{ colors: { primary, secondary, accent }, overrides: { 'primary-500': '#…', … }, fonts: { body,
heading }, cardRadius, logo: { path, url } | null, favicon: { path, url } | null, version, updatedAt, updatedBy }`;
the published doc adds `publishedAt`, `publishedBy`.

## Engine (`src/brand/engine.js`)

`brandVars(settings)` returns only the CSS variables that differ by brand: the primary, secondary, accent and neutral
palettes (OKLCH scales; the chosen colour sits exactly on the step nearest its lightness; neutral is a low-chroma
scale of the primary hue; overrides win), the roles that follow the chosen colours (`--primary` with hover and
pressed, `--step-current`; `--cta` with its foreground, hover and pressed), `--body-font`, `--heading-font`, `--card-radius`.
Every other role keeps its `var(--palette-…)` mapping in `tokens.css`, which is declared on
`:root, [data-brand-scope]` so a preview container recomputes the roles from its own palettes.

Readable by construction: the primary role moves to the first darker step that reaches 4.5:1 on its own 50 step (it is
also the text colour of soft buttons on that step); the current-step dot to the first step from 400 with 3:1 on
white; the CTA foreground is whichever of white and primary-900 contrasts more, the CTA moves a step at a time until
one reaches 4.5:1, and its hover/pressed go lighter instead of darker when darker would lose the text. The editor
names the shade it uses when it differs from the chosen colour. `brandIssues(vars)` checks the same pairs as `brand.test.js` (both read
`PAIRS` from `src/brand/theme.js`); publish is refused while any fails. `DEFAULT_SETTINGS` is read from `tokens.css`, and a test
asserts `brandVars(DEFAULT_SETTINGS)` reproduces the file.

## Runtime (`src/brand/live.js`)

`main.jsx` reads the published brand (`api.brand.published()`, public; timeout 1.5 s → file defaults) before the
first render and paints it: inline variables on `<html>`, a Google Fonts link for non-default fonts, favicon and
theme colour. `useLiveBrand()` gives the logo to `Brand()`. Preview paints the draft the same way and shows a bar
("Kembali ke editor", "Akhiri pratinjau"); while previewing, staff may open the B2C pages.

## API

`api.brand.published()`; `api.admin.brand.get()`, `.saveDraft({ settings, logo, favicon, expectedVersion })`,
`.publish({ reason, expectedVersion })`, `.reset({ reason })`. Logic in `mockApi.js` over the store (demo keeps
logos as data URLs); the Supabase adapter uploads files to `brand-assets`, removes files no brand references any
more, and reads the published row directly (guests have no store data).
