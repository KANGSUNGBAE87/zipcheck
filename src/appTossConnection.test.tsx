import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaseItem, HistoryEvent } from './domain';
import type { CaseRepository } from './backend/caseRepository';
import type { AppsInTossAuthAdapter } from './platform/tossAuth';

const mock = vi.hoisted(() => {
  const repository: CaseRepository = {
    getStatus: () => ({
      mode: 'supabase',
      label: 'Supabase',
      remoteReady: true,
      message: 'remote ready',
    }),
    loadCases: vi.fn(async () => [] as CaseItem[]),
    saveCases: vi.fn(async (_cases: CaseItem[]) => {}),
    loadAnalyticsQueue: vi.fn(async () => [] as HistoryEvent[]),
    appendAnalyticsEvent: vi.fn(async (_event: HistoryEvent) => {}),
    clearAnalyticsQueue: vi.fn(async () => {}),
  };
  const authAdapter: AppsInTossAuthAdapter = {
    signInWithToss: vi.fn(async () => ({ linked: true, coreUserId: 'core-user-1' })),
    signOutLocal: vi.fn(async () => {
      localStorage.removeItem('zipcheck:core-user-id:v1');
    }),
    verifyLocalConnection: vi.fn(async () => true),
  };
  return { repository, authAdapter };
});

vi.mock('./backend/defaultBackend', () => ({
  createDefaultBackend: () => ({
    repository: mock.repository,
    authAdapter: mock.authAdapter,
  }),
}));

const { default: App } = await import('./App');

const clickButtonByText = (text: string) => {
  const button = screen.getAllByRole('button').find((candidate) => candidate.textContent === text);
  expect(button).toBeTruthy();
  fireEvent.click(button!);
};

afterEach(() => cleanup());

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('App Toss connection verification', () => {
  it('verifies a persisted core marker before showing disconnect, then clears cases and analytics on local disconnect', async () => {
    localStorage.setItem('zipcheck:core-user-id:v1', 'core-user-1');
    render(<App />);

    await waitFor(() => expect(mock.authAdapter.verifyLocalConnection).toHaveBeenCalledWith('core-user-1'));
    expect(await screen.findByRole('button', { name: '토스 연결 해제' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: '거래명' }), { target: { value: '검증된 연결 해제 거래' } });
    clickButtonByText('새 거래 시작');

    fireEvent.click(screen.getByRole('button', { name: '토스 연결 해제' }));

    await waitFor(() => expect(mock.authAdapter.signOutLocal).toHaveBeenCalledTimes(1));
    expect(mock.repository.saveCases).toHaveBeenLastCalledWith([]);
    expect(mock.repository.clearAnalyticsQueue).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/이 기기의 거래와 메모를 정리했습니다/)).toBeInTheDocument();
    expect(screen.queryByText('검증된 연결 해제 거래')).not.toBeInTheDocument();
  });

  it('clears a stale marker when remote connection verification fails', async () => {
    vi.mocked(mock.authAdapter.verifyLocalConnection).mockResolvedValueOnce(false);
    localStorage.setItem('zipcheck:core-user-id:v1', 'stale-core-user');
    render(<App />);

    await waitFor(() => expect(mock.authAdapter.signOutLocal).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('zipcheck:core-user-id:v1')).toBeNull();
    expect(screen.queryByRole('button', { name: '토스 연결 해제' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '토스 로그인' })).toBeEnabled();
  });
});
