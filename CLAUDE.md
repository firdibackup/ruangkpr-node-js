# Existing content above remains unchanged.

## AI Coding Workflow

### Graphify Context Retrieval

Graphify is installed in Claude Code and must be used as the repository relationship/context map before broad code search or reading unrelated files.

- Use Graphify to identify the files, components, functions, domains, tests, and dependencies connected to the requested change.
- Start from the requested feature, symbol, file, route, or bug and trace its relevant dependency/consumer graph before opening many files.
- Read the Graphify results first, then inspect only the relevant source files needed to implement or verify the change.
- Use Graphify to understand impact before modifying shared logic; check affected consumers and tests rather than searching the whole repository indiscriminately.
- Do not treat Graphify output as a substitute for reading source code. It identifies relevant context; source files remain the authority for implementation details.
- Prefer Graphify-driven targeted retrieval because the goal is to reduce unnecessary repository exploration and context/token usage.
- If Graphify does not provide enough information for a task, fall back to targeted repository search rather than scanning the entire codebase.

### Simplicity / Ponytail Principles

When implementing changes, prefer the smallest solution that fits the existing architecture.

- Reuse existing components, hooks, utilities, domain rules, and data boundaries before creating new ones.
- Do not introduce a new abstraction, dependency, state-management library, data-fetching library, validation library, or utility layer unless the task genuinely requires it.
- Do not create wrapper components/functions that only rename or forward existing behavior.
- Prefer native React, Vite, browser APIs, and existing project utilities.
- Keep changes local and focused; do not refactor unrelated code.
- Before adding a new file, check whether an existing file is the appropriate home.
- Before adding a dependency, check whether the repository already provides the capability.
- Preserve the API boundary: real data comes from Supabase (`src/data/supabase/`, spec `docs/superpowers/specs/2026-10-09-supabase-backend-design.md`); app logic stays in `mockApi.js` and runs over a store (`localStore` for tests/e2e, `supabaseStore` for real data). New rules that protect other users or status changes also need a database trigger/RLS rule plus a pgTAP test in `supabase/tests/`.
- Never bypass `src/data/api.js` from UI code.
- Never move persistence into components; `mockDb.js` remains the only localStorage boundary for app data (supabase-js keeping its auth session in localStorage is the one exception).

### UI / UX / Impeccable Principles

For frontend work, treat the existing visual baseline in this file as authoritative.

- Inspect existing UI components, `src/brand/tokens.css` and `src/styles/globals.css` before creating new visual patterns.
- Reuse shadcn/Radix components and existing shared components where possible.
- Preserve the brand parameters (colours, fonts, card radius, logo, name in `src/brand/`, assets in `public/brand/`; see `BRANDING.md`), spacing language, and navigation patterns unless the task explicitly changes them.
- Never write a colour value in components or `globals.css`: use the semantic utilities (`bg-primary`, `text-muted-foreground`, `border-input`, `bg-danger-solid`, …). A new colour role is a token in `src/brand/tokens.css` plus its contrast pair in `src/brand/brand.test.js`, which fails on any hex outside `src/brand/`.
- Never hardcode the product name, support email or brand image paths: use `brand` from `src/brand/brand.js` and `public/brand/`.
- A brand the super admin publishes at `/admin/brand` overrides the files at runtime (`src/brand/theme.js` derives the variables, `src/brand/live.js` paints them on `<html>`); read the logo through `useLiveBrand()`, not a fixed path.
- Maintain mobile-first behavior and the desktop breakpoint at 1024px.
- Keep touch targets at least 44px.
- Check loading, empty, error, and disabled states for new interactive UI.
- Maintain WCAG-conscious contrast and keyboard accessibility.
- Avoid arbitrary colors, gradients, excessive shadows, decorative animation, or new visual patterns without a clear product reason.
- Do not redesign unrelated screens while implementing a feature.

### Definition of Done

After implementation:

1. Run `npm run lint`.
2. Run the most relevant Vitest tests for changed logic.
3. Run `npm run build` for production-facing changes.
4. Run the relevant Playwright test when a user journey or routing behavior changes.
5. Review the diff and remove unnecessary code or files.
6. Report any check that could not be run rather than claiming it passed.
