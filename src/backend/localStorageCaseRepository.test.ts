import { beforeEach, describe, expect, it } from 'vitest';
import { TEMPLATE } from '../domain';
import { CASES_KEY, EVENTS_KEY, createBlankCase, createEvent } from '../storage';
import { LocalStorageCaseRepository } from './localStorageCaseRepository';

describe('LocalStorageCaseRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('preserves the legacy local cases and analytics queue as a fallback repository', async () => {
    const repository = new LocalStorageCaseRepository();
    const item = createBlankCase(TEMPLATE, '로컬 거래', 'ko');
    const event = createEvent('case_opened', { caseId: item.id, payload: { locale: 'ko' } });

    await repository.saveCases([item]);
    await repository.appendAnalyticsEvent(event);

    expect(await repository.loadCases()).toEqual([item]);
    expect(await repository.loadAnalyticsQueue()).toEqual([event]);
    expect(localStorage.getItem(CASES_KEY)).toContain('로컬 거래');
  });

  it('persists memo deletion in the local fallback repository', async () => {
    const repository = new LocalStorageCaseRepository();
    const item = createBlankCase(TEMPLATE, '로컬 메모 삭제 거래', 'ko');
    const memo = {
      memoId: 'local-memo-1',
      targetType: 'alert' as const,
      targetId: item.alerts[0].id,
      text: '삭제 후 다시 나타나면 안 되는 메모',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      localeAtWrite: 'ko' as const,
    };
    const withMemo = {
      ...item,
      memos: [memo],
      alerts: item.alerts.map((alert, index) => index === 0 ? { ...alert, memoIds: [memo.memoId] } : alert),
    };

    await repository.saveCases([withMemo]);
    await repository.saveCases([{
      ...withMemo,
      memos: [],
      alerts: withMemo.alerts.map((alert) => alert.id === memo.targetId ? { ...alert, memoIds: [] } : alert),
    }]);

    const [loaded] = await repository.loadCases();
    expect(loaded.memos).toEqual([]);
    expect(loaded.alerts[0].memoIds).toEqual([]);
  });

  it('clears local fallback cases and analytics for release disconnect cleanup', async () => {
    const repository = new LocalStorageCaseRepository();
    const item = createBlankCase(TEMPLATE, '로컬 연결 끊김 정리 거래', 'ko');
    const event = createEvent('case_opened', { caseId: item.id, payload: { locale: 'ko' } });

    await repository.saveCases([item]);
    await repository.appendAnalyticsEvent(event);
    await repository.saveCases([]);
    await repository.clearAnalyticsQueue();

    expect(await repository.loadCases()).toEqual([]);
    expect(await repository.loadAnalyticsQueue()).toEqual([]);
    expect(localStorage.getItem(CASES_KEY)).toBe('[]');
    expect(localStorage.getItem(EVENTS_KEY)).toBe('[]');
  });
});
