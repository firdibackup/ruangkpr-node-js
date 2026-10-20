// Brand identity. A clone edits this file, src/brand/tokens.css and the files in public/brand/ (BRANDING.md).
// Plain data without imports: vite.config.js reads it for index.html.
export const brand = {
  name: 'RuangKPR',
  // Under the name in the app shell; the admin shell shows the staff role instead.
  tagline: 'Command Center',
  // <meta name="theme-color"> and the accent of supabase/templates/*.html. Same value as --primary in tokens.css.
  themeColor: '#003036',
  // Must load every family in tokens.css (--body-font, --heading-font) with weights 400–800.
  fontsUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  supportEmail: 'cs@ruangkpr.id',
  // Consultation booking page until an admin sets one in Konfigurasi → Kontak CS.
  bookingUrl: 'https://cal.com/creative-karsindo-wr7vhx/konsultasi-kpr',
}

// Files every brand ships in public/brand/ (same names; sizes in BRANDING.md). brand.test.js checks they exist.
export const BRAND_FILES = [
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
