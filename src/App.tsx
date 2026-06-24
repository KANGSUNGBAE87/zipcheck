import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { copy, t } from './i18n';
import { TEMPLATE, type AlertItem, type CaseItem, type HistoryEvent, type Locale, type Memo, type PhaseKey, type PropertyType, type TransactionType } from './domain';
import { PROPERTY_OPTIONS, TRANSACTION_OPTIONS, guideTierLabel, propertyLabel, resolveGuide, resolveGuideBranches, resolveGuideSources, transactionLabel } from './guides';
import { createDefaultBackend } from './backend/defaultBackend';
import { createBlankCase, createEvent, recomputeActivePhaseKey } from './storage';

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

const formatProgress = (locale: Locale, done: number, total: number) => (
  locale === 'ko' ? `${done} / ${total} 완료` : `${done} / ${total} complete`
);

const formatRemaining = (locale: Locale, remaining: number) => (
  locale === 'ko' ? `${remaining}개 남음` : `${remaining} remaining`
);

const eventLabel = (locale: Locale, event: HistoryEvent) => {
  const key = `activity_${event.type}`;
  return t(locale, key);
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
  const [mobileTab, setMobileTab] = useState<'deals' | 'checklist' | 'memo'>('checklist');
  const [viewPhaseKey, setViewPhaseKey] = useState<PhaseKey | 'all' | null>(null);

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
        setSyncMessage(status.message ?? '');
      })
      .catch((error) => {
        if (!alive) return;
        setSyncMessage(error instanceof Error ? error.message : copy[locale].sync_load_failed);
      });
    return () => { alive = false; };
  }, [locale, repository]);

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

  const renderAlertRow = (alert: AlertItem) => {
    if (!selected) return null;
    const alertTitle = t(locale, alert.titleKey);
    const guide = resolveGuide(alert.id);
    const memoCount = alertMemoCount(selected, alert.id);
    const actionableMemoLabel = memoCount > 0
      ? `${alertTitle} ${copy[locale].memo} ${memoCount}${copy[locale].memo_count_unit}`
      : `${alertTitle} ${copy[locale].memo_add_row}`;
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
            className="text-link detail-toggle"
            onClick={() => openGuide(alert)}
            aria-label={`${alertTitle} ${copy[locale].detail_view}`}
          >
            {copy[locale].detail_view}
          </button>
        </div>
        <div className="row-actions">
          {alert.status !== 'reference' ? (
            <button
              type="button"
              className={`memo-indicator ${memoCount > 0 ? 'has-count' : 'is-empty'}`}
              aria-label={actionableMemoLabel}
              onClick={() => {
                setMemoTarget(alert.id);
                setSheetOpen(true);
                setMobileTab('memo');
              }}
            >
              {memoCount > 0 ? `${copy[locale].memo} ${memoCount}` : copy[locale].memo_add_row}
            </button>
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
  const latestMemo = selected?.memos[selected.memos.length - 1] ?? null;
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
            <button className="outline-btn auth-btn" disabled={!repositoryStatus.remoteReady || tossLoginState === 'loading'} onClick={connectTossLogin}>{tossLoginState === 'connected' ? copy[locale].toss_login_connected_short : copy[locale].toss_login}</button>
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
            ) : filteredCases.map(renderDealCard)}
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
                        <h3>{copy[locale].memo}</h3>
                        <button className="text-link" onClick={() => {
                          setMemoTarget('case');
                          setSheetOpen(true);
                          setMobileTab('memo');
                        }}>{copy[locale].memo_add}</button>
                      </div>
                      <div className="memo-box">{latestMemo ? latestMemo.text : copy[locale].empty_memo}</div>
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
                    <section className="section-card activity-card">
                      <div className="memo-title"><h3>{copy[locale].activity_timeline}</h3></div>
                      <ol className="activity-list">
                        {selected.history.slice(-5).reverse().map((event) => (
                          <li key={event.id}><span>{eventLabel(locale, event)}</span><time>{copy[locale].activity_just_now}</time></li>
                        ))}
                      </ol>
                      <button className="text-link" onClick={() => {
                        mutate((list) => list.map((item) => item.id === selected.id ? { ...item, history: [...item.history, createEvent('history_anchor_opened', { caseId: item.id, payload: { source: 'history_anchor', ...localePayload(locale) } })] } : item));
                        openCase(selected.id, 'history_anchor');
                      }}>{copy[locale].reopen}</button>
                    </section>
                  </div>
                </div>

                {sheetOpen ? (
                  <section className="memo-sheet" aria-label={copy[locale].memo} style={{ bottom: `${keyboardHeight}px` }}>
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
                      <button className="primary-btn" onClick={saveMemo}>{copy[locale].memo_save}</button>
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
                      style={{ bottom: `${keyboardHeight}px` }}
                    >
                      <div className="sheet-handle" aria-hidden="true" />
                      <div className="sheet-header">
                        <div className="sheet-heading">
                          <div className="guide-badges">
                            <span className="guide-badge">{guideTierLabel(selectedGuide)}</span>
                            {hasBranches ? <span className="guide-badge branch">{copy[locale].guide_p2_badge}</span> : null}
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
                            setMemoTarget(selectedGuideAlert.id);
                            setGuideTargetId(null);
                            setSheetOpen(true);
                            setMobileTab('memo');
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
        <button className={mobileTab === 'deals' ? 'active' : ''} onClick={() => setMobileTab('deals')}>{copy[locale].mobile_tab_deals}</button>
        <button className={mobileTab === 'checklist' ? 'active' : ''} onClick={() => setMobileTab('checklist')}>{copy[locale].mobile_tab_checklist}</button>
        <button className={mobileTab === 'memo' ? 'active' : ''} onClick={() => setMobileTab('memo')}>{copy[locale].mobile_tab_memo}</button>
      </nav>
    </div>
  );
}

export default App;
