export type Locale = 'ko' | 'en';

export type PhaseKey = 'pre_contract' | 'contract_day' | 'deposit_prep' | 'deposit_day_reference' | 'post_contract';

export type AlertStatus = 'pending' | 'done' | 'reference';

export type AlertItem = {
  id: string;
  phaseKey: PhaseKey;
  titleKey: string;
  detailKey?: string;
  status: AlertStatus;
  doneAt?: string;
  memoIds: string[];
  wrappedLabelSafe: boolean;
};

export type Memo = {
  memoId: string;
  targetType: 'case' | 'alert';
  targetId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  localeAtWrite: Locale;
};

export type HistoryEventType = 'session_start' | 'case_created' | 'case_opened' | 'phase_viewed' | 'alert_viewed' | 'alert_completed' | 'alert_undone' | 'memo_opened' | 'memo_saved' | 'reference_opened' | 'history_anchor_opened' | 'case_completed' | 'toss_login_linked';

export type HistoryEvent = {
  id: string;
  type: HistoryEventType;
  caseId?: string;
  alertId?: string;
  timestamp: string;
  payload: Record<string, string | number | boolean>;
};

export type CaseItem = {
  id: string;
  title: string;
  templateId: string;
  activePhaseKey: PhaseKey;
  alerts: AlertItem[];
  memos: Memo[];
  history: HistoryEvent[];
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  lastCompletedAt?: string;
  completed: boolean;
  referenceAnchorId?: string;
};

export type Template = {
  id: string;
  nameKey: string;
  phaseOrder: PhaseKey[];
  alertsByPhase: Record<PhaseKey, { id: string; titleKey: string; detailKey?: string; status: AlertStatus }[]>;
  referencePhaseKeys: PhaseKey[];
};

export const PHASE_LABELS: Record<PhaseKey, { ko: string; en: string }> = {
  pre_contract: { ko: '계약 전', en: 'Pre-contract' },
  contract_day: { ko: '계약 당일', en: 'Contract day' },
  deposit_prep: { ko: '잔금 준비', en: 'Deposit prep' },
  deposit_day_reference: { ko: '잔금일 참고', en: 'Deposit day reference' },
  post_contract: { ko: '계약 후', en: 'Post-contract' },
};

export const TEMPLATE: Template = {
  id: 'broker-checklist-v1',
  nameKey: 'template.basic',
  phaseOrder: ['pre_contract', 'contract_day', 'deposit_prep', 'deposit_day_reference', 'post_contract'],
  referencePhaseKeys: ['deposit_day_reference'],
  alertsByPhase: {
    pre_contract: [
      { id: 'pre_docs', titleKey: 'alert.pre_docs', detailKey: 'alert.pre_docs.detail', status: 'pending' },
      { id: 'pre_owner', titleKey: 'alert.pre_owner', detailKey: 'alert.pre_owner.detail', status: 'pending' },
      { id: 'pre_walkthrough', titleKey: 'alert.pre_walkthrough', detailKey: 'alert.pre_walkthrough.detail', status: 'pending' },
    ],
    contract_day: [
      { id: 'contract_confirm', titleKey: 'alert.contract_confirm', detailKey: 'alert.contract_confirm.detail', status: 'pending' },
      { id: 'contract_copy', titleKey: 'alert.contract_copy', detailKey: 'alert.contract_copy.detail', status: 'pending' },
      { id: 'contract_signature', titleKey: 'alert.contract_signature', detailKey: 'alert.contract_signature.detail', status: 'pending' },
    ],
    deposit_prep: [
      { id: 'deposit_transfer', titleKey: 'alert.deposit_transfer', detailKey: 'alert.deposit_transfer.detail', status: 'pending' },
      { id: 'deposit_receipt', titleKey: 'alert.deposit_receipt', detailKey: 'alert.deposit_receipt.detail', status: 'pending' },
      { id: 'deposit_schedule', titleKey: 'alert.deposit_schedule', detailKey: 'alert.deposit_schedule.detail', status: 'pending' },
    ],
    deposit_day_reference: [
      { id: 'deposit_ref_docs', titleKey: 'alert.deposit_ref_docs', detailKey: 'alert.deposit_ref_docs.detail', status: 'reference' },
      { id: 'deposit_ref_parties', titleKey: 'alert.deposit_ref_parties', detailKey: 'alert.deposit_ref_parties.detail', status: 'reference' },
      { id: 'deposit_ref_final', titleKey: 'alert.deposit_ref_final', detailKey: 'alert.deposit_ref_final.detail', status: 'reference' },
      { id: 'deposit_ref_after', titleKey: 'alert.deposit_ref_after', detailKey: 'alert.deposit_ref_after.detail', status: 'reference' },
    ],
    post_contract: [
      { id: 'post_archive', titleKey: 'alert.post_archive', detailKey: 'alert.post_archive.detail', status: 'pending' },
      { id: 'post_followup', titleKey: 'alert.post_followup', detailKey: 'alert.post_followup.detail', status: 'pending' },
      { id: 'post_utility', titleKey: 'alert.post_utility', detailKey: 'alert.post_utility.detail', status: 'pending' },
    ],
  },
};
