---
version: 1.0
status: release_gate_note
updated: 2026-06-28 KST
project: zipcheck
canonical: true
---

# Apps in Toss Release Readiness

ZipCheck is a non-game Apps in Toss-first final public-release product. The repo can now enforce the local release guardrails, but public launch still remains `Owner-gated` because Apps in Toss Console, mTLS credentials, sandbox QR proof, and final review submission require human action.

## repo-complete

These release-prep items are implemented in the repository:

- Apps in Toss login stays behind the platform adapter. The client calls `appLogin()` only for `authorizationCode` and `referrer`.
- Token exchange stays behind the Supabase Edge Function/server boundary through `TOSS_LOGIN_TOKEN_EXCHANGE_URL`.
- Local Toss disconnect clears `zipcheck:core-user-id:v1`, connected-account UI state, and current-device ZipCheck cases/checklist/memos.
- Server-only disconnect callback path exists at the `zipcheck-toss-login` Edge Function `/disconnect` route and supports `UNLINK`, `WITHDRAWAL_TERMS`, and `WITHDRAWAL_TOSS`.
- The callback supports official `GET` or `POST` payloads with `userKey` + `referrer` behind Basic Auth, immediately hashes `userKey` with `TOSS_USER_KEY_HASH_SECRET`, and never stores raw Toss identifiers.
- The callback also supports the internal `providerSubjectHash` + `TOSS_DISCONNECT_CALLBACK_SECRET` gateway form.
- Disconnect callback cleanup preserves identity metadata, marks the Toss identity unlinked, deletes matching app sessions, and deletes matching ZipCheck cases/checklist/memos/events.
- Startup connection status verification prevents a stale local `zipcheck:core-user-id:v1` marker from restoring connected UI after external unlink.
- Same verified Toss identity relink reuses the existing identity row instead of inserting a duplicate `(provider, provider_subject)` row.
- Apps in Toss package config has a non-empty brand icon URL and an `APPS_IN_TOSS_WEB_HOST` override for device-reachable sandbox testing.
- Browser env remains public-only. Server-only placeholders live in `.env.server.example`.
- `npm run preflight:apps-in-toss` checks required docs, scripts, callback guardrails, dist size, and browser-bundle secret leaks.
- `npm run build:ait` is the local `.ait` packaging path after the normal Vite build.

## Owner-gated

These actions still require 성배님 or the platform account owner:

- Issue and install Apps in Toss mTLS certificate material for the production token-exchange server.
- Configure `TOSS_LOGIN_TOKEN_EXCHANGE_URL` in the server/Edge Function environment.
- Configure `TOSS_DISCONNECT_CALLBACK_BASIC_USERNAME`, `TOSS_DISCONNECT_CALLBACK_BASIC_PASSWORD`, `TOSS_USER_KEY_HASH_SECRET`, optional `TOSS_DISCONNECT_CALLBACK_SECRET`, and the Apps in Toss disconnect callback URL.
- Set `APPS_IN_TOSS_WEB_HOST` to a host reachable from the real test device before sandbox QR/WebView testing.
- Confirm `APPS_IN_TOSS_ICON_URL` and the Console icon/display name match the submitted app.
- Confirm live and private QR-test origins, including `https://<appName>.apps.tossmini.com` and `https://<appName>.private-apps.tossmini.com`, in the real backend CORS allowlist.
- Run one real Apps in Toss sandbox login E2E and confirm `referrer: "SANDBOX"`.
- Run at least one Toss app QR/test-scheme execution from the uploaded `.ait`.
- Fill final privacy/data disclosure entries in Apps in Toss Console.
- Press the Apps in Toss review request and launch controls.

## hard gate for upload

Do not upload or request review until all of these are true:

- `npm run typecheck` passes.
- `npm test -- --run` passes.
- `npm run build` passes.
- `npm run preflight:apps-in-toss` passes.
- The `.ait` artifact from `npm run build:ait` is under the Apps in Toss unpacked 100MB limit.
- `TOSS_LOGIN_TOKEN_EXCHANGE_URL` is configured to a production server-side mTLS exchange path.
- Callback Basic Auth credentials, `TOSS_USER_KEY_HASH_SECRET`, and the `/disconnect` callback URL are registered and verified.
- `APPS_IN_TOSS_WEB_HOST` points to a device-reachable host for sandbox QA.
- Real sandbox login, QR/test-scheme, keyboard, safe-area, narrow Korean text, and WebView back/close checks are recorded.
- Privacy policy and data disclosure text is finalized by the Owner.

## Human Launch Checklist

1. Build locally: `npm run build:ait`.
2. Upload with Apps in Toss CLI or Console using `APPS_IN_TOSS_CONSOLE_API_KEY` only from server/agent/CI env.
3. Open the generated QR/test-scheme on a real device.
4. Verify Toss login and server exchange.
5. Trigger or simulate the three disconnect reasons against the callback route using the official `userKey` + `referrer` + Basic Auth form, and verify no raw Toss identifier is stored.
6. Confirm no browser bundle contains service role keys, DB passwords, Toss mTLS material, webhook/JWT secrets, or AI provider keys.
7. Request review in Apps in Toss Console.

## Evidence Files

- `scripts/apps-in-toss-preflight.mjs`
- `.env.example`
- `.env.server.example`
- `docs/privacy-and-data-retention.md`
- `docs/supabase-toss-setup.md`
- `supabase/functions/zipcheck-toss-login/index.ts`
- `test.md`

Official references:

- https://developers-apps-in-toss.toss.im/login/develop.html
- https://developers-apps-in-toss.toss.im/development/deploy.html
- https://developers-apps-in-toss.toss.im/checklist/app-nongame.html
