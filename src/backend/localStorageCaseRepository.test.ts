import { beforeEach, describe, expect, it } from 'vitest';
import { TEMPLATE } from '../domain';
import { createBlankCase, createEvent } from '../storage';
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
    expect(localStorage.getItem('non-game-market-insights:v2')).toContain('로컬 거래');
  });
});
