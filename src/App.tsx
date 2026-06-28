import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { copy, t } from './i18n';
import { TEMPLATE, type AlertItem, type CaseItem, type HistoryEvent, type Locale, type Memo, type PhaseKey, type PropertyType, type TransactionType } from './domain';
import { PROPERTY_OPTIONS, TRANSACTION_OPTIONS, guideTierLabel, propertyLabel, resolveGuide, resolveGuideBranches, resolveGuideSources, transactionLabel } from './guides';
import { createDefaultBackend } from './backend/defaultBackend';
import { createBlankCase, createEvent, recomputeActivePhaseKey } from './storage';
import { loadZipcheckCoreUserId } from './backend/zipcheckSession';

const emitLocaleEvent = (
  history: HistoryEvent[],
  eventType: 'phase_viewed' | 'alert_viewed' | 'memo_opened',
  payload: Record<string, string | number | boolean>,
  appendEvent: (event: HistoryEvent) => void,
) => {
  const event = createEvent(eventType, { payload });
  appendEvent(event);
  return [...history, event];
};

const localePayload = (locale: Locale) => ({ locale });
const referencePhaseKey = TEMPLATE.referencePhaseKeys[0];
const actionableAlerts = (alerts: AlertItem[]) => alerts.filter((alert) => alert.status !== 'reference');
const doneActionableCount = (alerts: AlertItem[]) => actionableAlerts(alerts).filter((alert) => alert.status === 'done').length;
const pendingActionable = (alerts: AlertItem[]) => actionableAlerts(alerts).filter((alert) => alert.status === 'pending');
const progressPercent = (alerts: AlertItem[]) => Math.round((doneActionableCount(alerts) / actionableAlerts(alerts).length) * 100);
const activeAlert = (item: CaseItem) => pendingActionable(item.alerts)[0] ?? null;
const selectedReferenceAlert = (item: CaseItem) => item.alerts.find((alert) => alert.id === item.referenceAnchorId && alert.status === 'reference')
  ?? item.alerts.find((alert) => alert.status === 'reference')
  ?? null;
const alertMemoCount = (item: CaseItem, alertId: string) => {
  const alert = item.alerts.find((entry) => entry.id === alertId);
  if (!alert) return 0;
  const memoIds = new Set(alert.memoIds);
  return item.memos.filter((memo) => memo.targetType === 'alert' && memo.targetId === alertId && memoIds.has(memo.memoId)).length;
};

const alertMemos = (item: CaseItem, alertId: string) => {
  const alert = item.alerts.find((entry) => entry.id === alertId);
  if (!alert) return [];
  const memoIds = new Set(alert.memoIds);
  return item.memos
    .filter((memo) => memo.targetType === 'alert' && memo.targetId === alertId && memoIds.has(memo.memoId))
    .sort((a, b) => memoSortTime(a) - memoSortTime(b));
};

const formatCount = (locale: Locale, count: number) => (locale === 'ko' ? `${count}개` : `${count}`);

const memoDeleteLabel = (locale: Locale, itemLabel: string, position?: number) => {
  if (position === undefined) return `${itemLabel} ${copy[locale].memo_delete_action}`;
  return locale === 'ko'
    ? `${itemLabel} ${position}${copy[locale].memo_delete_position_suffix} ${copy[locale].memo_delete_action}`
    : `${itemLabel} ${copy[locale].memo_delete_action} ${position}`;
};

const formatProgress = (locale: Locale, done: number, total: number) => (
  locale === 'ko' ? `${done} / ${total} 완료` : `${done} / ${total} complete`
);

const formatRemaining = (locale: Locale, remaining: number) => (
  locale === 'ko' ? `${remaining}개 남음` : `${remaining} remaining`
);

type MemoFilterKey = 'all' | 'misc' | PhaseKey;

type MemoTargetContext = {
  filterKey: Exclude<MemoFilterKey, 'all'>;
  phaseLabel: string;
  itemLabel: string;
};

type MemoViewItem = MemoTargetContext & {
  memo: Memo;
  caseTitle: string;
  sortIndex: number;
  sortTime: number;
};

const memoSortIndex = (item: CaseItem, memo: Memo) => {
  if (memo.targetType === 'case') return item.alerts.length + 1;
  const alertIndex = item.alerts.findIndex((alert) => alert.id === memo.targetId);
  return alertIndex >= 0 ? alertIndex : item.alerts.length + 2;
};

