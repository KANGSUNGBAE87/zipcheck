import { useEffect, useMemo, useState } from 'react';
import { copy, t } from './i18n';
import { TEMPLATE, type CaseItem, type Locale, type Memo, type PhaseKey } from './domain';
import { appendAnalyticsEvent, createBlankCase, createEvent, loadCases, recomputeActivePhaseKey, saveCases } from './storage';

const emitLocaleEvent = (
  history: ReturnType<typeof createEvent>[],
  eventType: 'phase_viewed' | 'alert_viewed' | 'memo_opened',
  payload: Record<string, string | number | boolean>,
) => {
  const event = createEvent(eventType, { payload });
  appendAnalyticsEvent(event);
  return [...history, event];
};

const activeAlert = (item: CaseItem) => item.alerts.find((alert) => alert.status === 'pending') ?? null;
const selectedReferenceAlert = (item: CaseItem) => item.alerts.find((alert) => alert.id === item.referenceAnchorId && alert.status === 'reference')
  ?? item.alerts.find((alert) => alert.status === 'reference')
  ?? null;
const alertMemoCount = (item: CaseItem, alertId: string) => {
  const alert = item.alerts.find((entry) => entry.id === alertId);
  if (!alert) return 0;
  const memoIds = new Set(alert.memoIds);
  return item.memos.filter((memo) => memo.targetType === 'alert' && memo.targetId === alertId && memoIds.has(memo.memoId)).length;
};

const localePayload = (locale: Locale) => ({ locale });
const referencePhaseKey = TEMPLATE.referencePhaseKeys[0];

