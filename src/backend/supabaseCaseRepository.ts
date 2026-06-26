import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePropertyType, normalizeTransactionType, type AlertItem, type CaseItem, type HistoryEvent, type Memo, type PhaseKey } from '../domain';
import { sanitizeAnalyticsEvent } from '../storage';
import type { CaseRepository, RepositoryStatus } from './caseRepository';
import { eventToRow, alertToRow, caseToRow, memoToRow, type ZipcheckAlertRow, type ZipcheckCaseRow, type ZipcheckEventRow, type ZipcheckMemoRow } from './supabaseRows';
import { ZIPCHECK_TABLES } from './tableNames';
import { loadZipcheckCoreUserId } from './zipcheckSession';

type SupabaseErrorResponse = {
  error: { message?: string } | null;
};

const ensureNoError = (response: SupabaseErrorResponse) => {
  if (response.error) {
    throw new Error(response.error.message ?? 'Supabase request failed');
  }
};

const ownerAuthUserIdRequests = new WeakMap<SupabaseClient, Promise<string>>();

export const rowToCase = (
  row: ZipcheckCaseRow,
  alerts: ZipcheckAlertRow[],
  memos: ZipcheckMemoRow[],
  events: ZipcheckEventRow[],
): CaseItem => {
  const payload = row.payload ?? {};
  const transactionType = normalizeTransactionType(payload.transactionType);
  const propertyType = normalizePropertyType(payload.propertyType);

  return {
  id: row.id,
  title: row.title,
  templateId: row.template_id,
  transactionType,
  propertyType,
  activePhaseKey: row.active_phase_key as PhaseKey,
  referenceAnchorId: row.reference_anchor_id ?? undefined,
  completed: row.completed,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastOpenedAt: row.last_opened_at,
  lastCompletedAt: row.last_completed_at ?? undefined,
  alerts: alerts
    .sort((left, right) => left.position - right.position)
    .map<AlertItem>((alert) => ({
      id: alert.alert_id,
      phaseKey: alert.phase_key as PhaseKey,
      titleKey: alert.title_key,
      detailKey: alert.detail_key ?? undefined,
      status: alert.status as AlertItem['status'],
      doneAt: alert.done_at ?? undefined,
      memoIds: alert.memo_ids,
      wrappedLabelSafe: alert.wrapped_label_safe,
    })),
  memos: memos
    .sort((left, right) => left.created_at.localeCompare(right.created_at))
    .map<Memo>((memo) => ({
      memoId: memo.memo_id,
      targetType: memo.target_type,
      targetId: memo.target_id,
      text: memo.text,
      createdAt: memo.created_at,
      updatedAt: memo.updated_at,
      localeAtWrite: memo.locale_at_write as Memo['localeAtWrite'],
    })),
  history: events
    .sort((left, right) => left.occurred_at.localeCompare(right.occurred_at))
    .map<HistoryEvent>((event) => sanitizeAnalyticsEvent({
      id: event.id,
      type: event.event_type as HistoryEvent['type'],
      caseId: event.case_id ?? undefined,
      alertId: event.alert_id ?? undefined,
      timestamp: event.occurred_at,
      payload: event.payload,
    })),
  };
};