const memoSortTime = (memo: Memo) => {
  const parsed = new Date(memo.createdAt).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const resolveMemoTargetContext = (locale: Locale, item: CaseItem, targetId: 'case' | string): MemoTargetContext => {
  if (targetId === 'case') {
    return {
      filterKey: 'misc',
      phaseLabel: copy[locale].memo_misc,
      itemLabel: copy[locale].memo_misc_item,
    };
  }

  const alert = item.alerts.find((entry) => entry.id === targetId);
  if (!alert) {
    return {
      filterKey: 'misc',
      phaseLabel: copy[locale].memo_unknown_target,
      itemLabel: copy[locale].memo_unknown_target,
    };
  }

  return {
    filterKey: alert.phaseKey,
    phaseLabel: t(locale, `phase.${alert.phaseKey}`),
    itemLabel: t(locale, alert.titleKey),
  };
};

const resolveMemoViewItem = (locale: Locale, item: CaseItem, memo: Memo): MemoViewItem => {
  const sortIndex = memoSortIndex(item, memo);
  return {
    ...resolveMemoTargetContext(locale, item, memo.targetType === 'case' ? 'case' : memo.targetId),
    memo,
    caseTitle: item.title,
    sortIndex,
    sortTime: memoSortTime(memo),
  };
};

const compareMemoViewItems = (a: MemoViewItem, b: MemoViewItem) => {
  if (a.sortIndex !== b.sortIndex) return a.sortIndex - b.sortIndex;
  if (a.sortTime !== b.sortTime) return a.sortTime - b.sortTime;
  return a.memo.memoId.localeCompare(b.memo.memoId);
};

const memoTimeLabel = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${String(parsed.getMonth() + 1).padStart(2, '0')}.${String(parsed.getDate()).padStart(2, '0')} ${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
};

const MemoWorkspaceIllustration = () => (
  <svg className="memo-illustration" viewBox="0 0 128 96" role="img" aria-hidden="true">
    <rect x="15" y="16" width="72" height="64" rx="10" fill="#FFFFFF" stroke="#B8CBD2" strokeWidth="3" />
    <path d="M32 35h38M32 49h31M32 63h26" stroke="#1B7059" strokeWidth="4" strokeLinecap="round" />
    <rect x="74" y="27" width="34" height="44" rx="9" fill="#E7F4EE" stroke="#7EAEA0" strokeWidth="3" />
    <path d="M84 42h15M84 55h11" stroke="#173F4F" strokeWidth="4" strokeLinecap="round" />
    <circle cx="26" cy="24" r="6" fill="#F7F1E7" stroke="#B76A12" strokeWidth="3" />
    <path d="m25 24 2 2 4-5" stroke="#1B7059" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const FolderIcon = () => (
  <svg className="folder-icon" viewBox="0 0 36 28" aria-hidden="true">
    <path d="M3 9.5C3 6.5 5.3 4 8.2 4h6.1l3 4h10.5c3 0 5.2 2.4 5.2 5.4v8.4c0 3-2.3 5.2-5.2 5.2H8.2C5.3 27 3 24.8 3 21.8V9.5Z" fill="#F7F1E7" stroke="#B76A12" strokeWidth="2.2" />
    <path d="M4.8 13h26.4" stroke="#D99B4A" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ChecklistIllustration = () => (
  <svg className="tab-icon" viewBox="0 0 28 28" aria-hidden="true">
    <rect x="6" y="4" width="16" height="20" rx="4" fill="#FFFFFF" stroke="currentColor" strokeWidth="2" />
    <path d="M10 11h8M10 16h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="m10 21 2 2 4-5" stroke="#1B7059" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TabIcon = ({ kind }: { kind: 'deals' | 'checklist' | 'memo' }) => {
  if (kind === 'deals') return <FolderIcon />;
  if (kind === 'checklist') return <ChecklistIllustration />;
  return (
    <svg className="tab-icon" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="5" y="6" width="18" height="16" rx="4" fill="#FFFFFF" stroke="currentColor" strokeWidth="2" />
      <path d="M9 12h10M9 17h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="21" cy="8" r="4" fill="#E7F4EE" stroke="#1B7059" strokeWidth="2" />
    </svg>
  );
};

function App() {
  const backend = useMemo(() => createDefaultBackend(), []);
  const repository = backend.repository;
  const authAdapter = backend.authAdapter;
  const locale: Locale = 'ko';
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [repositoryStatus, setRepositoryStatus] = useState(() => repository.getStatus());
  const [syncMessage, setSyncMessage] = useState(() => repository.getStatus().message ?? '');
  const [tossLoginState, setTossLoginState] = useState<'idle' | 'loading' | 'connected' | 'error'>('idle');
  const userMutatedBeforeLoad = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftMemo, setDraftMemo] = useState('');
  const [memoTarget, setMemoTarget] = useState<'case' | string>('case');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [undoTarget, setUndoTarget] = useState<{ caseId: string; alertId: string } | null>(null);
  const [guideTargetId, setGuideTargetId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [mobileTab, setMobileTab] = useState<'deals' | 'checklist' | 'memo'>('deals');
  const [viewPhaseKey, setViewPhaseKey] = useState<PhaseKey | 'all' | null>(null);
  const [memoFilter, setMemoFilter] = useState<MemoFilterKey>('all');
  const [memoFilterMenuOpen, setMemoFilterMenuOpen] = useState(false);
  const [openMemoDropdownId, setOpenMemoDropdownId] = useState<string | null>(null);
  const [dealFolderOpen, setDealFolderOpen] = useState({ active: true, completed: true });

  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const offset = window.innerHeight - window.visualViewport.height;
        setKeyboardHeight(offset > 0 ? offset : 0);
      } else {
        setKeyboardHeight(0);
      }
    };
    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);
    window.addEventListener('resize', handleResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const appendAnalyticsEventSafe = useCallback((event: HistoryEvent) => {
    void repository.appendAnalyticsEvent(event).catch((error) => {
      setSyncMessage(error instanceof Error ? error.message : copy[locale].sync_event_failed);
    });
  }, [locale, repository]);

  useEffect(() => {
    let alive = true;
    repository.loadCases()
      .then((loadedCases) => {
        if (!alive) return;
        if (!userMutatedBeforeLoad.current) setCases(loadedCases);
        const status = repository.getStatus();
        setRepositoryStatus(status);
        if (!userMutatedBeforeLoad.current) setSyncMessage(status.message ?? '');
      })
      .catch((error) => {
        if (!alive) return;
        setSyncMessage(error instanceof Error ? error.message : copy[locale].sync_load_failed);
      });
    return () => { alive = false; };
  }, [locale, repository]);

  useEffect(() => {
    const coreUserId = loadZipcheckCoreUserId();
    if (!coreUserId || !repositoryStatus.remoteReady) return undefined;

    let alive = true;
    authAdapter.verifyLocalConnection(coreUserId)
      .then(async (connected) => {
        if (!alive) return;
        if (connected) {
          setTossLoginState('connected');
          return;
        }
        await authAdapter.signOutLocal();
        if (alive) setTossLoginState('idle');
      })
      .catch(() => {
        if (alive) setTossLoginState('idle');
      });
    return () => { alive = false; };
  }, [authAdapter, repositoryStatus.remoteReady]);

  useEffect(() => {
    if (!selectedId && cases[0]) setSelectedId(cases[0].id);
  }, [cases, selectedId]);
  useEffect(() => {
    if (!undoTarget) return undefined;
    const timer = window.setTimeout(() => setUndoTarget(null), 5000);
    return () => window.clearTimeout(timer);
  }, [undoTarget]);
  useEffect(() => {
    if (mobileTab === 'memo') return;
    setSheetOpen(false);
    setMemoTarget('case');
    setGuideTargetId(null);
    setMemoFilter('all');
    setMemoFilterMenuOpen(false);
    setOpenMemoDropdownId(null);
    setDraftMemo('');
  }, [mobileTab]);

  const selected = cases.find((item) => item.id === selectedId) ?? null;
  const selectedAlert = selected ? activeAlert(selected) : null;
  const selectedMemoAlert = selected && memoTarget !== 'case'
    ? selected.alerts.find((alert) => alert.id === memoTarget) ?? null
    : null;
  const referenceSheetOpen = selectedMemoAlert?.status === 'reference';
  const selectedGuideAlert = selected && guideTargetId
    ? selected.alerts.find((alert) => alert.id === guideTargetId) ?? null
    : null;
  const selectedGuide = selectedGuideAlert ? resolveGuide(selectedGuideAlert.id) : null;
  const selectedMemoContext = selected ? resolveMemoTargetContext(locale, selected, memoTarget) : null;
  const memoViewItems = selected ? selected.memos.map((memo) => resolveMemoViewItem(locale, selected, memo)).sort(compareMemoViewItems) : [];
  const memoFilterOptions = selected ? [
    { key: 'all' as const, label: copy[locale].memo_all, count: memoViewItems.length },
    { key: 'misc' as const, label: copy[locale].memo_misc, count: memoViewItems.filter((memo) => memo.filterKey === 'misc').length },
    ...TEMPLATE.phaseOrder.map((phaseKey) => ({
      key: phaseKey,
      label: t(locale, `phase.${phaseKey}`),
      count: memoViewItems.filter((memo) => memo.filterKey === phaseKey).length,
    })),
  ] : [];
  const visibleMemoItems = memoFilter === 'all'
    ? memoViewItems
    : memoViewItems.filter((memo) => memo.filterKey === memoFilter);
  const selectedMemoFilterOption = memoFilterOptions.find((option) => option.key === memoFilter) ?? memoFilterOptions[0] ?? { key: 'all' as const, label: copy[locale].memo_all, count: 0 };

  const stats = useMemo(() => ({
    active: cases.filter((item) => !item.completed).length,
    remaining: cases.reduce((count, item) => count + pendingActionable(item.alerts).length, 0),
    completed: cases.filter((item) => item.completed).length,
  }), [cases]);

  const filteredCases = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return cases.filter((item) => {
      const matchesSearch = !term || item.title.toLowerCase().includes(term);
      const matchesFilter = filter === 'all' || (filter === 'completed' ? item.completed : !item.completed);
      return matchesSearch && (matchesFilter || item.id === selectedId);
    });
  }, [cases, filter, searchTerm, selectedId]);
  const activeDealCases = filteredCases.filter((item) => !item.completed);
  const completedDealCases = filteredCases.filter((item) => item.completed);

  const mutate = (updater: (list: CaseItem[]) => CaseItem[]) => setCases((prev) => {
    const next = updater(prev).map((item) => ({ ...item, updatedAt: new Date().toISOString() }));
    userMutatedBeforeLoad.current = true;
    void repository.saveCases(next)
      .then(() => setRepositoryStatus(repository.getStatus()))
      .catch((error) => setSyncMessage(error instanceof Error ? error.message : copy[locale].sync_save_failed));
    return next;
  });

  const openCase = (caseId: string, source: 'case_list' | 'history_anchor' = 'case_list') => {
    setSelectedId(caseId);
    setViewPhaseKey(null);
    setMemoFilter('all');
    setMemoFilterMenuOpen(false);
    setOpenMemoDropdownId(null);
    setMobileTab('checklist');
    mutate((list) => list.map((item) => item.id === caseId
      ? { ...item, lastOpenedAt: new Date().toISOString(), history: [...item.history, createEvent('case_opened', { caseId, payload: { source, ...localePayload(locale) } })] }
      : item));
  };

  const createCase = (sample = false) => {
    const created = createBlankCase(TEMPLATE, sample ? (locale === 'ko' ? '송파 헬리오시티 매매' : 'Songpa Helio City sale') : draftTitle, locale);
    const prepared = sample ? {
      ...created,
      alerts: created.alerts.map((alert, index) => alert.status === 'pending' && index < 8 ? { ...alert, status: 'done' as const, doneAt: new Date().toISOString() } : alert),
    } : created;
    const activePhaseKey = recomputeActivePhaseKey(prepared.alerts);
    mutate((list) => [{ ...prepared, activePhaseKey, completed: pendingActionable(prepared.alerts).length === 0 }, ...list]);
    setSelectedId(prepared.id);
    setViewPhaseKey(null);
    setDraftTitle('');
    setMemoTarget('case');
    setMemoFilter('all');
    setMemoFilterMenuOpen(false);
    setOpenMemoDropdownId(null);
    setSheetOpen(false);
    setMobileTab('checklist');
  };

  const completeAlert = (caseId: string, alertId: string) => {
    setUndoTarget({ caseId, alertId });
    mutate((list) => list.map((item) => {
      if (item.id !== caseId) return item;
      const alerts = item.alerts.map((alert) => alert.id === alertId ? { ...alert, status: 'done' as const, doneAt: new Date().toISOString() } : alert);
      const completedCount = doneActionableCount(alerts);
      const activePhaseKey = recomputeActivePhaseKey(alerts);
      const completed = pendingActionable(alerts).length === 0;
      const history = [...item.history, createEvent('alert_completed', { caseId, alertId, payload: { alertId, phaseKey: alerts.find((a) => a.id === alertId)?.phaseKey ?? item.activePhaseKey, ...localePayload(locale) } })];
      if (completed) history.push(createEvent('case_completed', { caseId, payload: { completedCount, ...localePayload(locale) } }));
      return { ...item, alerts, activePhaseKey, completed, lastCompletedAt: completed ? new Date().toISOString() : item.lastCompletedAt, history };
    }));
  };

  const undoCompleteAlert = () => {
    if (!undoTarget) return;
    const { caseId, alertId } = undoTarget;
    mutate((list) => list.map((item) => {
      if (item.id !== caseId) return item;
      const alerts = item.alerts.map((alert) => alert.id === alertId ? { ...alert, status: 'pending' as const, doneAt: undefined } : alert);
      const activePhaseKey = recomputeActivePhaseKey(alerts);
      const completed = pendingActionable(alerts).length === 0;
      const history = [...item.history, createEvent('alert_undone', { caseId, alertId, payload: { alertId, ...localePayload(locale) } })];
      return { ...item, alerts, activePhaseKey, completed, history };
    }));
    setUndoTarget(null);
  };

  const uncompleteAlert = (caseId: string, alertId: string) => {
    mutate((list) => list.map((item) => {
      if (item.id !== caseId) return item;
      const alerts = item.alerts.map((alert) => alert.id === alertId ? { ...alert, status: 'pending' as const, doneAt: undefined } : alert);
      const activePhaseKey = recomputeActivePhaseKey(alerts);
      const completed = pendingActionable(alerts).length === 0;
      const history = [...item.history, createEvent('alert_undone', { caseId, alertId, payload: { alertId, ...localePayload(locale) } })];
      return { ...item, alerts, activePhaseKey, completed, lastCompletedAt: completed ? item.lastCompletedAt : undefined, history };
    }));
  };

  const saveMemo = () => {
    if (!selected) return;
    const text = draftMemo.trim();
    if (!text) return;
    const savedMemoFilter = memoTarget === 'case'
      ? 'misc'
      : selected.alerts.find((alert) => alert.id === memoTarget)?.phaseKey ?? 'all';
    mutate((list) => list.map((item) => {
      if (item.id !== selected.id) return item;
      const now = new Date().toISOString();
      const targetType: 'case' | 'alert' = memoTarget === 'case' ? 'case' : 'alert';
      const nextMemo: Memo = { memoId: crypto.randomUUID(), targetType, targetId: memoTarget, text, createdAt: now, updatedAt: now, localeAtWrite: locale };
      const alerts = item.alerts.map((alert) => alert.id === memoTarget ? { ...alert, memoIds: [...alert.memoIds, nextMemo.memoId] } : alert);
      const memos = [...item.memos, nextMemo];
      const history = [...item.history, createEvent('memo_saved', { caseId: item.id, alertId: memoTarget === 'case' ? undefined : memoTarget, payload: { target: memoTarget === 'case' ? 'case' : 'alert', hasText: true, ...localePayload(locale) } })];
      return { ...item, memos, alerts, history };
    }));
    appendAnalyticsEventSafe(createEvent('memo_saved', { caseId: selected.id, payload: { target: memoTarget === 'case' ? 'case' : 'alert', ...localePayload(locale) } }));
    setDraftMemo('');
    setSheetOpen(false);
    setMemoFilter(savedMemoFilter);
    setMemoFilterMenuOpen(false);
    setOpenMemoDropdownId(null);
  };

  const deleteMemo = (memoId: string) => {
    if (!selected) return;
    const memoToDelete = selected.memos.find((memo) => memo.memoId === memoId);
    if (!memoToDelete) return;
    const deletedAlertId = memoToDelete.targetType === 'alert' ? memoToDelete.targetId : undefined;
    const remainingAlertMemos = deletedAlertId
      ? selected.memos.filter((memo) => memo.memoId !== memoId && memo.targetType === 'alert' && memo.targetId === deletedAlertId).length
      : 0;
    const target = memoToDelete.targetType === 'case' ? 'case' : 'alert';
    mutate((list) => list.map((item) => {
      if (item.id !== selected.id) return item;
      const alerts = item.alerts.map((alert) => (
        alert.id === deletedAlertId
          ? { ...alert, memoIds: alert.memoIds.filter((id) => id !== memoId) }
          : alert
      ));
      const memos = item.memos.filter((memo) => memo.memoId !== memoId);
      const history = [...item.history, createEvent('memo_deleted', {
        caseId: item.id,
        alertId: deletedAlertId,
        payload: { target, ...localePayload(locale) },
      })];
      return { ...item, alerts, memos, history };
    }));
    appendAnalyticsEventSafe(createEvent('memo_deleted', {
      caseId: selected.id,
      alertId: deletedAlertId,
      payload: { target, ...localePayload(locale) },
    }));
    setMemoFilterMenuOpen(false);
    if (deletedAlertId && openMemoDropdownId === deletedAlertId && remainingAlertMemos === 0) {
      setOpenMemoDropdownId(null);
    }
  };

  const connectTossLogin = async () => {
    setTossLoginState('loading');
    setSyncMessage(copy[locale].toss_login_progress);
    try {
      const result = await authAdapter.signInWithToss();
      setTossLoginState('connected');
      setSyncMessage(result.linked ? copy[locale].toss_login_connected : copy[locale].toss_login_not_linked);
      appendAnalyticsEventSafe(createEvent('toss_login_linked', {
        payload: {
          linked: result.linked,
          hasCoreUserId: Boolean(result.coreUserId),
          ...localePayload(locale),
        },
      }));
    } catch (error) {
      setTossLoginState('error');
      setSyncMessage(error instanceof Error ? `${copy[locale].toss_login_failed} ${error.message}` : copy[locale].toss_login_failed);
    }
  };

  const disconnectTossLoginLocal = async () => {
    userMutatedBeforeLoad.current = true;
    try {
      await authAdapter.signOutLocal();
      await repository.saveCases([]);
      await repository.clearAnalyticsQueue();
      setCases([]);
      setSelectedId(null);
      setDraftTitle('');
      setDraftMemo('');
      setMemoTarget('case');
      setSheetOpen(false);
      setGuideTargetId(null);
      setSearchTerm('');
      setFilter('active');
      setMobileTab('deals');
      setViewPhaseKey(null);
      setMemoFilter('all');
      setMemoFilterMenuOpen(false);
      setOpenMemoDropdownId(null);
      setTossLoginState('idle');
      setRepositoryStatus(repository.getStatus());
      setSyncMessage(copy[locale].toss_disconnect_done);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : copy[locale].sync_save_failed);
    }
  };

  const updateCaseProfile = (caseId: string, patch: Partial<Pick<CaseItem, 'transactionType' | 'propertyType'>>) => {
    mutate((list) => list.map((item) => item.id === caseId ? {
      ...item,
      ...patch,
      history: [...item.history, createEvent('case_profile_updated', {
        caseId,
        payload: {
          transactionType: patch.transactionType ?? item.transactionType,
          propertyType: patch.propertyType ?? item.propertyType,
          ...localePayload(locale),
        },
      })],
    } : item));
  };

  const openGuide = (alert: AlertItem) => {
    if (!selected) return;
    setGuideTargetId(alert.id);
    setSheetOpen(false);
    mutate((list) => list.map((item) => {
      if (item.id !== selected.id) return item;
      const eventType = alert.status === 'reference' ? 'reference_opened' : 'alert_viewed';
      return {
        ...item,
        referenceAnchorId: alert.status === 'reference' ? alert.id : item.referenceAnchorId,
        history: [...item.history, createEvent(eventType, {
          caseId: item.id,
          alertId: alert.id,
          payload: { alertId: alert.id, phaseKey: alert.phaseKey, source: 'guide_sheet', ...localePayload(locale) },
        })],
      };
    }));
  };

  const openReference = (alert: AlertItem) => {
    if (!selected) return;
    openGuide(alert);
  };

  const openMemoComposer = (target: 'case' | string) => {
    if (!selected) return;
    const context = resolveMemoTargetContext(locale, selected, target);
    setMemoTarget(target);
    setMemoFilter(context.filterKey);
    setGuideTargetId(null);
    setOpenMemoDropdownId(null);
    setMemoFilterMenuOpen(false);
    setDraftMemo('');
    setSheetOpen(true);
    setMobileTab('memo');
  };

  useEffect(() => {
    if (!selected) return;
    mutate((list) => list.map((item) => item.id === selected.id
      ? { ...item, history: emitLocaleEvent(item.history, 'phase_viewed', { phaseKey: item.activePhaseKey, ...localePayload(locale) }, appendAnalyticsEventSafe) }
      : item));
  }, [appendAnalyticsEventSafe, locale, selected?.id, selected?.activePhaseKey]);

  useEffect(() => {
    if (!selectedAlert) return;
    mutate((list) => list.map((item) => item.id === selected?.id
      ? { ...item, history: emitLocaleEvent(item.history, 'alert_viewed', { alertId: selectedAlert.id, phaseKey: selectedAlert.phaseKey, ...localePayload(locale) }, appendAnalyticsEventSafe) }
      : item));
  }, [appendAnalyticsEventSafe, locale, selected?.id, selectedAlert?.id]);

  useEffect(() => {
    if (!sheetOpen || !selected) return;
    mutate((list) => list.map((item) => item.id === selected.id
      ? { ...item, history: emitLocaleEvent(item.history, 'memo_opened', { target: memoTarget, ...localePayload(locale) }, appendAnalyticsEventSafe) }
      : item));
  }, [appendAnalyticsEventSafe, locale, memoTarget, selected?.id, sheetOpen]);

  const renderDealCard = (item: CaseItem) => {
    const next = activeAlert(item);
    const done = doneActionableCount(item.alerts);
    const total = actionableAlerts(item.alerts).length;
    return (
      <button key={item.id} className={`deal-card ${item.id === selectedId ? 'selected' : ''} ${item.completed ? 'completed' : ''}`} onClick={() => openCase(item.id)}>
        <div className="card-top">
          <span className={`status ${item.completed ? 'green' : ''}`}>{item.completed ? copy[locale].completed : t(locale, `phase.${item.activePhaseKey}`)}</span>
          <span className="time">{item.lastOpenedAt.slice(11, 16)}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.completed ? copy[locale].completion_message : next ? `${copy[locale].focus_caption} · ${t(locale, next.titleKey)}` : copy[locale].reference_optional_notice}</p>
        <div className="mini-progress" aria-hidden="true"><i style={{ width: `${progressPercent(item.alerts)}%` }} /></div>
        <div className="mini-meta"><span>{formatProgress(locale, done, total)}</span><span>{progressPercent(item.alerts)}%</span></div>
      </button>
    );
  };

  const renderDealFolder = (key: 'active' | 'completed', label: string, items: CaseItem[]) => {
    if (items.length === 0) return null;
    const isOpen = dealFolderOpen[key];
    const countLabel = formatCount(locale, items.length);
    return (
      <section key={key} className={`deal-folder ${key}`} aria-label={`${label} ${countLabel} ${copy[locale].folder_label}`}>
        <button
          type="button"
          className="deal-folder-toggle"
          aria-expanded={isOpen}
          onClick={() => setDealFolderOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
        >
          <FolderIcon />
          <span>
            <strong>{label}</strong>
            <em>{copy[locale].deal_folder_hint}</em>
          </span>
          <b>{countLabel}</b>
        </button>
        {isOpen ? <div className="deal-folder-list">{items.map(renderDealCard)}</div> : null}
      </section>
    );
  };

  const renderAlertRow = (alert: AlertItem) => {
    if (!selected) return null;
    const alertTitle = t(locale, alert.titleKey);
    const guide = resolveGuide(alert.id);
    const guideBranches = resolveGuideBranches(guide, selected.transactionType, selected.propertyType);
    const guideBranchParts = [
      ...(guideBranches.transaction.length > 0 ? [transactionLabel(selected.transactionType)] : []),
      ...(guideBranches.property.length > 0 ? [propertyLabel(selected.propertyType)] : []),
    ];
    const guideMetaLabel = guideBranchParts.length > 0
      ? guideBranchParts.join(' · ')
      : guideTierLabel(guide);
    const linkedMemos = alertMemos(selected, alert.id);
    const memoCount = linkedMemos.length;
    const actionableMemoLabel = `${alertTitle} ${copy[locale].memo_add_row}`;
    const memoReviewLabel = `${alertTitle} ${copy[locale].memo} ${formatCount(locale, memoCount)} ${copy[locale].memo_view}`;
    const memoDropdownOpen = openMemoDropdownId === alert.id;
    return (
      <div key={alert.id} className={`check-row ${alert.status} ${alert.status === 'done' ? 'completed' : ''}`}>
        {alert.status === 'reference' ? (
          <div className="ref-icon" aria-hidden="true">文</div>
        ) : (
          <button
            className={`check ${alert.status === 'done' ? 'done' : ''}`}
            aria-label={`${alertTitle} - ${alert.status === 'done' ? copy[locale].uncomplete_action : copy[locale].complete_action}`}
            onClick={() => (alert.status === 'done' ? uncompleteAlert(selected.id, alert.id) : completeAlert(selected.id, alert.id))}
          >
            {alert.status === 'done' ? '✓' : '○'}
          </button>
        )}
        <div className="check-copy">
          <h4>{alertTitle}</h4>
          <p>{guide.summary}</p>
          <button
            type="button"
            className={`guide-action detail-toggle ${guideBranchParts.length > 0 ? 'is-tailored' : ''}`}
            onClick={() => openGuide(alert)}
            aria-label={`${alertTitle} ${copy[locale].detail_view}`}
          >
            <span className="guide-action-main">
              <span className="guide-action-icon" aria-hidden="true">?</span>
              <span>{copy[locale].detail_view}</span>
            </span>
            <span className="guide-action-meta">{guideMetaLabel}</span>
          </button>
        </div>
        <div className="row-actions">
          {alert.status !== 'reference' ? (
            <div className="row-memo-tools">
              {memoCount > 0 ? (
                <div className={`memo-review ${memoDropdownOpen ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="memo-review-toggle"
                    aria-label={memoReviewLabel}
                    aria-expanded={memoDropdownOpen}
                    onClick={() => setOpenMemoDropdownId((current) => (current === alert.id ? null : alert.id))}
                  >
                    <span>{copy[locale].memo} {formatCount(locale, memoCount)} {copy[locale].memo_view}</span>
                    <b aria-hidden="true">⌄</b>
                  </button>
                  {memoDropdownOpen ? (
                    <div className="memo-review-panel" role="region" aria-label={`${alertTitle} ${copy[locale].memo_saved_list}`}>
                      <ol>
                        {linkedMemos.map((memo, memoIndex) => (
                          <li key={memo.memoId}>
                            <div className="memo-review-meta">
                              <time>{memoTimeLabel(memo.createdAt)}</time>
                              <button
                                type="button"
                                className="memo-delete-btn"
                                aria-label={memoDeleteLabel(locale, alertTitle, memoIndex + 1)}
                                onClick={() => deleteMemo(memo.memoId)}
                              >
                                {copy[locale].memo_delete}
                              </button>
                            </div>
                            <p>{memo.text}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                className="memo-add-icon"
                aria-label={actionableMemoLabel}
                onClick={() => openMemoComposer(alert.id)}
              >
                <span aria-hidden="true">+</span>
              </button>
            </div>
          ) : null}
          {alert.status === 'reference' ? (
            <button type="button" className="soft-btn" aria-label={`${alertTitle} ${copy[locale].reference_view_label}`} onClick={() => openReference(alert)}>
              {copy[locale].reference_view_label}
            </button>
          ) : <span className={`row-tag ${alert.status === 'pending' ? 'warn' : ''}`}>{alert.status === 'done' ? copy[locale].completed : copy[locale].focus_caption}</span>}
        </div>
      </div>
    );
  };

  const displayMode = viewPhaseKey ?? selected?.activePhaseKey ?? null;
  const displayAlerts = selected ? (
    displayMode === 'all'
      ? selected.alerts
      : selected.alerts.filter((alert) => alert.phaseKey === displayMode && (displayMode === referencePhaseKey || alert.status !== 'reference'))
  ) : [];
  const displayActionableAlerts = displayAlerts.filter((alert) => alert.status !== 'reference');
  const displayReferenceAlerts = displayAlerts.filter((alert) => alert.status === 'reference');
  const displayPhaseTitle = displayMode === 'all'
    ? copy[locale].all_checklist
    : displayMode
      ? `${t(locale, `phase.${displayMode}`)} ${copy[locale].checklist_suffix}`
      : copy[locale].current_checklist;
  const displayPhaseMeta = displayMode === 'all'
    ? formatProgress(locale, doneActionableCount(displayAlerts), actionableAlerts(displayAlerts).length || actionableAlerts(selected?.alerts ?? []).length)
    : displayMode === referencePhaseKey
      ? `참고 ${displayReferenceAlerts.length}개`
      : formatProgress(locale, displayActionableAlerts.filter((alert) => alert.status === 'done').length, displayActionableAlerts.length || actionableAlerts(selected?.alerts ?? []).length);
  const focusAlert = displayMode === referencePhaseKey ? null : selectedAlert;
  const referenceAlerts = selected?.alerts.filter((alert) => alert.status === 'reference') ?? [];
  const showReferenceLibrary = displayMode !== 'all' && displayMode !== referencePhaseKey;

  return (
    <div className={`app-shell mobile-tab-${mobileTab}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand" aria-label={copy[locale].brand_name}>
            <span className="brandmark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.2 12 4l9 7.2" /><path d="M5.5 10.3V20h13v-9.7" /><path d="m9 15 2 2 4-4" /></svg>
            </span>
            <span>{copy[locale].brand_name}</span>
            <small>{copy[locale].brand_subtitle}</small>
          </div>
          <div className="top-actions">
            <div className={`pill ${repositoryStatus.remoteReady ? 'remote' : 'local'}`} title={repositoryStatus.label}><span className="dot" /> {repositoryStatus.remoteReady ? copy[locale].remote_status : copy[locale].local_status}</div>
            <button
              className="outline-btn auth-btn"
              disabled={tossLoginState === 'loading' || (!repositoryStatus.remoteReady && tossLoginState !== 'connected')}
              onClick={tossLoginState === 'connected' ? disconnectTossLoginLocal : connectTossLogin}
            >
              {tossLoginState === 'connected' ? copy[locale].toss_disconnect : copy[locale].toss_login}
            </button>
          </div>
        </div>
      </header>

      <div className="page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">{copy[locale].page_eyebrow}</div>
            <h1>{copy[locale].page_title}</h1>
            <p>{copy[locale].page_subtitle}</p>
            {syncMessage ? <div className={`sync-message ${tossLoginState === 'error' ? 'error' : ''}`} role="status">{syncMessage}</div> : null}
          </div>
          <section className="summary" aria-label={copy[locale].stats_aria_label}>
            <div className="summary-card"><span>{copy[locale].summary_active}</span><strong>{stats.active}</strong></div>
            <div className="summary-card"><span>{copy[locale].summary_remaining}</span><strong>{stats.remaining}</strong></div>
            <div className="summary-card"><span>{copy[locale].summary_completed}</span><strong>{stats.completed}</strong></div>
          </section>
        </div>

        <div className="app-grid">
          <aside className="sidebar">
            <div className="create-card create-card-top">
              <input aria-label={copy[locale].deal_title} value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder={copy[locale].deal_placeholder} />
              <button className="primary-btn" onClick={() => createCase(false)}>{copy[locale].start_new}</button>
            </div>
            <div className="side-head">
              <h2>{copy[locale].deal_list}</h2>
            </div>
            <div className="search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
              <input aria-label={copy[locale].search_placeholder} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder={copy[locale].search_placeholder} />
            </div>
            <div className="filters">
              <button className={`filter ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>{copy[locale].filter_active} {stats.active}</button>
              <button className={`filter ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>{copy[locale].filter_completed} {stats.completed}</button>
              <button className={`filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>{copy[locale].filter_all}</button>
            </div>
            {filteredCases.length === 0 ? (
              <div className="empty-state">
                <div className="empty-illustration" aria-hidden="true">✓</div>
                <p>{copy[locale].empty_home}</p>
                <button className="soft-btn" onClick={() => createCase(true)}>{copy[locale].sample_tour}</button>
              </div>
            ) : (
              <div className="deal-folder-stack">
                {(filter === 'active' || filter === 'all' || activeDealCases.some((item) => item.id === selectedId)) ? renderDealFolder('active', copy[locale].active_deal_folder, activeDealCases) : null}
                {(filter === 'completed' || filter === 'all' || completedDealCases.some((item) => item.id === selectedId)) ? renderDealFolder('completed', copy[locale].completed_deal_folder, completedDealCases) : null}
              </div>
            )}
            <div className="local-note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
              <span>{copy[locale].trust_notice}</span>
            </div>
          </aside>

          <main className="workspace">
            {selected ? (
              <>
                <section className="deal-hero">
                  <div>
                    <div className="hero-label"><b>{selected.completed ? copy[locale].completed : copy[locale].current_deal_status}</b> {t(locale, `phase.${selected.activePhaseKey}`)}</div>
                    <h2>{selected.title}</h2>
                    <div className="hero-meta">
                      <span>{transactionLabel(selected.transactionType)}</span>
                      <span>{propertyLabel(selected.propertyType)}</span>
                      <span>{copy[locale].user_role_default}</span>
                      <span>{copy[locale].closing_date_default}</span>
                    </div>
                    <div className="case-profile" aria-label={copy[locale].case_profile}>
                      <label>
                        <span>{copy[locale].transaction_type}</span>
                        <select
                          aria-label={copy[locale].transaction_type}
                          value={selected.transactionType}
                          onChange={(event) => updateCaseProfile(selected.id, { transactionType: event.target.value as TransactionType })}
                        >
                          {TRANSACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>{copy[locale].property_type}</span>
                        <select
                          aria-label={copy[locale].property_type}
                          value={selected.propertyType}
                          onChange={(event) => updateCaseProfile(selected.id, { propertyType: event.target.value as PropertyType })}
                        >
                          {PROPERTY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="progress-ring" style={{ '--progress': `${progressPercent(selected.alerts)}%` } as React.CSSProperties}>
                    <div><strong>{progressPercent(selected.alerts)}%</strong><span>{formatProgress(locale, doneActionableCount(selected.alerts), actionableAlerts(selected.alerts).length)}</span></div>
                  </div>
                </section>

                <section className="stepper" aria-label={copy[locale].phase_rail}>
                  {TEMPLATE.phaseOrder.map((phaseKey) => {
                    const phaseAlerts = selected.alerts.filter((alert) => alert.phaseKey === phaseKey);
                    const actionable = phaseAlerts.filter((alert) => alert.status !== 'reference');
                    const done = actionable.filter((alert) => alert.status === 'done').length;
                    const isReference = TEMPLATE.referencePhaseKeys.includes(phaseKey);
                    const isDone = !isReference && actionable.length > 0 && done === actionable.length;
                    return (
                      <button
                        key={phaseKey}
                        type="button"
                        className={`step ${isDone ? 'done' : ''} ${phaseKey === displayMode ? 'active' : ''} ${isReference ? 'reference' : ''}`}
                        aria-pressed={phaseKey === displayMode}
                        onClick={() => setViewPhaseKey(phaseKey)}
                      >
                        <div className="step-node">{isDone ? '✓' : isReference ? '↗' : TEMPLATE.phaseOrder.indexOf(phaseKey) + 1}</div>
                        <strong>{t(locale, `phase.${phaseKey}`)}</strong>
                        <span>{isReference ? '자료 4개' : `${done}/${actionable.length} ${copy[locale].progress_complete}`}</span>
                      </button>
                    );
                  })}
                </section>

                <section className={`focus-card ${selected.completed ? 'completed' : ''}`}>
                  <div className="focus-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 12.5 10 16l8-9" /><circle cx="12" cy="12" r="9" /></svg>
                  </div>
                  <div className="focus-copy">
                    <div className="caption">{selected.completed ? copy[locale].completed_state : `${copy[locale].focus_caption} · ${formatRemaining(locale, pendingActionable(selected.alerts).length)}`}</div>
                    <h3>{selected.completed ? copy[locale].completion_message : focusAlert ? t(locale, focusAlert.titleKey) : copy[locale].reference_optional_notice}</h3>
                    <p>{selected.completed ? copy[locale].completion_notice : focusAlert ? copy[locale].actionable_notice : copy[locale].reference_notice}</p>
                  </div>
                  <div className="focus-actions">
                    {focusAlert ? (
                      <button className="outline-btn" onClick={() => openGuide(focusAlert)}>{copy[locale].detail_view}</button>
                    ) : null}
                    {focusAlert ? <button className="primary-btn" onClick={() => completeAlert(selected.id, focusAlert.id)}>{copy[locale].complete_action}</button> : null}
                  </div>
                </section>

                {undoTarget ? (
                  <div className="toast">
                    <span>{copy[locale].complete_undo_hint}</span>
                    <button className="outline-btn" onClick={undoCompleteAlert}>{copy[locale].complete_undo}</button>
                  </div>
                ) : null}

                <div className="content-grid">
                  <section className="section-card checklist-card">
                    <div className="section-head">
                      <h3>{displayPhaseTitle}</h3>
                      <span>{displayPhaseMeta}</span>
                    </div>
                    {displayAlerts.map(renderAlertRow)}
                    <button type="button" className="more-link" aria-pressed={displayMode === 'all'} onClick={() => setViewPhaseKey((prev) => (prev === 'all' ? null : 'all'))}>
                      {displayMode === 'all' ? copy[locale].current_checklist : copy[locale].all_checklist}
                    </button>
                  </section>

                  <div className="side-stack">
                    <section className="section-card memo-card">
                      <div className="memo-title">
                        <div>
                          <h3>{copy[locale].memo}</h3>
                          <p>{copy[locale].memo_card_hint}</p>
                        </div>
                      </div>
                      <div className="memo-visual-band">
                        <MemoWorkspaceIllustration />
                        <div>
                          <strong>{copy[locale].memo_board_title}</strong>
                          <span>{copy[locale].memo_card_hint}</span>
                        </div>
                      </div>
                      <section className="memo-panel" aria-label={copy[locale].memo_by_phase}>
                        <div className="memo-toolbar">
                          <div className={`memo-filter-dropdown ${memoFilterMenuOpen ? 'open' : ''}`}>
                            <button
                              type="button"
                              className="memo-filter-current"
                              aria-label={`${copy[locale].memo_filter_label}: ${selectedMemoFilterOption.label} ${formatCount(locale, selectedMemoFilterOption.count)}`}
                              aria-expanded={memoFilterMenuOpen}
                              onClick={() => setMemoFilterMenuOpen((open) => !open)}
                            >
                              <span>{copy[locale].memo_filter_label}</span>
                              <strong>{selectedMemoFilterOption.label}</strong>
                              <b>{formatCount(locale, selectedMemoFilterOption.count)}</b>
                            </button>
                            {memoFilterMenuOpen ? (
                              <div className="memo-filter-menu" role="menu">
                                {memoFilterOptions.map((option) => (
                                  <button
                                    key={option.key}
                                    type="button"
                                    role="menuitem"
                                    className={memoFilter === option.key ? 'active' : ''}
                                    onClick={() => {
                                      setMemoFilter(option.key);
                                      setMemoFilterMenuOpen(false);
                                    }}
                                  >
                                    <span>{option.label}</span>
                                    <b>{formatCount(locale, option.count)}</b>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <button className="memo-add-main" aria-label={`+ ${copy[locale].memo_add}`} onClick={() => openMemoComposer('case')}><span aria-hidden="true">+</span> {copy[locale].memo_add}</button>
                        </div>
                        {visibleMemoItems.length > 0 ? (
                          <ol className="memo-list">
                            {visibleMemoItems.map((entry, memoIndex) => (
                              <li key={entry.memo.memoId} className="memo-entry">
                                <div className="memo-entry-top">
                                  <span className={`memo-scope ${entry.filterKey === 'misc' ? 'misc' : ''}`}>{entry.phaseLabel}</span>
                                  <div className="memo-entry-actions">
                                    <time>{memoTimeLabel(entry.memo.createdAt)}</time>
                                    <button
                                      type="button"
                                      className="memo-delete-btn"
                                      aria-label={memoDeleteLabel(locale, entry.itemLabel, memoIndex + 1)}
                                      onClick={() => deleteMemo(entry.memo.memoId)}
                                    >
                                      {copy[locale].memo_delete}
                                    </button>
                                  </div>
                                </div>
                                <strong>{entry.itemLabel}</strong>
                                <span className="memo-entry-case">{entry.caseTitle}</span>
                                <p>{entry.memo.text}</p>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <div className="memo-box">{copy[locale].memo_empty_filtered}</div>
                        )}
                      </section>
                    </section>
                    {showReferenceLibrary ? (
                      <section className="section-card reference-library">
                        <div className="memo-title">
                          <div>
                            <h3>{copy[locale].reference_library}</h3>
                            <p>{copy[locale].reference_library_note}</p>
                          </div>
                        </div>
                        {referenceAlerts.map(renderAlertRow)}
                      </section>
                    ) : null}
                  </div>
                </div>

                {sheetOpen ? (
                  <section className="memo-sheet" role="dialog" aria-modal="false" aria-label={copy[locale].memo} style={keyboardHeight > 0 ? { bottom: `${keyboardHeight}px` } : undefined}>
                    <div className="sheet-handle" aria-hidden="true" />
                    <div className="sheet-header">
                      <div className="sheet-heading">
                        {referenceSheetOpen ? <span className="reference-badge">{copy[locale].reference_only_label}</span> : null}
                        <label>
                          {referenceSheetOpen && selectedMemoAlert ? t(locale, selectedMemoAlert.titleKey) : copy[locale].memo}
                          {referenceSheetOpen ? null : (
                            <select aria-label={copy[locale].memo_target_label} value={memoTarget} onChange={(e) => setMemoTarget(e.target.value)}>
                              <option value="case">{copy[locale].memo_target_case}</option>
                              {selected.alerts.map((alert) => <option key={alert.id} value={alert.id}>{t(locale, alert.titleKey)}</option>)}
                            </select>
                          )}
                        </label>
                      </div>
                      <button className="icon-btn dismiss" aria-label={copy[locale].memo_close} onClick={() => setSheetOpen(false)}>×</button>
                    </div>
                    <div className="sheet-body">
                      {selectedMemoContext ? (
                        <div className="memo-context-card" aria-label={copy[locale].memo_context_label}>
                          <span>{copy[locale].memo_context_label}</span>
                          <strong>{selected.title}</strong>
                          <div>
                            <em>{selectedMemoContext.phaseLabel}</em>
                            <em>{selectedMemoContext.itemLabel}</em>
                          </div>
                        </div>
                      ) : null}
                      {referenceSheetOpen && selectedMemoAlert ? (
                        <>
                          <div className="reference-purpose">{copy[locale].reference_purpose}</div>
                          {selectedMemoAlert.detailKey ? <p className="muted">{t(locale, selectedMemoAlert.detailKey)}</p> : null}
                          <div className="reference-disclaimer">{copy[locale].reference_disclaimer}</div>
                        </>
                      ) : null}
                      <textarea aria-label={copy[locale].memo} value={draftMemo} onChange={(e) => setDraftMemo(e.target.value)} placeholder={copy[locale].memo_placeholder} />
                      <p className="muted">{selectedMemoAlert ? t(locale, selectedMemoAlert.titleKey) : selectedAlert ? t(locale, selectedAlert.titleKey) : selectedReferenceAlert(selected) ? t(locale, selectedReferenceAlert(selected)!.titleKey) : copy[locale].empty_memo}</p>
                    </div>
                    <div className="sheet-actions">
                      <button type="button" className="primary-btn memo-save-btn" onClick={saveMemo} disabled={!draftMemo.trim()}>{copy[locale].memo_save}</button>
                      <button className="outline-btn" onClick={() => setSheetOpen(false)}>{copy[locale].memo_close}</button>
                    </div>
                  </section>
                ) : null}
                {selectedGuide && selectedGuideAlert ? (() => {
                  const sources = resolveGuideSources(selectedGuide);
                  const branches = resolveGuideBranches(selectedGuide, selected.transactionType, selected.propertyType);
                  const hasBranches = branches.transaction.length > 0 || branches.property.length > 0;
                  const isReferenceGuide = selectedGuideAlert.status === 'reference';
                  const alertTitle = t(locale, selectedGuideAlert.titleKey);
                  return (
                    <section
                      className={`memo-sheet guide-sheet ${isReferenceGuide ? 'reference-guide' : ''}`}
                      role="dialog"
                      aria-modal="false"
                      aria-label={`${alertTitle} ${copy[locale].guide_suffix}`}
                      style={keyboardHeight > 0 ? { bottom: `${keyboardHeight}px` } : undefined}
                    >
                      <div className="sheet-handle" aria-hidden="true" />
                      <div className="sheet-header">
                        <div className="sheet-heading">
                          <div className="guide-badges">
                            <span className="guide-badge">{guideTierLabel(selectedGuide)}</span>
                            {hasBranches ? <span className="guide-badge branch">{copy[locale].guide_context_badge}</span> : null}
                            {isReferenceGuide ? <span className="reference-badge">{copy[locale].reference_only_label}</span> : null}
                          </div>
                          <span className="guide-kicker">{t(locale, `phase.${selectedGuide.phaseKey}`)} · {alertTitle}</span>
                          <h3>{selectedGuide.brokerTitle}</h3>
                        </div>
                        <button className="icon-btn dismiss" aria-label={copy[locale].memo_close} onClick={() => setGuideTargetId(null)}>×</button>
                      </div>
                      <div className="sheet-body guide-body">
                        {isReferenceGuide ? <div className="reference-purpose">{copy[locale].reference_purpose}</div> : null}
                        <p className="guide-summary">{selectedGuide.summary}</p>
                        {hasBranches ? (
                          <div className="guide-profile-note">
                            <span>{copy[locale].guide_profile_context}</span>
                            <strong>{transactionLabel(selected.transactionType)} · {propertyLabel(selected.propertyType)}</strong>
                          </div>
                        ) : null}

                        <section className="guide-block">
                          <h4>{copy[locale].guide_steps}</h4>
                          <ol>
                            {selectedGuide.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                          </ol>
                        </section>

                        {branches.transaction.length > 0 ? (
                          <section className="guide-block branch-block">
                            <h4>{transactionLabel(selected.transactionType)} {copy[locale].guide_branch_suffix}</h4>
                            <ul>
                              {branches.transaction.map((bullet) => <li key={bullet}>{bullet}</li>)}
                            </ul>
                          </section>
                        ) : null}

                        {branches.property.length > 0 ? (
                          <section className="guide-block branch-block">
                            <h4>{propertyLabel(selected.propertyType)} {copy[locale].guide_branch_suffix}</h4>
                            <ul>
                              {branches.property.map((bullet) => <li key={bullet}>{bullet}</li>)}
                            </ul>
                          </section>
                        ) : null}

                        {selectedGuide.warning ? (
                          <section className="guide-block warning-block">
                            <h4>{copy[locale].guide_warning}</h4>
                            <p>{selectedGuide.warning}</p>
                          </section>
                        ) : null}

                        <section className="guide-block done-block">
                          <h4>{copy[locale].guide_done}</h4>
                          <p>{selectedGuide.done}</p>
                        </section>

                        <section className="guide-block source-block">
                          <h4>{copy[locale].guide_sources}</h4>
                          <div className="source-list">
                            {sources.map((source) => source.url ? (
                              <a key={source.label} href={source.url} target="_blank" rel="noreferrer" title={source.title}>{source.label}</a>
                            ) : (
                              <span key={source.label} title={source.title}>{source.label}</span>
                            ))}
                          </div>
                        </section>
                        <div className="reference-disclaimer">{isReferenceGuide ? copy[locale].reference_disclaimer : copy[locale].guide_common_disclaimer}</div>
                      </div>
                      <div className="sheet-actions">
                        <button
                          className="outline-btn"
                          onClick={() => {
                            openMemoComposer(selectedGuideAlert.id);
                            setGuideTargetId(null);
                          }}
                        >
                          {copy[locale].memo_add}
                        </button>
                        {!isReferenceGuide && selectedGuideAlert.status !== 'done' ? (
                          <button
                            className="primary-btn"
                            onClick={() => {
                              completeAlert(selected.id, selectedGuideAlert.id);
                              setGuideTargetId(null);
                            }}
                          >
                            {copy[locale].complete_action}
                          </button>
                        ) : (
                          <button className="primary-btn" onClick={() => setGuideTargetId(null)}>{copy[locale].memo_close}</button>
                        )}
                      </div>
                    </section>
                  );
                })() : null}
              </>
            ) : (
              <section className="empty-state workspace-empty">
                <div className="empty-illustration" aria-hidden="true">✓</div>
                <p>{copy[locale].empty_home}</p>
                <button className="primary-btn" onClick={() => createCase(false)}>{copy[locale].start_new}</button>
                <button className="soft-btn" onClick={() => createCase(true)}>{copy[locale].sample_tour}</button>
              </section>
            )}
          </main>
        </div>
      </div>

      <nav className="mobile-tab">
        <button className={mobileTab === 'deals' ? 'active' : ''} onClick={() => setMobileTab('deals')}>
          <TabIcon kind="deals" />
          <span>{copy[locale].mobile_tab_deals}</span>
          <small aria-hidden="true">{copy[locale].mobile_tab_deals_hint}</small>
        </button>
        <button className={mobileTab === 'checklist' ? 'active' : ''} onClick={() => setMobileTab('checklist')}>
          <TabIcon kind="checklist" />
          <span>{copy[locale].mobile_tab_checklist}</span>
          <small aria-hidden="true">{copy[locale].mobile_tab_checklist_hint}</small>
        </button>
        <button className={mobileTab === 'memo' ? 'active' : ''} onClick={() => setMobileTab('memo')}>
          <TabIcon kind="memo" />
          <span>{copy[locale].mobile_tab_memo}</span>
          <small aria-hidden="true">{copy[locale].mobile_tab_memo_hint}</small>
        </button>
      </nav>
    </div>
  );
}

export default App;
