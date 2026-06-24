# ZipCheck Supabase + Toss Login Setup

This project is wired for Apps in Toss Toss login and Supabase storage.
On 2026-06-25, Codex applied the ZipCheck schema to the shared Supabase project and deployed the Edge Function.

## Apply Schema

1. Shared Supabase project: `dr.kang-mini-project`.
2. Applied migration: `supabase/migrations/20260625_zipcheck_apps_in_toss.sql`.
3. Confirmed RLS on `zipcheck_` user-data tables.
4. Confirmed anon client smoke path: anonymous session, `zipcheck_cases` insert/select/delete.

## Client Env

Set browser-safe public values only:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`.env.local` has been generated locally from the shared public env file. Without these values, ZipCheck keeps the local fallback and disables the Toss login button.

## Toss Login Server Boundary

The client calls Apps in Toss `appLogin()` to receive `authorizationCode` and `referrer`.
The app then calls the Supabase Edge Function `zipcheck-toss-login`.
That function must exchange the code through a server-side Toss login/mTLS endpoint configured as:

```bash
TOSS_LOGIN_TOKEN_EXCHANGE_URL=
```

This endpoint is not configured yet because the required Toss mTLS exchange endpoint/certificate material is not present in the local shared env.

The Edge Function stores only an internal identity mapping. Raw Toss identifiers, Toss tokens, service role keys, and mTLS material must stay server-side.

## Current Scope

- Implemented and applied: adapters, UI connection state, migration file, remote SQL, RLS/grants, anonymous sign-ins, Edge Function deployment, local `.env.local`, tests.
- Still missing: production Toss mTLS token exchange endpoint, real Apps in Toss sandbox login QA, unlink/logout remote cleanup flow.
- Excluded: AI, ads, IAP, store release prep, legal advice.
