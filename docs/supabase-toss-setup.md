---
version: 1.2
status: current_setup_note
updated: 2026-06-27 KST
project: zipcheck
canonical: true
---

# ZipCheck Supabase + Toss Login Setup

This project is wired for Apps in Toss Toss login and Supabase storage.
On 2026-06-25, Codex applied the ZipCheck schema to the shared Supabase project and deployed the Edge Function.

Active local fallback storage keys are `zipcheck:v2` and `zipcheck:events:v1`.
Legacy `non-game-market-insights:*` keys are read only for migration fallback.

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

Official Apps in Toss login docs make this boundary non-optional:

- `appLogin()` is the client step and returns only the authorization code/referrer.
- Authorization code lifetime is 10 minutes and it is one-time use.
- Token exchange, access token issuance, and user information lookup must run on a server.
- The server-to-server access-token API requires mTLS certificate setup.
- Access tokens, refresh tokens, raw Toss identifiers, service role keys, and mTLS material must stay server-side.

Relevant official references:

- https://developers-apps-in-toss.toss.im/login/develop.md
- https://developers-apps-in-toss.toss.im/development/integration-process.md
- https://developers-apps-in-toss.toss.im/development/test/sandbox.md
- https://developers-apps-in-toss.toss.im/development/test/toss.md
- https://developers-apps-in-toss.toss.im/tutorials/webview.md

## Disconnect / Retention Draft

This is the current P1 policy draft. It is not yet implemented as UI/backend behavior.

- `logout` means local session disconnect only: clear cached `zipcheck:core-user-id:v1` and connected-account UI state, but keep local cases, memos, and checklist state on the device unless the user separately deletes them.
- `unlink` means provider identity detachment on the server: set the identity mapping inactive/unlinked, clear active app session rows where applicable, and stop using that Toss identity for future sync until the user links again.
- Re-login with the same verified Toss identity may relink to the same internal `core_users.id` only when the retained identity row and product policy allow it.
- Do not hard-delete `zipcheck_cases`, `zipcheck_case_alerts`, `zipcheck_memos`, or `zipcheck_events` on simple logout.
- Before public release, add user-facing copy that explains what stays local, what syncs after login, and what unlink/delete requests do.
- Never write raw Toss IDs, Toss tokens, authorization codes, service role keys, or mTLS material to browser state, localStorage, analytics events, screenshots, or public docs.

Official Toss callback reasons to support in the server path:

- `UNLINK`: the user disconnects the service from Toss app settings.
- `WITHDRAWAL_TERMS`: the user withdraws login-service terms consent.
- `WITHDRAWAL_TOSS`: the user leaves Toss.

For all three callbacks, ZipCheck should end/clear active app sessions, revoke or discard server-held Toss tokens, mark the provider identity inactive/unlinked, and show re-login guidance when the user next needs sync.

## Sandbox / WebView QA Gate

- Sandbox app development can allow HTTP, but live/Toss app runtime requires HTTPS.
- Sandbox `appLogin()` should return `referrer: "SANDBOX"`; live app flow should return `referrer: "DEFAULT"`.
- Real-device local testing needs `vite --host` and a `web.host` reachable from the device.
- Debug WebView issues with Android Chrome DevTools or iOS Safari developer tools.
- After sandbox validation, build/package the `.ait`, upload it, and complete at least one Toss app QR/test-scheme run before any release request.

## Current Scope

- Implemented and applied: adapters, UI connection state, migration file, remote SQL, RLS/grants, anonymous sign-ins, Edge Function deployment, local `.env.local`, tests.
- Still missing: production Toss mTLS token exchange endpoint, real Apps in Toss sandbox login QA, implemented unlink/logout remote cleanup flow, real-device/WebView QA.
- Excluded: AI, ads, IAP, store release prep, legal advice.