function App() {
  const [locale, setLocale] = useState<Locale>('ko');
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftMemo, setDraftMemo] = useState('');
  const [memoTarget, setMemoTarget] = useState<'case' | string>('case');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [undoTarget, setUndoTarget] = useState<{ caseId: string; alertId: string } | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

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

  useEffect(() => setCases(loadCases()), []);
  useEffect(() => { saveCases(cases); }, [cases]);
  useEffect(() => {
    if (!selectedId && cases[0]) setSelectedId(cases[0].id);
  }, [cases, selectedId]);

  const selected = cases.find((item) => item.id === selectedId) ?? null;
  const stats = useMemo(() => ({ active: cases.length, remaining: cases.reduce((count, item) => count + item.alerts.filter((alert) => alert.status === 'pending').length, 0) }), [cases]);

  const mutate = (updater: (list: CaseItem[]) => CaseItem[]) => setCases((prev) => updater(prev).map((item) => ({ ...item, updatedAt: new Date().toISOString() })));

  const openCase = (caseId: string, source: 'case_list' | 'history_anchor' = 'case_list') => {
    setSelectedId(caseId);
    mutate((list) => list.map((item) => item.id === caseId
      ? { ...item, lastOpenedAt: new Date().toISOString(), history: [...item.history, createEvent('case_opened', { caseId, payload: { source, ...localePayload(locale) } })] }
      : item));
  };

  const createCase = () => {
    const created = createBlankCase(TEMPLATE, draftTitle, locale);
    mutate((list) => [created, ...list]);
    setSelectedId(created.id);
    setDraftTitle('');
    setMemoTarget('case');
    setSheetOpen(false);
  };

  const completeAlert = (caseId: string, alertId: string) => {
    setUndoTarget({ caseId, alertId });
    mutate((list) => list.map((item) => {
      if (item.id !== caseId) return item;
      const alerts = item.alerts.map((alert) => alert.id === alertId ? { ...alert, status: 'done' as const, doneAt: new Date().toISOString() } : alert);
      const completedCount = alerts.filter((alert) => alert.status === 'done').length;
      const activePhaseKey = recomputeActivePhaseKey(alerts);
      const completed = alerts.every((alert) => alert.status !== 'pending');
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
      const completed = alerts.every((alert) => alert.status !== 'pending');
      const history = [...item.history, createEvent('alert_undone', { caseId, alertId, payload: { alertId, ...localePayload(locale) } })];
      return { ...item, alerts, activePhaseKey, completed, history };
    }));
    setUndoTarget(null);
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
    appendAnalyticsEvent(createEvent('memo_saved', { caseId: selected.id, payload: { target: memoTarget === 'case' ? 'case' : 'alert', ...localePayload(locale) } }));
    setDraftMemo('');
    setSheetOpen(false);
  };

  const selectedAlert = selected ? activeAlert(selected) : null;
  const selectedMemoAlert = selected && memoTarget !== 'case'
    ? selected.alerts.find((alert) => alert.id === memoTarget) ?? null
    : null;
  const referenceSheetOpen = selectedMemoAlert?.status === 'reference';
  const currentPhaseLabel = selected ? t(locale, `phase.${selected.activePhaseKey}`) : '';
  const alertsByPhase = useMemo(() => TEMPLATE.phaseOrder.map((phaseKey) => ({
    phaseKey,
    alerts: selected?.alerts.filter((alert) => alert.phaseKey === phaseKey) ?? [],
  })), [selected]);

  useEffect(() => {
    if (!selected) return;
    mutate((list) => list.map((item) => item.id === selected.id
      ? { ...item, history: emitLocaleEvent(item.history, 'phase_viewed', { phaseKey: item.activePhaseKey, ...localePayload(locale) }) }
      : item));
  }, [locale, selected?.id, selected?.activePhaseKey]);

  useEffect(() => {
    if (!selectedAlert) return;
    mutate((list) => list.map((item) => item.id === selected?.id
      ? { ...item, history: emitLocaleEvent(item.history, 'alert_viewed', { alertId: selectedAlert.id, phaseKey: selectedAlert.phaseKey, ...localePayload(locale) }) }
      : item));
  }, [locale, selected?.id, selectedAlert?.id]);

  useEffect(() => {
    if (!sheetOpen || !selected) return;
    mutate((list) => list.map((item) => item.id === selected.id
      ? { ...item, history: emitLocaleEvent(item.history, 'memo_opened', { target: memoTarget, ...localePayload(locale) }) }
      : item));
  }, [locale, memoTarget, selected?.id, sheetOpen]);

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>{copy[locale].app_name}</h1>
          <p>{copy[locale].home_subtitle}</p>
        </div>
        <button className="ghost" onClick={() => setLocale((prev) => (prev === 'ko' ? 'en' : 'ko'))}>{copy[locale].locale_toggle}</button>
      </header>

      <section className="stats" aria-label={copy[locale].stats_aria_label}>
        <strong>{copy[locale].home_title}</strong> · {stats.active} / {stats.remaining}
      </section>

      <div className="layout">
        <aside className="panel list-panel">
          <div className="actions">
            <input aria-label={copy[locale].deal_title} value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder={copy[locale].deal_placeholder} />
            <button onClick={createCase}>{copy[locale].create}</button>
          </div>
          <p className="trust-notice trust-notice-home">{copy[locale].trust_notice}</p>
          {cases.length === 0 ? <p className="empty">{copy[locale].empty_home}</p> : cases.map((item) => {
            const next = activeAlert(item);
            return (
              <button key={item.id} className={`case-card ${item.id === selectedId ? 'selected' : ''}`} onClick={() => openCase(item.id)}>
                <div className="card-head">
                  <span className="phase-chip">{t(locale, `phase.${item.activePhaseKey}`)}</span>
                  <span className="muted">{item.lastOpenedAt.slice(11, 16)}</span>
                </div>
                <strong>{item.title}</strong>
                <p>{item.completed ? copy[locale].completion_message : next ? t(locale, next.titleKey) : copy[locale].reference_optional_notice}</p>
                <div className="progress">{item.alerts.filter((alert) => alert.status === 'done').length} / {item.alerts.length}</div>
              </button>
            );
          })}
        </aside>

        <main className="panel detail-panel">
          {selected ? (
            <>
              <div className="detail-head">
                <div>
                  <span className="kicker">{copy[locale].active_case}</span>
                  <h2>{selected.title}</h2>
                </div>
                <button className="ghost" onClick={() => setSheetOpen((prev) => !prev)}>{copy[locale].memo}</button>
              </div>

              <div className="template-title">{copy[locale].template.basic}</div>
              <p className="muted">{selected.completed ? copy[locale].reference_optional_notice : copy[locale].reference_notice}</p>
              <p className="trust-notice">{copy[locale].trust_notice}</p>
              <div className="sticky-phase-context">
                <span className="kicker">{copy[locale].current_phase}</span>
                <strong>{currentPhaseLabel}</strong>
              </div>
              <div className="phase-rail" aria-label={copy[locale].phase_rail}>
                {TEMPLATE.phaseOrder.map((phaseKey: PhaseKey) => (
                  <div key={phaseKey} className={`phase-node ${phaseKey === selected.activePhaseKey ? 'active' : ''} ${TEMPLATE.referencePhaseKeys.includes(phaseKey) ? 'reference' : ''}`}>
                    <strong>{t(locale, `phase.${phaseKey}`)}</strong>
                    {TEMPLATE.referencePhaseKeys.includes(phaseKey) ? <span>{copy[locale].reference_title}</span> : <span>{selected.activePhaseKey === phaseKey ? copy[locale].current_phase : ''}</span>}
                  </div>
                ))}
              </div>

              <section className="alerts">
                <h3>{selected.completed ? copy[locale].completed_state : copy[locale].next_alert}</h3>
                {selected.completed ? <p className="muted">{copy[locale].completion_notice}</p> : null}
                {undoTarget ? (
                  <div className="undo-banner">
                    <span>{copy[locale].complete_undo_hint}</span>
                    <button className="ghost" onClick={undoCompleteAlert}>{copy[locale].complete_undo}</button>
                  </div>
                ) : null}
                {alertsByPhase.map(({ phaseKey, alerts }) => (
                  <section key={phaseKey} className={`phase-section ${TEMPLATE.referencePhaseKeys.includes(phaseKey) ? 'reference' : ''}`}>
                    <h4>{t(locale, `phase.${phaseKey}`)}</h4>
                    {phaseKey === referencePhaseKey ? <p className="reference-section-note">{copy[locale].reference_section_note}</p> : null}
                    {alerts.map((alert) => {
                      const expanded = expandedDetails[alert.id] ?? (alert.status === 'reference' || alert.status === 'done');
                      return (
                        <div key={alert.id} className={`alert-row ${alert.status} ${alert.status === 'done' ? 'completed' : ''}`}>
                          <div className="alert-copy">
                            <div className="alert-title">{t(locale, alert.titleKey)}</div>
                            {alert.detailKey ? (
                              <button type="button" className="detail-toggle ghost-inline" onClick={() => setExpandedDetails((prev) => ({ ...prev, [alert.id]: !expanded }))} aria-expanded={expanded}>
                                {expanded ? copy[locale].detail_less : copy[locale].detail_more}
                              </button>
                            ) : null}
                            {alert.detailKey && expanded ? <div className="muted alert-detail">{t(locale, alert.detailKey)}</div> : null}
                          </div>
                          <div className="alert-actions">
                            {alertMemoCount(selected, alert.id) > 0 ? (
                              <button type="button" className="memo-indicator" aria-label={`${copy[locale].memo_exists} ${alertMemoCount(selected, alert.id)}${copy[locale].memo_count_unit}`} onClick={() => {
                                setMemoTarget(alert.id);
                                setSheetOpen(true);
                              }}>
                                <span className="memo-indicator-label">{`${copy[locale].memo} ${alertMemoCount(selected, alert.id)}`}</span>
                                <span className="memo-badge">{alertMemoCount(selected, alert.id)}</span>
                              </button>
                            ) : null}
                            {alert.status === 'reference' ? (
                              <button className="ghost" aria-label={`${t(locale, alert.titleKey)} - ${copy[locale].reference_only_label}`} onClick={() => {
                                setMemoTarget(alert.id);
                                setSheetOpen(true);
                                mutate((list) => list.map((item) => item.id === selected.id ? { ...item, referenceAnchorId: alert.id, history: [...item.history, createEvent('reference_opened', { caseId: item.id, alertId: alert.id, payload: { alertId: alert.id, ...localePayload(locale) } })] } : item));
                              }}>{copy[locale].reference_view_label}</button>
                            ) : (
                              <button aria-label={`${t(locale, alert.titleKey)} - ${alert.status === 'done' ? copy[locale].completed : copy[locale].complete_action}`} disabled={alert.status === 'done'} onClick={() => completeAlert(selected.id, alert.id)}>{alert.status === 'done' ? '✓' : '○'}</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </section>
                ))}
              </section>

              <section className="history">
                <h3>{copy[locale].history}</h3>
                <p className="muted">{selected.history.slice(-5).map((event) => event.type).join(' · ')}</p>
                <button className="ghost" onClick={() => {
                  mutate((list) => list.map((item) => item.id === selected.id ? { ...item, history: [...item.history, createEvent('history_anchor_opened', { caseId: item.id, payload: { source: 'history_anchor', ...localePayload(locale) } })] } : item));
                  openCase(selected.id, 'history_anchor');
                }}>{copy[locale].reopen}</button>
              </section>

              {sheetOpen ? (
                <section className="memo-sheet" aria-label={copy[locale].memo} style={{ bottom: `${keyboardHeight}px` }}>
                  <div className="sheet-handle" aria-hidden="true" />
                  <div className="sheet-header">
                    <div className="sheet-heading">
                      {referenceSheetOpen ? <span className="reference-badge">{copy[locale].reference_only_label}</span> : null}
                      <label>
                        {referenceSheetOpen ? t(locale, selectedMemoAlert.titleKey) : copy[locale].memo}
                        {referenceSheetOpen ? null : (
                          <select value={memoTarget} onChange={(e) => setMemoTarget(e.target.value)}>
                            <option value="case">{copy[locale].memo_target_case}</option>
                            {selected.alerts.map((alert) => <option key={alert.id} value={alert.id}>{t(locale, alert.titleKey)}</option>)}
                          </select>
                        )}
                      </label>
                    </div>
                    <button className="ghost dismiss" aria-label={copy[locale].memo_close} onClick={() => setSheetOpen(false)}>{copy[locale].memo_close}</button>
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
                    <button onClick={saveMemo}>{copy[locale].memo_save}</button>
                    <button className="ghost" onClick={() => setSheetOpen(false)}>{copy[locale].memo_close}</button>
                  </div>
                </section>
              ) : null}
            </>
          ) : <p className="empty">{copy[locale].empty_home}</p>}
        </main>
      </div>
    </div>
  );
}

export default App;
