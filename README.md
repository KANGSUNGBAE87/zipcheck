# ZipCheck

Local-first broker checklist prototype for internal concept testing.

## What It Does

- 5-phase real-estate broker checklist
- 16 total checklist/reference items
- 12 actionable completion items
- Phase 4 reference-only items with no completion control
- Korean default UI with English switch
- Local-only deal titles, memos, and checklist state via `localStorage`
- PII-safe local analytics queue that excludes free-text memo and deal-title content

## Scope Boundaries

This prototype has no login, server sync, sharing, ads, in-app purchase, AI advice, legal advice, or store-release integration.

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
