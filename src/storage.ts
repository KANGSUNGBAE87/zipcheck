import type { AlertItem, CaseItem, HistoryEvent, Locale, PhaseKey, Template } from './domain';

const CASES_KEY = 'non-game-market-insights:v2';
const EVENTS_KEY = 'non-game-market-insights:events:v1';

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

export const loadCases = (): CaseItem[] => {
  const raw = localStorage.getItem(CASES_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as CaseItem[]; } catch { return []; }
};

export const saveCases = (cases: CaseItem[]) => localStorage.setItem(CASES_KEY, JSON.stringify(cases));

export const loadAnalyticsQueue = (): HistoryEvent[] => {
  const raw = localStorage.getItem(EVENTS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as HistoryEvent[]; } catch { return []; }
};

export const saveAnalyticsQueue = (events: HistoryEvent[]) => localStorage.setItem(EVENTS_KEY, JSON.stringify(events));

export const appendAnalyticsEvent = (event: HistoryEvent) => {
  const next = [...loadAnalyticsQueue(), event];
  saveAnalyticsQueue(next);
};

export const nextPhase = (phase: PhaseKey): PhaseKey => {
  const index = orderedPhases.indexOf(phase);
  return index < 0 || index === orderedPhases.length - 1 ? phase : orderedPhases[index + 1];
};

export const recomputeActivePhaseKey = (alerts: AlertItem[]) => resolveActivePhaseKey(alerts);
