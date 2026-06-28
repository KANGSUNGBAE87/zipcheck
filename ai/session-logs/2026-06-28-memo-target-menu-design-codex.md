# 2026-06-28 Memo Target Menu Design

Date: 2026-06-28 14:25 KST
Actor: codex

## User Request

메모 시트의 메모 대상 드롭다운이 브라우저 기본 select처럼 보이고 디자인과 맞지 않으니, 화면 안에 보이는 예쁜 앱 스타일 형식으로 교체해 달라고 요청했다.

## Decisions Made

- 메모 대상 선택 UI를 native `<select>`에서 ZipCheck 카드/칩 톤의 커스텀 선택 메뉴로 교체했다.
- native select 대체에 따른 접근성 회귀를 막기 위해 `listbox`/`option`, `aria-selected`, `aria-haspopup`, `aria-controls`, 키보드 이동/선택 처리를 추가했다.
- 메뉴 열린 상태는 저장, 상단 닫기, 하단 닫기, 케이스 전환, 모바일 탭 전환에서 정리되도록 유지했다.
- i18n 라벨 `memo_target_menu_label`을 ko/en에 추가했다.

## Files Changed

- `src/App.tsx`
  - 메모 대상 메뉴 상태, 옵션 계산, 선택/키보드 핸들러 추가.
  - 메모 시트의 native select를 styled listbox picker로 교체.
- `src/styles.css`
  - 현재 선택 버튼, listbox panel, option row, selected 상태 스타일 추가.
  - 모바일 폭에서 메뉴가 viewport 안에 들어오도록 폭/높이 제약 추가.
- `src/app.test.tsx`
  - native combobox 제거와 styled picker 동작 테스트 추가.
  - top close, bottom close, save, case switch, mobile tab switch cleanup 회귀 테스트 추가.
- `src/i18n.ts`
  - `memo_target_menu_label` ko/en copy 추가.

## Verification Run

- `npm run typecheck` passed.
- `npm test -- --run` passed: 16 files, 82 tests.
- `npm run build` passed.
- `npm run preflight:apps-in-toss` passed.
- Browser verification on local Vite URL:
  - desktop and mobile: `.memo-sheet select` count is 0.
  - menu role is `listbox`.
  - selected option count is 1.
  - 17 memo target options visible.
  - menu bounds stay inside viewport on desktop and mobile.
  - keyboard flow works: focus target button, ArrowDown opens listbox, ArrowDown moves option focus, Enter selects and closes.

## Subagent Verification

- `live-qa-runner`: PASS. Desktop/mobile visual and functional QA, no native select in `.memo-sheet`, menu in viewport, option selection updates target/context, no console errors.
- `reviewer`: initial block found accessibility/i18n/test gaps. After fixes, re-review found previous must-fix resolved and no remaining blockers. Follow-up gap was closed by adding case switch and mobile tab switch cleanup tests.

## Remaining Risks

- No known blocker from this session.
- The Apps in Toss public release gate still depends on the broader release checklist outside this UI fix.

## Knowledge Promotion

- No cross-project reusable knowledge needs promotion. This is project-local ZipCheck UI implementation evidence.
