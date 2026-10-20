# Brand theming: Teal / Aqua + clone parameters

## Goal

Replace the RE/MAX navy/red look with the Teal / Aqua colour system (Pencil "Color System · Teal / Aqua", light theme)
and make the brand a parameter set, so a copied repo becomes another site by editing one folder. Per clone:
colours, card radius, logo, fonts, brand name/tagline, illustrations. Clones are manual copies of the repo
(no multi-tenant build, no runtime theming).

## Decisions

- **Typography:** font family only (body + heading); the type scale stays as written in components.
  This version keeps Plus Jakarta Sans.
- **Radius:** one parameter, `--radius-card` (24px). Buttons stay pills, controls keep their radius.
- **Contacts:** WhatsApp CS already lives in admin configuration; only the default booking URL moves to the brand.
- **Out of scope:** the admin cover letter (RE/MAX form with its own logo), the type scale, dark mode,
  new illustration artwork (current `.webp` files move to `public/brand/` unchanged).

## Structure

| Layer | File | Holds | Clone edits |
|---|---|---|---|
| Primitives | `src/brand/tokens.css` | 88 hex: `--palette-{primary,secondary,accent,neutral,success,danger,warning,info}-{50..950}` | always |
| Semantic | `src/brand/tokens.css` | UI roles → `var(--palette-…)`, fonts, card radius, hero/opp gradients, shadows | only when its scales differ in character |
| Utilities | `src/styles/globals.css` `@theme inline` | `--color-x: var(--x)` | never |
| Identity | `src/brand/brand.js` | name, tagline, theme colour, Google Fonts URL, booking URL | always |
| Assets | `public/brand/` | logo, favicon, illustrations, service images (fixed file names) | always |

Palette names are roles, not hues. Semantic names follow shadcn so future shadcn components pick up the theme.

## Mapping

Surfaces/text: `background` neutral-50, `card`/`popover` white, `muted` neutral-100, `foreground` primary-900
(absorbs `ink-2`), `muted-foreground` neutral-600 (absorbs `ink-3`), `border` neutral-200 (absorbs `line`),
`input` neutral-500, `border-strong` neutral-600, `field` white, `placeholder` neutral-600,
`inverse`/`inverse-foreground` primary-900/neutral-50.

Interaction: `primary` primary-900, `primary-hover` primary-600 (was `primary-dark`), `primary-pressed` primary-950,
`secondary`/`secondary-hover` primary-50/100, `cta`/`cta-hover`/`cta-pressed` accent-400/500/600 with
`cta-foreground` primary-900 (dark surfaces only; the `inverse` button variant), `link` and `highlight` secondary-700,
`ring` accent-700 (2px solid, 2px offset), `selection` secondary-100, `disabled` neutral-100/neutral-500.

Status `success | warning | danger | info`: `{s}` text 700, `{s}-bg` 50, `{s}-border` 600, `{s}-solid` 600
(warning 700). Renames: `success-strong`→`success-solid`, `warning-text`→`warning`, `warning-soft`→`warning-bg`,
`warning-accent`→`warning-border`/`warning-solid`, `danger-strong`→`danger-solid`/`danger`; `brand-red` splits into
`danger-solid` (errors, rejected, unread) and `highlight` (tagline, eyebrow).

Special surfaces: hero primary-950→primary-700; opportunity tile secondary-800→700→800 with a 15% glow
(white text ≥ 4.7:1); charts `principal` accent-600, `interest`/`step` info-600 (dataviz validator: all checks pass,
contrast WARN covered by legends/tooltips), status series ok/bad at 600 and warn at 500 (warn 600 failed the
CVD check beside ok and bad), track neutral-100; progress current step primary-400;
`HouseIllustration` reads palette variables.

## Guards

`src/brand/brand.test.js`: WCAG contrast of the semantic pairs, all 88 primitives present and every semantic
`var()` resolves, no hex colour in `src/**/*.{js,jsx}` outside `src/brand/` and tests, font family present in
`fontsUrl`, required `public/brand/` files exist, Supabase email templates carry the brand name and theme colour.

## Docs

`BRANDING.md` (clone checklist), `CLAUDE.md` visual baseline points at `src/brand/`, `PRODUCT.md` brand line.
