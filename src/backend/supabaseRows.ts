import type { AlertItem, CaseItem, HistoryEvent, Memo } from '../domain';

export type ZipcheckCaseRow = {
  id: string;
  owner_auth_user_id: string;
  core_user_id: string | null;
  template_id: string;
  title: string;
  active_phase_key: string;
  reference_anchor_id: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  last_opened_at: string;
  last_completed_at: string | null;
  payload: Record<string, unknown>;
};

export type ZipcheckAlertRow = {
  case_id: string;
  alert_id: string;
  owner_auth_user_id: string;
  phase_key: string;
  title_key: string;
  detail_key: string | null;
  status: string;
  done_at: string | null;
  memo_ids: string[];
  wrapped_label_safe: boolean;
  position: number;
};

export type ZipcheckMemoRow = {
  memo_id: string;
  case_id: string;
  owner_auth_user_id: string;
  target_type: Memo['targetType'];
  target_id: string;
  text: string;
  created_at: string;
  updated_at: string;
  locale_at_write: string;
};

export type ZipcheckEventRow = {
  id: string;
  case_id: string | null;
  owner_auth_user_id: string;
  alert_id: string | null;
  event_type: string;
  occurred_at: string;
  payload: HistoryEvent['payload'];
};

export const caseToRow = (item: CaseItem, ownerAuthUserId: string, coreUserId: string | null = null): ZipcheckCaseRow => ({
  id: item.id,
  owner_auth_user_id: ownerAuthUserId,
  core_user_id: coreUserId,
  template_id: item.templateId,
  title: item.title,
  active_phase_key: item.activePhaseKey,
  reference_anchor_id: item.referenceAnchorId ?? null,
  completed: item.completed,
  created_at: item.createdAt,
  updated_at: item.updatedAt,
  last_opened_at: item.lastOpenedAt,
  last_completed_at: item.lastCompletedAt ?? null,
  payload: {
    version: 2,
    transactionType: item.transactionType,
    propertyType: item.propertyType,
  },
});

export const alertToRow = (caseId: string, alert: AlertItem, ownerAuthUserId: string, position: number): ZipcheckAlertRow => ({
  case_id: caseId,
  alert_id: alert.id,
  owner_auth_user_id: ownerAuthUserId,
  phase_key: alert.phaseKey,
  title_key: alert.titleKey,
  detail_key: alert.detailKey ?? null,
  status: alert.status,
  done_at: alert.doneAt ?? null,
  memo_ids: alert.memoIds,
  wrapped_label_safe: alert.wrappedLabelSafe,
  position,
});

export const memoToRow = (caseId: string, memo: Memo, ownerAuthUserId: string): ZipcheckMemoRow => ({
  memo_id: memo.memoId,
  case_id: caseId,
  owner_auth_user_id: ownerAuthUserId,
  target_type: memo.targetType,
  target_id: memo.targetId,
  text: memo.text,
  created_at: memo.createdAt,
  updated_at: memo.updatedAt,
  locale_at_write: memo.localeAtWrite,
});

export const eventToRow = (event: HistoryEvent, ownerAuthUserId: string): ZipcheckEventRow => ({
  id: event.id,
  case_id: event.caseId ?? null,
  owner_auth_user_id: ownerAuthUserId,
  alert_id: event.alertId ?? null,
  event_type: event.type,
  occurred_at: event.timestamp,
  payload: event.payload,
});
