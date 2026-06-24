import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';

const getCase = () => JSON.parse(localStorage.getItem('non-game-market-insights:v2') ?? '[]')[0];
const clickButtonByText = (text: string) => {
  const button = screen.getAllByRole('button').find((candidate) => candidate.textContent === text);
  expect(button).toBeTruthy();
  fireEvent.click(button!);
};

afterEach(() => cleanup());

beforeEach(() => {
  localStorage.clear();
});

describe('App broker checklist MVP', () => {
  it('renders the redesigned ZipCheck dashboard shell and labeled summary cards', () => {
    render(<App />);

    expect(screen.getByText('ZIPCHECK')).toBeInTheDocument();
    expect(screen.getByText('진행 중인 거래를 이어서 확인하세요')).toBeInTheDocument();
    expect(screen.getByText('중요한 확인 항목을 단계별로 정리하고, 놓친 업무 없이 마무리합니다.')).toBeInTheDocument();
    expect(screen.getByText('진행 중')).toBeInTheDocument();
    expect(screen.getByText('남은 확인')).toBeInTheDocument();
    expect(screen.getByText('완료')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '설정' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '토스 로그인' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: '새 거래 시작' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '샘플 거래로 둘러보기' }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/진행 중 거래 ·/)).not.toBeInTheDocument();
  });

  it('keeps the new deal form above the deal list, removes plus-only create, and hides English UI', () => {
    render(<App />);

    const titleInput = screen.getByRole('textbox', { name: '거래명' });
    const dealListHeading = screen.getByText('거래 목록');
    const searchInput = screen.getByRole('textbox', { name: '거래명 검색' });

    expect(titleInput.compareDocumentPosition(dealListHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dealListHeading.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole('button').filter((button) => button.textContent?.trim() === '+')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'EN' })).not.toBeInTheDocument();
    expect(screen.queryByText('MY TRANSACTIONS')).not.toBeInTheDocument();
  });

  it('shows item guide controls with practical guidance instead of generic detail wording', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '가이드 검증' } });
    clickButtonByText('새 거래 시작');

    expect(screen.queryByText('상세 보기')).not.toBeInTheDocument();
    expect(screen.queryByText('상세 펼치기')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '소유자 정보 확인 가이드 보기' }));

    expect(screen.getAllByText(/인터넷등기소/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/정부24/).length).toBeGreaterThan(0);
  });

  it('uses actionable 12-item progress and separates reference-only items from the next action', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '송파 헬리오시티 매매' } });
    clickButtonByText('새 거래 시작');

    expect(screen.getAllByText('0 / 12 완료')[0]).toBeInTheDocument();
    expect(screen.getByText('지금 확인할 항목 · 12개 남음')).toBeInTheDocument();
    expect(screen.getByText('완료에 포함되지 않는 참고자료 4개')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '등기/세금 참고자료 참고 보기' })).toBeInTheDocument();
  });

  it('shows a human-readable activity timeline instead of raw event codes', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '타임라인 검증' } });
    clickButtonByText('새 거래 시작');

    expect(screen.getByText('활동 기록')).toBeInTheDocument();
    expect(screen.getByText(/거래를 만들었습니다/)).toBeInTheDocument();
    expect(screen.getByText('세션을 시작했습니다')).toBeInTheDocument();
    expect(screen.queryByText(/activity_session_start/)).not.toBeInTheDocument();
    expect(screen.queryByText(/phase_viewed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/alert_viewed/)).not.toBeInTheDocument();
  });

  it('creates a Korean case and keeps analytics PII-free', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '첫 거래' } });
    clickButtonByText('새 거래 시작');

    const stored = JSON.parse(localStorage.getItem('non-game-market-insights:v2') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].history.some((event: { type: string; payload?: { firstEntry?: boolean; locale?: string } }) => event.type === 'session_start' && event.payload?.firstEntry && event.payload?.locale === 'ko')).toBe(true);
    expect(screen.getAllByText(/지금 확인할 항목/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('로그인하지 않아도 저장됩니다. 토스 로그인 연결 시 계정에 이어서 보관합니다.')[0]).toBeInTheDocument();
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
    const analytics = JSON.parse(localStorage.getItem('non-game-market-insights:events:v1') ?? '[]');
    expect(analytics.some((event: { type: string; payload?: { locale?: string; phaseKey?: string } }) => event.type === 'phase_viewed' && event.payload?.phaseKey === 'pre_contract' && event.payload?.locale === 'ko')).toBe(true);
  });

  it('recomputes active phase from the earliest remaining pending alert and keeps reference phases intact', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '순서 검증' } });
    clickButtonByText('새 거래 시작');

    // Verify accessibility and locale in history event
    const createdCase = getCase();
    expect(createdCase.history.some((e: any) => e.type === 'case_created' && e.payload?.locale === 'ko')).toBe(true);
    expect(createdCase.history.some((e: any) => e.type === 'phase_viewed' && e.payload?.phaseKey === 'pre_contract' && e.payload?.locale === 'ko')).toBe(true);
    expect(createdCase.history.some((e: any) => e.type === 'alert_viewed' && e.payload?.alertId === 'pre_docs' && e.payload?.locale === 'ko')).toBe(true);

    // Verify stats region aria-label
    expect(screen.getByLabelText('통계 요약')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /완료하기/ })[0]);
    expect(getCase().activePhaseKey).toBe('pre_contract');
    expect(getCase().history.some((e: any) => e.type === 'alert_completed' && e.payload?.locale === 'ko')).toBe(true);

    fireEvent.click(screen.getAllByRole('button', { name: /완료하기/ })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /완료하기/ })[0]);
    expect(getCase().activePhaseKey).toBe('contract_day');

    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getAllByRole('button', { name: /완료하기/ })[0]);
    expect(getCase().activePhaseKey).toBe('deposit_prep');

    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getAllByRole('button', { name: /완료하기/ })[0]);
    expect(getCase().activePhaseKey).toBe('post_contract');
  });

  it('shows the memo sheet with localized close action and saved locale-aware events', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '강남 잔금' } });
    clickButtonByText('새 거래 시작');

    expect(screen.getAllByText('0 / 12 완료')[0]).toBeInTheDocument();
    expect(screen.getAllByText('잔금일 참고').length).toBeGreaterThan(0);
    expect(screen.getAllByText('로그인하지 않아도 저장됩니다. 토스 로그인 연결 시 계정에 이어서 보관합니다.')[0]).toBeInTheDocument();
    expect(screen.getByText('완료에 포함되지 않는 참고자료 4개')).toBeInTheDocument();
    expect(screen.getAllByRole('button').some((button) => button.textContent === '○')).toBe(true);
    expect(screen.getByText('완료에 포함되지 않는 참고자료 4개')).toBeInTheDocument();
    expect(screen.getAllByText('로그인하지 않아도 저장됩니다. 토스 로그인 연결 시 계정에 이어서 보관합니다.')[0]).toBeInTheDocument();
    expect(screen.getAllByText('계약 전').length).toBeGreaterThan(0);

    // Verify accessibility label for reference-only button
    const refButton = screen.getAllByRole('button', { name: /참고 보기/ })[0];
    expect(refButton).toHaveAttribute('aria-label', '등기/세금 참고자료 참고 보기');

    // Click reference button and check history event locale
    fireEvent.click(refButton);
    expect(getCase().history.some((e: any) => e.type === 'reference_opened' && e.payload?.locale === 'ko')).toBe(true);
  });

  it('supports memo persistence, alert completion, and history reopen', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '샘플 거래' } });
    clickButtonByText('새 거래 시작');
    fireEvent.click(screen.getByRole('button', { name: '메모 추가' }));
    expect(screen.getAllByRole('button', { name: '닫기' })[0]).toBeInTheDocument();
    const memoOpened = JSON.parse(localStorage.getItem('non-game-market-insights:events:v1') ?? '[]');
    expect(memoOpened.some((event: { type: string; payload?: { locale?: string } }) => event.type === 'memo_opened' && event.payload?.locale === 'ko')).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: '전화 확인' } });
    fireEvent.click(screen.getByRole('button', { name: '메모 저장' }));

    const afterMemo = JSON.parse(localStorage.getItem('non-game-market-insights:v2') ?? '[]');
    expect(afterMemo[0].memos[0].text).toBe('전화 확인');
    expect(afterMemo[0].history.some((event: { type: string; payload?: { locale?: string } }) => event.type === 'memo_saved' && event.payload?.locale === 'ko')).toBe(true);

    fireEvent.click(screen.getAllByRole('button', { name: /완료하기/ })[0]);
    const afterDone = JSON.parse(localStorage.getItem('non-game-market-insights:v2') ?? '[]');
    expect(afterDone[0].alerts.find((alert: { id: string }) => alert.id === 'pre_docs').status).toBe('done');
    fireEvent.click(screen.getByRole('button', { name: '이 지점부터 이어서 보기' }));
    const reopened = JSON.parse(localStorage.getItem('non-game-market-insights:v2') ?? '[]');
    expect(reopened[0].history.some((event: { type: string }) => event.type === 'history_anchor_opened')).toBe(true);
  });

  it('shows memo indicators on alert rows after saving an alert memo', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '메모 인디케이터 검증' } });
    clickButtonByText('새 거래 시작');
    fireEvent.click(screen.getByRole('button', { name: '메모 추가' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pre_docs' } });
    fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: '등기부 확인 위치' } });
    fireEvent.click(screen.getByRole('button', { name: '메모 저장' }));

    expect(screen.getByRole('button', { name: '계약 전 서류 확인 메모 1개' })).toBeInTheDocument();
    expect(screen.getByText('메모 1')).toBeInTheDocument();
  });

  it('renders reference-first copy and removes footer notes from the detail screen', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '참고 UX 검증' } });
    clickButtonByText('새 거래 시작');

    expect(screen.getByText('완료에 포함되지 않는 참고자료 4개')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /참고 보기/ })[0]).toHaveTextContent('참고 보기');
    expect(screen.queryByText(/queue:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Apps in Toss 우선 구조를 유지하면서 Google Play로도 옮길 수 있습니다.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '등기/세금 참고자료 참고 보기' }));
    expect(screen.getByText('잔금일에 다시 볼 참고자료와 연락 지점을 먼저 확인하는 영역입니다.')).toBeInTheDocument();
    expect(screen.getByText('참고용 메모와 확인 포인트를 정리하는 용도이며 법률·세무 자문을 대신하지 않습니다.')).toBeInTheDocument();
  });

  it('supports undo-safe completion and the trust notice', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '되돌리기 검증' } });
    clickButtonByText('새 거래 시작');

    expect(screen.getAllByText('로그인하지 않아도 저장됩니다. 토스 로그인 연결 시 계정에 이어서 보관합니다.')[0]).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /완료하기/ })[0]);
    expect(screen.getByText('완료 직후에는 바로 되돌릴 수 있습니다.')).toBeInTheDocument();
    expect(screen.getAllByText('가이드 보기').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '즉시 되돌리기' }));

    const stored = getCase();
    expect(stored.alerts.find((alert: { id: string; status: string }) => alert.id === 'pre_docs')?.status).toBe('pending');
    expect(screen.queryByText('완료 직후에는 바로 되돌릴 수 있습니다.')).not.toBeInTheDocument();
  });

  it('shows a completion state instead of surfacing phase 4 as the next required task', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '완료 상태 거래' } });
    clickButtonByText('새 거래 시작');

    for (let i = 0; i < 12; i += 1) {
      fireEvent.click(screen.getAllByRole('button', { name: /완료하기/ })[0]);
    }

    const stored = getCase();
    expect(stored.completed).toBe(true);

    const caseCard = screen.getByRole('button', { name: /완료 상태 거래/ });
    expect(caseCard).toHaveTextContent('모든 실행 항목을 완료했습니다.');
    expect(caseCard).not.toHaveTextContent('등기/세금 참고자료');

    expect(screen.getByText('완료 상태')).toBeInTheDocument();
    expect(screen.getByText('모든 실행 항목을 완료했습니다. 참고 자료는 필요할 때만 열어보세요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '등기/세금 참고자료 참고 보기' })).toBeInTheDocument();
  });

  it('lets brokers jump between phase buttons and inspect phase-specific checklist rows', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '단계 이동 검증' } });
    clickButtonByText('새 거래 시작');

    fireEvent.click(screen.getByRole('button', { name: /계약 후/ }));

    expect(screen.getByText('계약 후 체크리스트')).toBeInTheDocument();
    expect(screen.getAllByText('문서 보관').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /잔금일 참고/ }));

    expect(screen.getByText('잔금일 참고')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /참고 보기/ })).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /완료하기/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '가이드 보기' })).not.toBeInTheDocument();
  });

  it('toggles the full checklist so completed, future, and reference rows stay reachable', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '전체 체크리스트 검증' } });
    clickButtonByText('새 거래 시작');

    fireEvent.click(screen.getAllByRole('button', { name: /완료하기/ })[0]);
    fireEvent.click(screen.getByRole('button', { name: '전체 체크리스트' }));

    expect(screen.getByText('전체 체크리스트')).toBeInTheDocument();
    expect(screen.getByText('계약 전 서류 확인')).toBeInTheDocument();
    expect(screen.getAllByText('문서 보관').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /참고 보기/ })).toHaveLength(4);
  });

  it('allows completed checklist items to be unchecked after the toast window', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '완료 해제 검증' } });
    clickButtonByText('새 거래 시작');

    fireEvent.click(screen.getAllByRole('button', { name: /완료하기/ })[0]);
    expect(getCase().alerts.find((alert: { id: string }) => alert.id === 'pre_docs').status).toBe('done');

    fireEvent.click(screen.getByRole('button', { name: '계약 전 서류 확인 - 완료 해제' }));

    expect(getCase().alerts.find((alert: { id: string }) => alert.id === 'pre_docs').status).toBe('pending');
  });

  it('shows memo entry controls on every actionable checklist row even before a memo exists', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '행별 메모 검증' } });
    clickButtonByText('새 거래 시작');

    fireEvent.click(screen.getByRole('button', { name: '소유자 정보 확인 메모 추가' }));

    fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: '소유자 통화 예정' } });
    fireEvent.click(screen.getByRole('button', { name: '메모 저장' }));

    expect(screen.getByRole('button', { name: '소유자 정보 확인 메모 1개' })).toBeInTheDocument();
    expect(screen.getByText('메모 1')).toBeInTheDocument();
  });

  it('shows practical guide copy for post-contract checklist items', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '사후 가이드 검증' } });
    clickButtonByText('새 거래 시작');

    for (let i = 0; i < 9; i += 1) {
      fireEvent.click(screen.getAllByRole('button', { name: /완료하기/ })[0]);
    }

    expect(screen.getAllByText('문서 보관').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '문서 보관 가이드 보기' }));
    expect(screen.getByText(/거래별 폴더에 보관합니다/)).toBeInTheDocument();
    expect(screen.queryByText('4단계는 참고 전용입니다. 완료 체크가 없습니다.')).not.toBeInTheDocument();
  });

  it('closes an open memo or reference sheet when switching away from the memo tab', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '모바일 탭 검증' } });
    clickButtonByText('새 거래 시작');

    fireEvent.click(screen.getByRole('button', { name: '등기/세금 참고자료 참고 보기' }));
    expect(screen.getByText('잔금일에 다시 볼 참고자료와 연락 지점을 먼저 확인하는 영역입니다.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '거래' }));

    expect(screen.queryByText('잔금일에 다시 볼 참고자료와 연락 지점을 먼저 확인하는 영역입니다.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '메모' }));

    expect(screen.queryByText('잔금일에 다시 볼 참고자료와 연락 지점을 먼저 확인하는 영역입니다.')).not.toBeInTheDocument();
  });
});
