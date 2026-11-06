# Legal consent verification — 2026-11-06

Branch: `feat/legal-privacy`. No production migration or deployment performed.

## Changes

- Four public legal documents and footer links; separate account terms/privacy checkboxes.
- Explicit per-file consent before application uploads; exact-path evidence checked by Storage RLS.
- Evidence survives application cancellation and is copied into account archives at closure.
- Submission consent records the chosen program, current version, and server timestamp. Existing/carried-over files are covered by the new explicit submission consent, not fabricated historical upload consent.
- Mortgage monitoring data confirmation is persisted. Payment-proof selection retains its existing flow.

## Checks

- Vitest: 395 passed, 14 live integration tests skipped. Final legal version/SQL drift test: 2 passed.
- Lint: passed, nine existing warnings. Production build passed, with existing large-bundle warning.
- Playwright: auth, public legal desktop/mobile, primary, takeover, calculator handoff, admin application review, and demo journeys passed across targeted runs.
- Two mortgage-monitoring tests fail identically on the untouched baseline (`9cab08c`): missing `Tahun` selector and Take Over redirect to `/optimize/programs` rather than `/optimize/6`. Payment-proof upload/save now passes before the baseline selector failure. A parallel baseline run also caused one transient dynamic-import failure; isolated rerun reached the baseline failure.
- PostgreSQL 17 + pgTAP with Supabase auth/storage/cron/net shims: all 21 migrations apply; all **222 assertions** pass across 16 SQL files, including stale-version/wrong-program rejection and server timestamps.
- Independent QA re-review found no remaining high-severity SQL/trigger findings.

## Release limits

The PostgreSQL shim does not exercise actual Storage HTTP, PostgREST, or GoTrue. Run local/staging Supabase integration tests before production release and follow the coordinated release order in `supabase/README.md`.

Maxi's operator is intentionally a placeholder; Maxloan is identified separately as PT Signature Properties. Archive duration remains unspecified. Runtime logo changes do not change the legal operator configured in `src/brand/brand.js`.
