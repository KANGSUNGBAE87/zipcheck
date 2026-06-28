---
version: 1.4
status: current_setup_note
updated: 2026-06-28 KST
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

## Disconnect / Retention

This is now implemented as release-prep behavior for local disconnect and server callback intake. Final product/legal wording and Apps in Toss Console values remain Owner-gated.

- `logout` / local disconnect means current-device disconnect and cleanup: clear cached `zipcheck:core-user-id:v1`, connected-account UI state, local fallback cases, memos, and checklist state.
- `unlink` means provider identity detachment and app-data cleanup on the server: set `authmap_user_identities.unlinked_at`, preserve provider metadata, delete matching `zipcheck_app_sessions`, delete matching ZipCheck cases/checklist/memos/events, and stop using that Toss identity for future sync until the user links again.
- Re-login with the same verified Toss identity relinks the retained identity row to the same internal `core_users.id` and clears `unlinked_at` without inserting a duplicate `(provider, provider_subject)` row.
- App startup verifies `zipcheck:core-user-id:v1` against the server status path before showing connected UI; stale markers are cleared.
- Before public release, Owner must approve user-facing copy that explains what stays local, what syncs after login, and what unlink/delete requests do.
- Never write raw Toss IDs, Toss tokens, authorization codes, service role keys, or mTLS material to browser state, localStorage, analytics events, screenshots, or public docs.

Official Toss callback reasons to support in the server path:

- `UNLINK`: the user disconnects the service from Toss app settings.
- `WITHDRAWAL_TERMS`: the user withdraws login-service terms consent.
- `WITHDRAWAL_TOSS`: the user leaves Toss.

For all three callbacks, ZipCheck supports the official Apps in Toss `GET` or `POST` callback shape with `userKey` and `referrer` behind Basic Auth. The Edge Function immediately hashes `userKey` with `TOSS_USER_KEY_HASH_SECRET` to compare against `providerSubjectHash`; it never stores raw `userKey`. The same route also supports an internal gateway shape with `providerSubjectHash` plus a server-only `TOSS_DISCONNECT_CALLBACK_SECRET`. The Edge Function path is `/disconnect` under `zipcheck-toss-login`.

Server-only callback/env placeholders:

```bash
TOSS_LOGIN_TOKEN_EXCHANGE_URL=
TOSS_DISCONNECT_CALLBACK_SECRET=
TOSS_DISCONNECT_CALLBACK_BASIC_USERNAME=
TOSS_DISCONNECT_CALLBACK_BASIC_PASSWORD=
TOSS_USER_KEY_HASH_SECRET=
ZIPCHECK_ALLOWED_ORIGINS=
APPS_IN_TOSS_WEB_HOST=
APPS_IN_TOSS_ICON_URL=
```

`ZIPCHECK_ALLOWED_ORIGINS` should include the Apps in Toss live and private QR-test origins once the final app name is known. If it is unset, the Edge Function keeps the local/sandbox-compatible CORS fallback.

## Sandbox / WebView QA Gate

- Sandbox app development can allow HTTP, but live/Toss app runtime requires HTTPS.
- Sandbox `appLogin()` should return `referrer: "SANDBOX"`; live app flow should return `referrer: "DEFAULT"`.
- Real-device local testing needs `vite --host` and a `web.host` reachable from the device.
- Debug WebView issues with Android Chrome DevTools or iOS Safari developer tools.
- After sandbox validation, build/package the `.ait`, upload it, and complete at least one Toss app QR/test-scheme run before any release request.

## Current Scope

- Implemented and applied: adapters, UI connection state, startup status verification, stale-marker clearing, same-identity relink, local disconnect cleanup, migration files, remote SQL/RLS prep, anonymous sign-ins, latest Edge Function deployment, official/internal disconnect callback intake/cleanup, local `.env.local`, tests, release preflight docs.
- Still missing for final public launch: production Toss mTLS token exchange endpoint, real Apps in Toss sandbox login QA, registered disconnect callback proof, `.ait` upload/QR test, real-device/WebView QA, Owner-approved privacy/data disclosure.
- Excluded: AI, ads, IAP, Google Play release prep unless explicitly requested, legal advice. Apps in Toss release prep remains part of final public-launch completion.
