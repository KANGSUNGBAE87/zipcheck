import { fireEvent, render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { CASES_KEY, EVENTS_KEY } from './storage';

const getCase = () => JSON.parse(localStorage.getItem(CASES_KEY) ?? '[]')[0];
const clickButtonByText = (text: string) => {
  const button = screen.getAllByRole('button').find((candidate) => candidate.textContent === text);
  expect(button).toBeTruthy();
  fireEvent.click(button!);
};

afterEach(() => cleanup());

beforeEach(() => {
  localStorage.clear();
});

describe('App broker checklist', () => {
  it('starts mobile navigation on the deal folder tab before a case is opened', () => {
    const { container } = render(<App />);

    expect(container.querySelector('.app-shell')).toHaveClass('mobile-tab-deals');
    expect(screen.getByRole('button', { name: '거래' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: '체크리스트' })).not.toHaveClass('active');
  });

  it('moves from the deal tab into the checklist after creating or reopening a case', () => {
    const { container } = render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: 'P0 모바일 흐름' } });
    clickButtonByText('새 거래 시작');

    expect(container.querySelector('.app-shell')).toHaveClass('mobile-tab-checklist');
    fireEvent.click(screen.getByRole('button', { name: '거래' }));
    expect(container.querySelector('.app-shell')).toHaveClass('mobile-tab-deals');

    fireEvent.click(screen.getByRole('button', { name: /P0 모바일 흐름/ }));

    expect(container.querySelector('.app-shell')).toHaveClass('mobile-tab-checklist');
  });

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

  it('does not trust a stale Toss marker without remote verification', () => {
    localStorage.setItem('zipcheck:core-user-id:v1', 'core-user-1');
    render(<App />);

    expect(screen.queryByRole('button', { name: '토스 연결 해제' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '토스 로그인' })).toBeDisabled();
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

  it('opens a guide sheet with steps, warning, done criteria, and source chips', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '상세 가이드 검증' } });
    clickButtonByText('새 거래 시작');
    fireEvent.click(screen.getByRole('button', { name: '계약 전 서류 확인 가이드 보기' }));

    const guide = screen.getByRole('dialog', { name: '계약 전 서류 확인 가이드' });
    expect(within(guide).getByText('확인 순서')).toBeInTheDocument();
    expect(within(guide).getByText(/등기사항증명서 갑구ㆍ을구/)).toBeInTheDocument();
    expect(within(guide).getByText('주의')).toBeInTheDocument();
    expect(within(guide).getByText('완료 기준')).toBeInTheDocument();
    expect(within(guide).getByText('확인처')).toBeInTheDocument();
    expect(within(guide).getByRole('link', { name: '인터넷등기소' })).toBeInTheDocument();
    expect(guide).not.toHaveTextContent(/P[0-2]/);
  });

  it('shows only matched tailored guide branches from the selected deal profile', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '맞춤 분기 검증' } });
    clickButtonByText('새 거래 시작');
    fireEvent.change(screen.getByLabelText('거래 유형'), { target: { value: 'jeonse' } });
    fireEvent.change(screen.getByLabelText('물건 유형'), { target: { value: 'villa_multi' } });
    fireEvent.click(screen.getByRole('button', { name: '계약 전 서류 확인 가이드 보기' }));

    const guide = screen.getByRole('dialog', { name: '계약 전 서류 확인 가이드' });
    expect(within(guide).getByText('전세 안내')).toBeInTheDocument();
    expect(within(guide).getByText(/전세는 전입세대ㆍ확정일자ㆍ선순위 보증금/)).toBeInTheDocument();
    expect(within(guide).getByText('빌라/다세대 안내')).toBeInTheDocument();
    expect(within(guide).getByText(/위반건축물 여부와 실제 구조/)).toBeInTheDocument();
    expect(within(guide).queryByText(/매매는 이전등기/)).not.toBeInTheDocument();
    expect(within(guide).queryByText(/관리사무소에서 관리비/)).not.toBeInTheDocument();
    expect(guide).not.toHaveTextContent(/P[0-2]/);
    expect(guide).not.toHaveTextContent('반영');
  });

  it('surfaces tailored guide context on checklist row buttons before opening the guide', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '행 가이드 검증' } });
    clickButtonByText('새 거래 시작');
    fireEvent.change(screen.getByLabelText('거래 유형'), { target: { value: 'jeonse' } });
    fireEvent.change(screen.getByLabelText('물건 유형'), { target: { value: 'villa_multi' } });

    const guideButton = screen.getByRole('button', { name: '계약 전 서류 확인 가이드 보기' });
    expect(guideButton).toHaveTextContent('가이드 보기');
    expect(guideButton).toHaveTextContent('전세 · 빌라/다세대');
    expect(guideButton).not.toHaveTextContent('반영');
    expect(guideButton).not.toHaveTextContent(/P[0-2]/);
  });

  it('does not expose internal numbered guide tier labels in the rendered app', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '내부 라벨 제거 검증' } });
    clickButtonByText('새 거래 시작');

    expect(document.body).not.toHaveTextContent(/P[0-2]\s*(기본|상세|맞춤|tailored|basic|detail)?/i);

    fireEvent.click(within(screen.getByLabelText('5단계 흐름')).getByRole('button', { name: /계약 당일/ }));
    fireEvent.click(screen.getByRole('button', { name: '계약서 사본 확보 가이드 보기' }));
    expect(screen.getByRole('dialog', { name: '계약서 사본 확보 가이드' })).not.toHaveTextContent(/P[0-2]/);
  });

  it('keeps phase 4 guides reference-only without a completion action inside the guide sheet', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '참고 가이드 검증' } });
    clickButtonByText('새 거래 시작');
    fireEvent.click(within(screen.getByLabelText('5단계 흐름')).getByRole('button', { name: /잔금일 참고/ }));
    fireEvent.click(screen.getByRole('button', { name: '등기/세금 참고자료 참고 보기' }));

    const guide = screen.getByRole('dialog', { name: '등기/세금 참고자료 가이드' });
    expect(within(guide).getByText('읽기 전용 참고')).toBeInTheDocument();
    expect(within(guide).getByText('완료 기준')).toBeInTheDocument();
    expect(within(guide).queryByRole('button', { name: '완료하기' })).not.toBeInTheDocument();
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

  it('does not render the activity timeline in the memo workspace', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '활동기록 제외 검증' } });
    clickButtonByText('새 거래 시작');
    fireEvent.click(screen.getByRole('button', { name: '메모' }));

    expect(screen.queryByText('활동 기록')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '이 지점부터 이어서 보기' })).not.toBeInTheDocument();
    expect(screen.queryByText(/activity_session_start/)).not.toBeInTheDocument();
    expect(screen.queryByText(/phase_viewed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/alert_viewed/)).not.toBeInTheDocument();
  });

  it('creates a Korean case and keeps analytics PII-free', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '첫 거래' } });
    clickButtonByText('새 거래 시작');

    const stored = JSON.parse(localStorage.getItem(CASES_KEY) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].history.some((event: { type: string; payload?: { firstEntry?: boolean; locale?: string } }) => event.type === 'session_start' && event.payload?.firstEntry && event.payload?.locale === 'ko')).toBe(true);
    expect(screen.getAllByText(/지금 확인할 항목/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('로그인하지 않아도 저장됩니다. Supabase 저장 환경이면 익명 세션으로 원격 저장되고, 없으면 이 기기에 보관합니다.')[0]).toBeInTheDocument();
    expect(screen.queryByText('Back')).not.toBeInTheDocument();
    const analytics = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]');
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
    expect(screen.getAllByText('로그인하지 않아도 저장됩니다. Supabase 저장 환경이면 익명 세션으로 원격 저장되고, 없으면 이 기기에 보관합니다.')[0]).toBeInTheDocument();
    expect(screen.getByText('완료에 포함되지 않는 참고자료 4개')).toBeInTheDocument();
    expect(screen.getAllByRole('button').some((button) => button.textContent === '○')).toBe(true);
    expect(screen.getByText('완료에 포함되지 않는 참고자료 4개')).toBeInTheDocument();
    expect(screen.getAllByText('로그인하지 않아도 저장됩니다. Supabase 저장 환경이면 익명 세션으로 원격 저장되고, 없으면 이 기기에 보관합니다.')[0]).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: '+ 메모 추가' }));
    expect(screen.getAllByRole('button', { name: '닫기' })[0]).toBeInTheDocument();
    const memoOpened = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]');
    expect(memoOpened.some((event: { type: string; payload?: { locale?: string } }) => event.type === 'memo_opened' && event.payload?.locale === 'ko')).toBe(true);
    fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: '전화 확인' } });
    expect(screen.getByRole('button', { name: '메모 저장하기' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '메모 저장하기' }));

    const afterMemo = JSON.parse(localStorage.getItem(CASES_KEY) ?? '[]');
    expect(afterMemo[0].memos[0].text).toBe('전화 확인');
    expect(afterMemo[0].history.some((event: { type: string; payload?: { locale?: string } }) => event.type === 'memo_saved' && event.payload?.locale === 'ko')).toBe(true);

    fireEvent.click(screen.getAllByRole('button', { name: /완료하기/ })[0]);
    const afterDone = JSON.parse(localStorage.getItem(CASES_KEY) ?? '[]');
    expect(afterDone[0].alerts.find((alert: { id: string }) => alert.id === 'pre_docs').status).toBe('done');
  });

  it('keeps memo text and deal titles out of the analytics queue', () => {
    const dealTitle = '강남 비공개 거래';
    const memoText = '임차인 전화 010-1234-5678';
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: dealTitle } });
    clickButtonByText('새 거래 시작');
    fireEvent.click(screen.getByRole('button', { name: '+ 메모 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: memoText } });
    fireEvent.click(screen.getByRole('button', { name: '메모 저장하기' }));
    fireEvent.click(screen.getByRole('button', { name: '메모' }));

    const memoCard = screen.getByRole('region', { name: '단계별 메모' });
    expect(within(memoCard).queryByRole('button', { name: '기타 메모 메모 삭제: 임차인 전화 010-1234-5678' })).not.toBeInTheDocument();
    fireEvent.click(within(memoCard).getByRole('button', { name: '기타 메모 1번째 메모 삭제' }));

    const analyticsQueue = localStorage.getItem(EVENTS_KEY) ?? '';
    expect(analyticsQueue).not.toContain(dealTitle);
    expect(analyticsQueue).not.toContain(memoText);
  });

  it('shows memo indicators on alert rows after saving an alert memo', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '메모 인디케이터 검증' } });
    clickButtonByText('새 거래 시작');
    fireEvent.click(screen.getByRole('button', { name: '+ 메모 추가' }));
    fireEvent.change(screen.getByRole('combobox', { name: '메모 대상' }), { target: { value: 'pre_docs' } });
    fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: '등기부 확인 위치' } });
    fireEvent.click(screen.getByRole('button', { name: '메모 저장하기' }));

    expect(screen.getByRole('button', { name: '계약 전 서류 확인 메모 1개 보기' })).toBeInTheDocument();
    expect(screen.getByText('메모 1개 보기')).toBeInTheDocument();
  });

  it('separates row memo review dropdowns from the plus add button', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '메모 드롭다운 거래' } });
    clickButtonByText('새 거래 시작');

    const saveFirstRowMemo = (text: string) => {
      fireEvent.click(screen.getByRole('button', { name: '계약 전 서류 확인 메모 추가' }));
      fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: text } });
      fireEvent.click(screen.getByRole('button', { name: '메모 저장하기' }));
    };

    saveFirstRowMemo('등기부 갑구 확인');
    saveFirstRowMemo('건축물대장 위반 여부 확인');

    expect(screen.getByRole('button', { name: '계약 전 서류 확인 메모 추가' })).toHaveTextContent('+');
    expect(screen.getByRole('button', { name: '계약 전 서류 확인 메모 2개 보기' })).toHaveTextContent('메모 2개 보기');

    fireEvent.click(screen.getByRole('button', { name: '계약 전 서류 확인 메모 2개 보기' }));

    const savedMemoDropdown = screen.getByRole('region', { name: '계약 전 서류 확인 저장된 메모' });
    expect(within(savedMemoDropdown).getByText('등기부 갑구 확인')).toBeInTheDocument();
    expect(within(savedMemoDropdown).getByText('건축물대장 위반 여부 확인')).toBeInTheDocument();

    fireEvent.click(within(savedMemoDropdown).getByRole('button', { name: '계약 전 서류 확인 1번째 메모 삭제' }));

    expect(screen.getByRole('button', { name: '계약 전 서류 확인 메모 1개 보기' })).toBeInTheDocument();
    expect(within(savedMemoDropdown).queryByText('등기부 갑구 확인')).not.toBeInTheDocument();
    expect(within(savedMemoDropdown).getByText('건축물대장 위반 여부 확인')).toBeInTheDocument();
  });

  it('deletes saved row memos from the dropdown and updates the memo board counts', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '메모 삭제 거래' } });
    clickButtonByText('새 거래 시작');

    fireEvent.click(screen.getByRole('button', { name: '소유자 정보 확인 메모 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: '소유권 이전 준비 확인' } });
    fireEvent.click(screen.getByRole('button', { name: '메모 저장하기' }));

    fireEvent.click(screen.getByRole('button', { name: '소유자 정보 확인 메모 1개 보기' }));
    const savedMemoDropdown = screen.getByRole('region', { name: '소유자 정보 확인 저장된 메모' });
    expect(within(savedMemoDropdown).getByText('소유권 이전 준비 확인')).toBeInTheDocument();

    fireEvent.click(within(savedMemoDropdown).getByRole('button', { name: '소유자 정보 확인 1번째 메모 삭제' }));

    expect(screen.queryByRole('button', { name: '소유자 정보 확인 메모 1개 보기' })).not.toBeInTheDocument();
    expect(screen.queryByText('소유권 이전 준비 확인')).not.toBeInTheDocument();

    const stored = getCase();
    expect(stored.memos).toHaveLength(0);
    expect(stored.alerts.find((alert: { id: string }) => alert.id === 'pre_owner')?.memoIds).toHaveLength(0);
    expect(stored.history.some((event: { type: string; payload?: { locale?: string } }) => event.type === 'memo_deleted' && event.payload?.locale === 'ko')).toBe(true);
    expect(JSON.stringify(stored.history.find((event: { type: string }) => event.type === 'memo_deleted')?.payload)).not.toContain('소유권 이전 준비 확인');

    fireEvent.click(screen.getByRole('button', { name: '메모' }));
    const memoCard = screen.getByRole('region', { name: '단계별 메모' });
    expect(within(memoCard).getByRole('button', { name: '메모 보기 범위: 계약 전 0개' })).toBeInTheDocument();
    expect(within(memoCard).getByText('이 범위에 저장된 메모가 없습니다.')).toBeInTheDocument();
  });

  it('deletes misc memos from the memo board without affecting checklist row memo counts', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '기타 메모 삭제 거래' } });
    clickButtonByText('새 거래 시작');

    fireEvent.click(screen.getByRole('button', { name: '계약 전 서류 확인 메모 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: '서류 행 메모 유지' } });
    fireEvent.click(screen.getByRole('button', { name: '메모 저장하기' }));

    fireEvent.click(screen.getByRole('button', { name: '+ 메모 추가' }));
    fireEvent.change(screen.getByRole('combobox', { name: '메모 대상' }), { target: { value: 'case' } });
    fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: '거래 전체 기타 삭제 대상' } });
    fireEvent.click(screen.getByRole('button', { name: '메모 저장하기' }));

    fireEvent.click(screen.getByRole('button', { name: '메모' }));
    const memoCard = screen.getByRole('region', { name: '단계별 메모' });
    fireEvent.click(within(memoCard).getByRole('button', { name: '메모 보기 범위: 기타 1개' }));
    expect(within(memoCard).getByText('거래 전체 기타 삭제 대상')).toBeInTheDocument();

    fireEvent.click(within(memoCard).getByRole('button', { name: '기타 메모 1번째 메모 삭제' }));

    expect(within(memoCard).queryByText('거래 전체 기타 삭제 대상')).not.toBeInTheDocument();
    expect(within(memoCard).getByRole('button', { name: '메모 보기 범위: 기타 0개' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '계약 전 서류 확인 메모 1개 보기' })).toBeInTheDocument();
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

    expect(screen.getAllByText('로그인하지 않아도 저장됩니다. Supabase 저장 환경이면 익명 세션으로 원격 저장되고, 없으면 이 기기에 보관합니다.')[0]).toBeInTheDocument();

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

    fireEvent.click(within(screen.getByLabelText('5단계 흐름')).getByRole('button', { name: /계약 후/ }));

    expect(screen.getByText('계약 후 체크리스트')).toBeInTheDocument();
    expect(screen.getAllByText('문서 보관').length).toBeGreaterThan(0);

    fireEvent.click(within(screen.getByLabelText('5단계 흐름')).getByRole('button', { name: /잔금일 참고/ }));

    expect(screen.getAllByText('잔금일 참고').length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getByRole('button', { name: '메모 저장하기' }));

    expect(screen.getByRole('button', { name: '소유자 정보 확인 메모 1개 보기' })).toBeInTheDocument();
    expect(screen.getByText('메모 1개 보기')).toBeInTheDocument();
  });

  it('connects row-level memos to the memo tab with deal, phase, and checklist context', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '메모 연결 거래' } });
    clickButtonByText('새 거래 시작');

    fireEvent.click(screen.getByRole('button', { name: '소유자 정보 확인 메모 추가' }));
    const sheet = screen.getByRole('dialog', { name: '메모' });
    expect(within(sheet).getByText('메모 위치')).toBeInTheDocument();
    expect(within(sheet).getByText('메모 연결 거래')).toBeInTheDocument();
    expect(within(sheet).getByText('계약 전')).toBeInTheDocument();
    expect(within(sheet).getAllByText('소유자 정보 확인').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: '소유자 통화 후 위임장 확인' } });
    fireEvent.click(screen.getByRole('button', { name: '메모 저장하기' }));

    fireEvent.click(screen.getByRole('button', { name: '메모' }));

    const memoCard = screen.getByRole('region', { name: '단계별 메모' });
    expect(within(memoCard).getByRole('button', { name: '메모 보기 범위: 계약 전 1개' })).toBeInTheDocument();
    expect(within(memoCard).getByText('메모 연결 거래')).toBeInTheDocument();
    expect(within(memoCard).getAllByText('계약 전').length).toBeGreaterThan(0);
    expect(within(memoCard).getByText('소유자 정보 확인')).toBeInTheDocument();
    expect(within(memoCard).getByText('소유자 통화 후 위임장 확인')).toBeInTheDocument();
  });

  it('sorts all memos by checklist order and filters 기타 memos separately', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '메모 정렬 거래' } });
    clickButtonByText('새 거래 시작');

    const saveMemoForTarget = (target: string, text: string) => {
      fireEvent.click(screen.getByRole('button', { name: '+ 메모 추가' }));
      fireEvent.change(screen.getByRole('combobox', { name: '메모 대상' }), { target: { value: target } });
      fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: text } });
      fireEvent.click(screen.getByRole('button', { name: '메모 저장하기' }));
    };

    saveMemoForTarget('contract_copy', '계약서 전달 메모');
    saveMemoForTarget('pre_owner', '소유자 확인 메모');
    saveMemoForTarget('case', '거래 전체 기타 메모');

    fireEvent.click(screen.getByRole('button', { name: '메모' }));

    const memoCard = screen.getByRole('region', { name: '단계별 메모' });
    fireEvent.click(within(memoCard).getByRole('button', { name: '메모 보기 범위: 기타 1개' }));
    expect(within(memoCard).getByRole('menuitem', { name: '전체 메모 3개' })).toBeInTheDocument();
    expect(within(memoCard).getByRole('menuitem', { name: '기타 1개' })).toBeInTheDocument();

    fireEvent.click(within(memoCard).getByRole('menuitem', { name: '전체 메모 3개' }));
    const allMemoEntries = within(memoCard).getAllByRole('listitem');
    expect(allMemoEntries[0]).toHaveTextContent('소유자 확인 메모');
    expect(allMemoEntries[1]).toHaveTextContent('계약서 전달 메모');
    expect(allMemoEntries[2]).toHaveTextContent('거래 전체 기타 메모');

    fireEvent.click(within(memoCard).getByRole('button', { name: '메모 보기 범위: 전체 메모 3개' }));
    fireEvent.click(within(memoCard).getByRole('menuitem', { name: '기타 1개' }));
    expect(within(memoCard).getByText('거래 전체 기타 메모')).toBeInTheDocument();
    expect(within(memoCard).queryByText('소유자 확인 메모')).not.toBeInTheDocument();
    expect(within(memoCard).queryByText('계약서 전달 메모')).not.toBeInTheDocument();

    fireEvent.click(within(memoCard).getByRole('button', { name: '메모 보기 범위: 기타 1개' }));
    fireEvent.click(within(memoCard).getByRole('menuitem', { name: '계약 전 1개' }));
    expect(within(memoCard).getByText('소유자 확인 메모')).toBeInTheDocument();
    expect(within(memoCard).queryByText('거래 전체 기타 메모')).not.toBeInTheDocument();
  });

  it('uses a memo scope dropdown and a separate plus add button in the memo workspace', () => {
    render(<App />);

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '메모함 거래' } });
    clickButtonByText('새 거래 시작');
    fireEvent.click(screen.getByRole('button', { name: '소유자 정보 확인 메모 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '메모' }), { target: { value: '소유자 확인 메모' } });
    fireEvent.click(screen.getByRole('button', { name: '메모 저장하기' }));
    fireEvent.click(screen.getByRole('button', { name: '메모' }));

    const memoCard = screen.getByRole('region', { name: '단계별 메모' });
    expect(within(memoCard).queryByRole('tablist', { name: '메모 보기 범위' })).not.toBeInTheDocument();
    expect(within(memoCard).getByRole('button', { name: '메모 보기 범위: 계약 전 1개' })).toBeInTheDocument();
    expect(within(memoCard).getByRole('button', { name: '+ 메모 추가' })).toBeInTheDocument();
  });

  it('groups the deal list into folder sections so long lists do not look endless', () => {
    render(<App />);

    for (const title of ['5555', '4444', '123']) {
      fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: title } });
      clickButtonByText('새 거래 시작');
    }

    const activeFolder = screen.getByRole('region', { name: '진행 중 거래 3개 폴더' });
    expect(within(activeFolder).getByText('진행 중 거래')).toBeInTheDocument();
    expect(within(activeFolder).getByText('3개')).toBeInTheDocument();
    expect(within(activeFolder).getByRole('button', { name: /5555/ })).toBeInTheDocument();
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
