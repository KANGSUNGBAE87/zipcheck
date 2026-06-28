---
version: 1.0
status: release_privacy_note
updated: 2026-06-28 KST
project: zipcheck
canonical: true
---

# Privacy And Data Retention

This is the repo-side privacy/data-retention source for ZipCheck release prep. It is not legal advice and must be reviewed by the Owner before Apps in Toss Console submission.

## Data Categories

- Supabase-backed when Supabase public env exists: deal titles, checklist progress, item status, memos, and event metadata are saved through an anonymous Supabase session before Toss login, then can be associated with internal `core_users.id` after Toss login.
- localStorage fallback when Supabase public env is absent: deal titles, checklist progress, item status, memos, and local analytics queue entries stay under the ZipCheck browser storage namespace.
- Server-only secret/admin: Supabase service role, DB credentials, Toss mTLS material, `TOSS_LOGIN_TOKEN_EXCHANGE_URL`, `TOSS_DISCONNECT_CALLBACK_SECRET`, callback Basic Auth credentials, `TOSS_USER_KEY_HASH_SECRET`, and `APPS_IN_TOSS_CONSOLE_API_KEY`.

## PII-Safe Analytics

ZipCheck analytics events must not include deal-title text, memo text, authorization codes, raw Toss IDs, service role keys, DB passwords, Toss mTLS material, or AI provider keys. Events may include structural metadata such as locale, phase key, alert id, boolean linked state, and whether a core user id exists.

## Login And Sync

- Users can use the checklist before Toss login.
- If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured, pre-login use creates an anonymous Supabase session and stores checklist data remotely under RLS.
- If Supabase public env is not configured, the same data uses the localStorage fallback on the current device.
- After Toss login, the app links through Supabase with internal `core_user_id` mapping.
- The browser client may use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Toss token exchange and user identity lookup stay on the server side.
- Raw Toss identifiers are not stored in app data. The server token exchange returns `providerSubjectHash`; the official disconnect callback may provide `userKey`, which is immediately HMAC-hashed with `TOSS_USER_KEY_HASH_SECRET` for lookup and is not stored.

## Logout, Unlink, And Withdrawal

- Local disconnect clears the cached `zipcheck:core-user-id:v1` marker, connection UI state, and the current device's ZipCheck cases/checklist/memos.
- Toss unlink/withdrawal callbacks are server-side events. Supported reasons are `UNLINK`, `WITHDRAWAL_TERMS`, and `WITHDRAWAL_TOSS`.
- On callback, ZipCheck marks the matching Toss identity row as unlinked through `authmap_user_identities.unlinked_at`, preserves provider metadata, deletes matching app sessions, and deletes matching ZipCheck cases/checklist/memos/events.
- On next app startup, ZipCheck verifies the cached core user marker against the server status path before showing connected UI; stale markers are cleared.
- If the same verified Toss identity logs in again, ZipCheck relinks the retained identity row instead of storing a duplicate identity.
- Deletion/export/contact wording remains an Owner/legal/product policy action before launch.

## Retention Defaults

- Local fallback data remains on the device until the user clears browser/app storage or uses local disconnect.
- Supabase user data remains under the authenticated/internal account boundary unless the Toss disconnect callback or a deletion request process removes it.
- Server logs and Edge Function logs must avoid storing authorization codes, raw Toss identifiers, or secret values.

## Owner Finalization

Before public release, 성배님 must provide or approve:

- Public privacy policy URL.
- Apps in Toss data disclosure answers.
- User-facing deletion/export/contact wording if required by platform review.
- Final confirmation that unlink/withdrawal should delete synced ZipCheck app data as implemented.
