# ZipCheck

Apps in Toss-first broker checklist MVP for internal concept testing.

## What It Does

- 5-phase real-estate broker checklist
- 16 total checklist/reference items
- 12 actionable completion items
- Phase 4 reference-only items with no completion control
- Korean-only current UI; English copy remains in i18n, but the switch is deferred
- Deal titles, memos, and checklist state behind a `CaseRepository`
- Supabase repository when public env is configured, with `localStorage` fallback otherwise
- Apps in Toss `appLogin()` adapter and Supabase Edge Function boundary for Toss login exchange
- PII-safe analytics queue that excludes free-text memo and deal-title content
- Active browser storage namespace: `zipcheck:v2` and `zipcheck:events:v1`

## Scope Boundaries

Implemented backend/auth prep is limited to Toss login plus Supabase storage behind adapters/server boundaries. The project still has no sharing, ads, in-app purchase, AI advice, legal advice, production Toss mTLS exchange configuration, real Apps in Toss sandbox E2E login proof, or store-release integration.

## Current Docs

- `goal.md`: target product state and hard boundaries.
- `plan.md`: current implementation plan and next work.
- `status.md`: latest verified implementation state.
- `test.md`: latest verification baseline and required checks.
- `ai/current-implementation-handoff-for-ai.md`: concise handoff for another AI agent.
- `docs/supabase-toss-setup.md`: Supabase/Toss setup boundary.

## Development

```bash
npm ci
npm run typecheck
npm test -- --run
npm run build
```

## Public Preview

GitHub Pages target:

https://kangsungbae87.github.io/zipcheck/
