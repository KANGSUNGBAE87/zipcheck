# ZipCheck

Apps in Toss-first broker checklist final public-release product.

## What It Does

- 5-phase real-estate broker checklist
- 16 total checklist/reference items
- 12 actionable completion items
- Phase 4 reference-only items with no completion control
- Korean-only current UI; English copy remains in i18n, but the switch is deferred
- Deal titles, memos, and checklist state behind a `CaseRepository`
- Supabase repository with anonymous pre-login sessions when public env is configured, with `localStorage` fallback otherwise
- Apps in Toss `appLogin()` adapter and Supabase Edge Function boundary for Toss login exchange
- PII-safe analytics queue that excludes free-text memo and deal-title content
- Active browser storage namespace: `zipcheck:v2` and `zipcheck:events:v1`

## Scope Boundaries

Implemented backend/auth prep is limited to Toss login plus Supabase storage behind adapters/server boundaries, local disconnect cleanup, and server disconnect callback intake/cleanup. Public Apps in Toss launch is the final product completion target: sharing, ads, in-app purchase, AI advice, and legal advice remain out of scope, while production Toss mTLS exchange configuration, real Apps in Toss sandbox E2E login proof, registered callback proof, WebView QA, `.ait` upload/QR testing, and Owner-approved privacy/data disclosure remain launch-completion gates.

## Current Docs

- `goal.md`: target product state and hard boundaries.
- `plan.md`: current implementation plan and next work.
- `status.md`: latest verified implementation state.
- `test.md`: latest verification baseline and required checks.
- `ai/current-implementation-handoff-for-ai.md`: concise handoff for another AI agent.
- `docs/supabase-toss-setup.md`: Supabase/Toss setup boundary.
- `docs/apps-in-toss-release-readiness.md`: repo-complete vs Owner-gated launch checklist.
- `docs/privacy-and-data-retention.md`: repo-side privacy/data retention draft for release prep.

## Development

```bash
npm ci
npm run typecheck
npm test -- --run
npm run build
npm run preflight:apps-in-toss
```

## Public Preview

GitHub Pages target:

https://kangsungbae87.github.io/zipcheck/
