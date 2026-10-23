// Brand identity. A clone edits this file, src/brand/tokens.css and the files in public/brand/ (BRANDING.md).
// Plain data without imports: vite.config.js reads it for index.html.
export const brand = {
  name: 'Maxi',
  logo: '/maxi-logo-horizontal-color.svg',
  logoWhite: '/maxi-logo-horizontal-white.svg',
  favicon: '/brand/favicon.svg',
  // Under the name in the app shell; the admin shell shows the staff role instead.
  tagline: 'Command Center',
  // <meta name="theme-color"> and the accent of supabase/templates/*.html. Same value as --primary in tokens.css.
  themeColor: '#03313a',
  // Must load every family in tokens.css (--body-font, --heading-font) with weights 400–800.
  fontsUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  // Existing support inbox retained during the Maxi rebrand.
  supportEmail: 'cs@ruangkpr.id',
  // Consultation booking page until an admin sets one in Konfigurasi → Kontak CS.
  bookingUrl: 'https://cal.com/creative-karsindo-wr7vhx/konsultasi-kpr',
}

// Files every brand ships in public/brand/ (same names; sizes in BRANDING.md). brand.test.js checks they exist.
export const BRAND_FILES = [
  '../maxi-logo-horizontal-color.svg',
  '../maxi-logo-horizontal-white.svg',
  'logo.svg',
  'favicon.svg',
  'cover-auth.webp',
  'card-kpr.webp',
  'card-overview.webp',
  'no-kpr-page.webp',
  'service/1.webp',
  'service/2.webp',
  'icon-service/256/kpr-primary.webp',
  'icon-service/256/take-over.webp',
  'icon-service/256/refinancing.webp',
]
