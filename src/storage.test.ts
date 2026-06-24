import { beforeEach, describe, expect, it } from 'vitest';
import { TEMPLATE } from './domain';
import { appendAnalyticsEvent, createBlankCase, createEvent, loadAnalyticsQueue, loadCases, nextPhase, saveAnalyticsQueue, saveCases } from './storage';

describe('storage and domain helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a 16-alert template case with reference-only alerts in phase 4', () => {
    const item = createBlankCase(TEMPLATE, '', 'ko');
    expect(item.alerts).toHaveLength(16);
    expect(item.alerts.filter((alert) => alert.status === 'reference')).toHaveLength(4);
    expect(item.referenceAnchorId).toBe('deposit_day_reference');
    expect(item.transactionType).toBe('sale');
    expect(item.propertyType).toBe('apartment');
    expect(item.history[1]?.payload).toMatchObject({ locale: 'ko', firstEntry: true });
  });

  it('persists cases locally and keeps the analytics queue separate', () => {
    const item = createBlankCase(TEMPLATE, '로드 테스트', 'en');
    saveCases([item]);
    expect(loadCases()).toHaveLength(1);
    appendAnalyticsEvent(createEvent('case_created', { payload: { phaseKey: 'pre_contract' } }));
    expect(loadAnalyticsQueue()).toHaveLength(1);
    saveAnalyticsQueue([]);
    expect(loadAnalyticsQueue()).toHaveLength(0);
  });

  it('normalizes legacy cases without a guide profile', () => {
    const item = createBlankCase(TEMPLATE, '기존 거래', 'ko');
    const legacy = { ...item } as any;
    delete legacy.transactionType;
    delete legacy.propertyType;

    localStorage.setItem('non-game-market-insights:v2', JSON.stringify([legacy]));

    const loaded = loadCases();
    expect(loaded[0].transactionType).toBe('sale');
    expect(loaded[0].propertyType).toBe('apartment');
  });

  it('advances phases without skipping past post-contract', () => {
    expect(nextPhase('pre_contract')).toBe('contract_day');
    expect(nextPhase('deposit_day_reference')).toBe('post_contract');
    expect(nextPhase('post_contract')).toBe('post_contract');
  });
});
