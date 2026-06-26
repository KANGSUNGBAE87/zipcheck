import { beforeEach, describe, expect, it } from 'vitest';
import { TEMPLATE } from './domain';
import { appendAnalyticsEvent, CASES_KEY, createBlankCase, createEvent, EVENTS_KEY, loadAnalyticsQueue, loadCases, nextPhase, saveAnalyticsQueue, saveCases } from './storage';

const LEGACY_CASES_KEY = 'non-game-market-insights:v2';
const LEGACY_EVENTS_KEY = 'non-game-market-insights:events:v1';

describe('storage and domain helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates a 16-alert template case with reference-only alerts in phase 4', () => {
    const item = createBlankCase(TEMPLATE, '', 'ko');
    expect(item.alerts).toHaveLength(16);
    expect(item.alerts.filter((alert) => alert.status === 'reference')).toHaveLength(4);
    expect(item.alerts.some((alert) => alert.id === 'registry_recheck')).toBe(false);
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

  it('sanitizes analytics payloads before writing the queue', () => {
    const rawMemoText = '임차인 전화번호 010-1234-5678';
    const rawDealTitle = '강남 비밀 거래';

    appendAnalyticsEvent(createEvent('memo_saved', {
      caseId: 'case-id',
      payload: {
        locale: 'ko',
        target: 'case',
        hasText: true,
        memoText: rawMemoText,
        text: rawMemoText,
        caseTitle: rawDealTitle,
        title: rawDealTitle,
        authorizationCode: 'raw-toss-code',
        coreUserId: 'core-user-id',
      } as any,
    }));

    const rawQueue = localStorage.getItem(EVENTS_KEY) ?? '';
    expect(rawQueue).not.toContain(rawMemoText);
    expect(rawQueue).not.toContain(rawDealTitle);
    expect(rawQueue).not.toContain('raw-toss-code');
    expect(rawQueue).not.toContain('core-user-id');
    expect(loadAnalyticsQueue()[0].payload).toEqual({ locale: 'ko', target: 'case', hasText: true });
  });

  it('normalizes legacy cases without a guide profile', () => {
    const item = createBlankCase(TEMPLATE, '기존 거래', 'ko');
    const legacy = { ...item } as any;
    delete legacy.transactionType;
    delete legacy.propertyType;

    localStorage.setItem(LEGACY_CASES_KEY, JSON.stringify([legacy]));

    const loaded = loadCases();
    expect(loaded[0].transactionType).toBe('sale');
    expect(loaded[0].propertyType).toBe('apartment');
    expect(localStorage.getItem(CASES_KEY)).toBeTruthy();
  });

  it('migrates the legacy analytics queue to the ZipCheck namespace', () => {
    const event = createEvent('case_opened', {
      payload: {
        locale: 'ko',
        memoText: '마이그레이션 중 노출되면 안 되는 메모',
        title: '마이그레이션 중 노출되면 안 되는 거래명',
        authorizationCode: 'legacy-auth-code',
        coreUserId: 'legacy-core-user-id',
      } as any,
    });
    localStorage.setItem(LEGACY_EVENTS_KEY, JSON.stringify([event]));

    expect(loadAnalyticsQueue()).toEqual([{ ...event, payload: { locale: 'ko' } }]);
    expect(localStorage.getItem(EVENTS_KEY)).toBeTruthy();
    expect(localStorage.getItem(EVENTS_KEY)).not.toContain('마이그레이션 중 노출되면 안 되는 메모');
    expect(localStorage.getItem(EVENTS_KEY)).not.toContain('마이그레이션 중 노출되면 안 되는 거래명');
    expect(localStorage.getItem(EVENTS_KEY)).not.toContain('legacy-auth-code');
    expect(localStorage.getItem(EVENTS_KEY)).not.toContain('legacy-core-user-id');
  });

  it('keeps legacy namespaces as read-only fallback after migration', () => {
    const legacyCase = createBlankCase(TEMPLATE, '기존 거래', 'ko');
    const legacyEvent = createEvent('case_opened', { payload: { locale: 'ko' } });
    localStorage.setItem(LEGACY_CASES_KEY, JSON.stringify([legacyCase]));
    localStorage.setItem(LEGACY_EVENTS_KEY, JSON.stringify([legacyEvent]));

    expect(loadCases()[0].title).toBe('기존 거래');
    expect(loadAnalyticsQueue()[0].id).toBe(legacyEvent.id);

    const nextCase = createBlankCase(TEMPLATE, '새 거래', 'ko');
    const nextEvent = createEvent('memo_saved', { payload: { locale: 'ko', target: 'case' } });
    saveCases([nextCase]);
    appendAnalyticsEvent(nextEvent);

    expect(localStorage.getItem(CASES_KEY)).toContain('새 거래');
    expect(localStorage.getItem(EVENTS_KEY)).toContain(nextEvent.id);

    expect(localStorage.getItem(LEGACY_CASES_KEY)).toContain('기존 거래');
    expect(localStorage.getItem(LEGACY_CASES_KEY)).not.toContain('새 거래');
    expect(localStorage.getItem(LEGACY_EVENTS_KEY)).toContain(legacyEvent.id);
    expect(localStorage.getItem(LEGACY_EVENTS_KEY)).not.toContain(nextEvent.id);
  });

  it('advances phases without skipping past post-contract', () => {
    expect(nextPhase('pre_contract')).toBe('contract_day');
    expect(nextPhase('deposit_day_reference')).toBe('post_contract');
    expect(nextPhase('post_contract')).toBe('post_contract');
  });
});