export class SupabaseCaseRepository implements CaseRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly getCoreUserId: () => string | null = loadZipcheckCoreUserId,
  ) {}

  getStatus(): RepositoryStatus {
    return {
      mode: 'supabase',
      label: 'Supabase',
      remoteReady: true,
      message: '로그인하지 않아도 저장됩니다. 토스 로그인 연결 시 계정에 이어서 보관합니다.',
    };
  }

  async loadCases(): Promise<CaseItem[]> {
    const ownerAuthUserId = await this.getOwnerAuthUserId();
    const caseResponse = await this.supabase
      .from(ZIPCHECK_TABLES.cases)
      .select('*')
      .eq('owner_auth_user_id', ownerAuthUserId)
      .order('updated_at', { ascending: false });
    ensureNoError(caseResponse);

    const caseRows = (caseResponse.data ?? []) as ZipcheckCaseRow[];
    if (caseRows.length === 0) return [];
    const caseIds = caseRows.map((row) => row.id);

    const [alertResponse, memoResponse, eventResponse] = await Promise.all([
      this.supabase.from(ZIPCHECK_TABLES.caseAlerts).select('*').eq('owner_auth_user_id', ownerAuthUserId).in('case_id', caseIds),
      this.supabase.from(ZIPCHECK_TABLES.memos).select('*').eq('owner_auth_user_id', ownerAuthUserId).in('case_id', caseIds),
      this.supabase.from(ZIPCHECK_TABLES.events).select('*').eq('owner_auth_user_id', ownerAuthUserId).in('case_id', caseIds),
    ]);
    [alertResponse, memoResponse, eventResponse].forEach(ensureNoError);

    const alerts = (alertResponse.data ?? []) as ZipcheckAlertRow[];
    const memos = (memoResponse.data ?? []) as ZipcheckMemoRow[];
    const events = (eventResponse.data ?? []) as ZipcheckEventRow[];

    return caseRows.map((caseRow) => rowToCase(
      caseRow,
      alerts.filter((alert) => alert.case_id === caseRow.id),
      memos.filter((memo) => memo.case_id === caseRow.id),
      events.filter((event) => event.case_id === caseRow.id),
    ));
  }

  async saveCases(cases: CaseItem[]): Promise<void> {
    const ownerAuthUserId = await this.getOwnerAuthUserId();
    const coreUserId = this.getCoreUserId();
    if (cases.length === 0) return;

    const caseRows = cases.map((item) => caseToRow(item, ownerAuthUserId, coreUserId));
    const alertRows = cases.flatMap((item) => item.alerts.map((alert, index) => alertToRow(item.id, alert, ownerAuthUserId, index)));
    const memoRows = cases.flatMap((item) => item.memos.map((memo) => memoToRow(item.id, memo, ownerAuthUserId)));
    const eventRows = cases.flatMap((item) => item.history.map((event) => eventToRow(event, ownerAuthUserId)));
    const caseIds = cases.map((item) => item.id);

    ensureNoError(await this.supabase.from(ZIPCHECK_TABLES.cases).upsert(caseRows, { onConflict: 'id' }));
    if (alertRows.length > 0) ensureNoError(await this.supabase.from(ZIPCHECK_TABLES.caseAlerts).upsert(alertRows, { onConflict: 'case_id,alert_id' }));
    if (memoRows.length > 0) ensureNoError(await this.supabase.from(ZIPCHECK_TABLES.memos).upsert(memoRows, { onConflict: 'memo_id' }));
    const memoResponse = await this.supabase
      .from(ZIPCHECK_TABLES.memos)
      .select('memo_id')
      .eq('owner_auth_user_id', ownerAuthUserId)
      .in('case_id', caseIds);
    ensureNoError(memoResponse);
    const currentMemoIds = new Set(memoRows.map((memo) => memo.memo_id));
    const staleMemoIds = ((memoResponse.data ?? []) as Pick<ZipcheckMemoRow, 'memo_id'>[])
      .map((memo) => memo.memo_id)
      .filter((memoId) => !currentMemoIds.has(memoId));
    if (staleMemoIds.length > 0) {
      ensureNoError(await this.supabase
        .from(ZIPCHECK_TABLES.memos)
        .delete()
        .eq('owner_auth_user_id', ownerAuthUserId)
        .in('memo_id', staleMemoIds));
    }
    if (eventRows.length > 0) ensureNoError(await this.supabase.from(ZIPCHECK_TABLES.events).upsert(eventRows, { onConflict: 'id' }));
  }

  async loadAnalyticsQueue(): Promise<HistoryEvent[]> {
    const ownerAuthUserId = await this.getOwnerAuthUserId();
    const response = await this.supabase
      .from(ZIPCHECK_TABLES.events)
      .select('*')
      .eq('owner_auth_user_id', ownerAuthUserId)
      .order('occurred_at', { ascending: true });
    ensureNoError(response);

    return ((response.data ?? []) as ZipcheckEventRow[]).map((event) => sanitizeAnalyticsEvent({
      id: event.id,
      type: event.event_type as HistoryEvent['type'],
      caseId: event.case_id ?? undefined,
      alertId: event.alert_id ?? undefined,
      timestamp: event.occurred_at,
      payload: event.payload,
    }));
  }

  async appendAnalyticsEvent(event: HistoryEvent): Promise<void> {
    const ownerAuthUserId = await this.getOwnerAuthUserId();
    ensureNoError(await this.supabase.from(ZIPCHECK_TABLES.events).upsert(eventToRow(event, ownerAuthUserId), { onConflict: 'id' }));
  }

  private async getOwnerAuthUserId(): Promise<string> {
    const pending = ownerAuthUserIdRequests.get(this.supabase);
    if (pending) return pending;

    const request = this.resolveOwnerAuthUserId()
      .finally(() => ownerAuthUserIdRequests.delete(this.supabase));
    ownerAuthUserIdRequests.set(this.supabase, request);
    return request;
  }

  private async resolveOwnerAuthUserId(): Promise<string> {
    const sessionResponse = await this.supabase.auth.getSession();
    if (sessionResponse.error) throw new Error(sessionResponse.error.message);
    if (sessionResponse.data.session?.user.id) return sessionResponse.data.session.user.id;

    const signInResponse = await this.supabase.auth.signInAnonymously();
    if (signInResponse.error) throw new Error(signInResponse.error.message);
    const userId = signInResponse.data.user?.id;
    if (!userId) throw new Error('Supabase auth session is unavailable.');
    return userId;
  }
}
