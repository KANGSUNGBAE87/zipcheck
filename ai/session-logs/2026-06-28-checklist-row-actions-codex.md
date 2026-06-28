# 2026-06-28 Checklist Row Actions

Actor: codex

## User Request

- Remove repeated per-row "지금 확인할 항목" labels from checklist cards.
- Change the row memo add control from a bare plus button to "메모 +".
- Put "메모 +" on the left and "가이드 보기" on the right in the same action row.
- Increase the circular checklist completion control size by about 20%.
- Verify the implemented result with subagents.

## Decisions Made

- Kept the top focus card caption because it describes the current global focus state.
- Removed the duplicated row-level focus tag from checklist cards.
- Split row actions into a primary row and an optional saved-memo row:
  - Primary row: memo add on the left, guide/reference action on the right.
  - Saved-memo row: memo review dropdown below the primary controls.
- Anchored saved-memo dropdown panels from the left edge of the memo review control to keep them inside narrow mobile viewports.
- Increased `.check` from 44px to 53px while keeping reference icons at 44px.

## Files Changed

- `src/App.tsx`
- `src/styles.css`
- `src/app.test.tsx`

## Verification

- `npm run typecheck` passed.
- `npm test -- --run` passed: 16 files, 82 tests.
- `npm run build` passed.
- `npm run preflight:apps-in-toss` passed.
- Code review subagent: pass, previous saved-memo dropdown blocker resolved.
- Live browser QA subagent: pass on mobile 375px and desktop 1280px.
  - Row focus label removed from checklist rows.
  - Memo button text is `메모 +`.
  - Memo and guide controls do not overlap.
  - Saved memo dropdown does not overlap and stays in viewport.
  - Check controls measured `53x53px`.

## Remaining Risks

- Local Playwright import was unavailable from the project dependency tree, so direct scripted browser QA in the main session was skipped after the subagent browser pass. The subagent produced screenshots and measured layout metrics.

## Knowledge Promotion

- No cross-project reusable knowledge to promote.
