import {
  normalizePropertyType,
  normalizeTransactionType,
  type AlertItem,
  type CaseItem,
  type HistoryEvent,
  type Locale,
  type PhaseKey,
  type Template,
  DEFAULT_PROPERTY_TYPE,
  DEFAULT_TRANSACTION_TYPE,
} from './domain';

export const CASES_KEY = 'zipcheck:v2';
export const EVENTS_KEY = 'zipcheck:events:v1';

const LEGACY_CASES_KEY = 'non-game-market-insights:v2';
const LEGACY_EVENTS_KEY = 'non-game-market-insights:events:v1';
const SAFE_ANALYTICS_PAYLOAD_KEYS = new Set([
  'locale',
  'firstEntry',
  'source',
  'phaseKey',
  'alertId',
  'target',
  'hasText',
  'completedCount',
  'linked',
  'hasCoreUserId',
]);

export const createEvent = (type: HistoryEvent['type'], partial: Partial<HistoryEvent> = {}): HistoryEvent => ({
  id: crypto.randomUUID(),
  type,
  timestamp: new Date().toISOString(),
  payload: {},
  ...partial,
});

const orderedPhases: PhaseKey[] = ['pre_contract', 'contract_day', 'deposit_prep', 'deposit_day_reference', 'post_contract'];
const actionablePhases: PhaseKey[] = ['pre_contract', 'contract_day', 'deposit_prep', 'post_contract'];

const resolveActivePhaseKey = (alerts: AlertItem[]) => {
  for (const phase of actionablePhases) {
    if (alerts.some((alert) => alert.phaseKey === phase && alert.status === 'pending')) {
      return phase;
    }
  }
  return 'post_contract';
};

const flattenAlerts = (template: Template): AlertItem[] => template.phaseOrder.flatMap((phaseKey) => template.alertsByPhase[phaseKey].map((alert) => ({
  id: alert.id,
  phaseKey,
  titleKey: alert.titleKey,
  detailKey: alert.detailKey,
  status: alert.status,
  memoIds: [],
  wrappedLabelSafe: true,
})));

export const createBlankCase = (template: Template, title: string, locale: Locale = 'ko'): CaseItem => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title: title.trim() || (locale === 'ko' ? '새 중개 체크리스트' : 'New broker checklist'),
    templateId: template.id,
    transactionType: DEFAULT_TRANSACTION_TYPE,
    propertyType: DEFAULT_PROPERTY_TYPE,
    activePhaseKey: resolveActivePhaseKey(flattenAlerts(template)),
    alerts: flattenAlerts(template),
    memos: [],
    history: [createEvent('case_created', { payload: { locale } }), createEvent('session_start', { payload: { locale, firstEntry: true } })],
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    completed: false,
    referenceAnchorId: template.referencePhaseKeys[0],
  };
};

export const normalizeCaseItem = (item: CaseItem): CaseItem => ({
  ...item,
  transactionType: normalizeTransactionType((item as Partial<CaseItem>).transactionType),
  propertyType: normalizePropertyType((item as Partial<CaseItem>).propertyType),
});

const loadWithLegacyFallback = (key: string, legacyKey: string) => {
  const current = localStorage.getItem(key);
  if (current) return current;

  const legacy = localStorage.getItem(legacyKey);
  if (legacy) localStorage.setItem(key, legacy);
  return legacy;
};

export const sanitizeAnalyticsEvent = (event: HistoryEvent): HistoryEvent => {
  const payload: HistoryEvent['payload'] = {};
  Object.entries(event.payload ?? {}).forEach(([key, value]) => {
    if (SAFE_ANALYTICS_PAYLOAD_KEYS.has(key)) payload[key] = value;
  });
  return { ...event, payload };
};

export const loadCases = (): CaseItem[] => {
  const raw = loadWithLegacyFallback(CASES_KEY, LEGACY_CASES_KEY);
  if (!raw) return [];
  try { return (JSON.parse(raw) as CaseItem[]).map(normalizeCaseItem); } catch { return []; }
};

export const saveCases = (cases: CaseItem[]) => localStorage.setItem(CASES_KEY, JSON.stringify(cases));

export const loadAnalyticsQueue = (): HistoryEvent[] => {
  const raw = loadWithLegacyFallback(EVENTS_KEY, LEGACY_EVENTS_KEY);
  if (!raw) return [];
  try {
    const events = (JSON.parse(raw) as HistoryEvent[]).map(sanitizeAnalyticsEvent);
    saveAnalyticsQueue(events);
    return events;
  } catch { return []; }
};

export const saveAnalyticsQueue = (events: HistoryEvent[]) => localStorage.setItem(EVENTS_KEY, JSON.stringify(events.map(sanitizeAnalyticsEvent)));

export const appendAnalyticsEvent = (event: HistoryEvent) => {
  const next = [...loadAnalyticsQueue(), event];
  saveAnalyticsQueue(next);
};

export const nextPhase = (phase: PhaseKey): PhaseKey => {
  const index = orderedPhases.indexOf(phase);
  return index < 0 || index === orderedPhases.length - 1 ? phase : orderedPhases[index + 1];
};

export const recomputeActivePhaseKey = (alerts: AlertItem[]) => resolveActivePhaseKey(alerts);
