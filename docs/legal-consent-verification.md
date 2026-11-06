# Legal information — frontend only

Scope revised by the user on 6 November 2026: frontend information only.

- Four public legal documents, footer links, operator information and archival disclosure.
- Separate account terms/privacy checkboxes using the existing authentication contract and consent version.
- Informational privacy notices beside application document uploads.
- No API, database, migration, Storage policy, archival logic or new consent-persistence changes relative to baseline `9cab08c`.

The earlier backend implementation remains on local branch `feat/legal-privacy`; this frontend-only branch supersedes it for delivery. Nothing has been applied to production. Runtime logo changes do not change the operator configured in `src/brand/brand.js`.

Verification after narrowing scope: 392 unit tests passed, 14 live integration tests skipped; 21 targeted Playwright tests passed (auth, legal desktop/mobile, primary and takeover). Lint passed with nine existing warnings; production build passed with the existing bundle-size warning. Diff against baseline contains no changes under `src/data` or `supabase`.
