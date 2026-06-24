import { describe, expect, it } from 'vitest';
import { rowToCase } from './supabaseCaseRepository';
import type { ZipcheckAlertRow, ZipcheckCaseRow } from './supabaseRows';

const now = '2026-06-25T00:00:00.000Z';

const baseCaseRow: ZipcheckCaseRow = {
  id: 'case-1',
  owner_auth_user_id: 'auth-user-1',
  core_user_id: null,
  template_id: 'broker-checklist-v1',
  title: '원격 복원 검증',
  active_phase_key: 'pre_contract',
  reference_anchor_id: 'deposit_day_reference',
  completed: false,
  created_at: now,
  updated_at: now,
  last_opened_at: now,
  last_completed_at: null,
  payload: { version: 2, transactionType: 'bad-remote-value', propertyType: 'warehouse' },
};

const baseAlertRow: ZipcheckAlertRow = {
  case_id: 'case-1',
  alert_id: 'pre_docs',
  owner_auth_user_id: 'auth-user-1',
  phase_key: 'pre_contract',
  title_key: 'alert.pre_docs',
  detail_key: 'alert.pre_docs.detail',
  status: 'pending',
  done_at: null,
  memo_ids: [],
  wrapped_label_safe: true,
  position: 0,
};

describe('SupabaseCaseRepository row mapping', () => {
  it('normalizes invalid guide profile values from remote payloads', () => {
    const item = rowToCase(baseCaseRow, [baseAlertRow], [], []);

    expect(item.transactionType).toBe('sale');
    expect(item.propertyType).toBe('apartment');
  });

  it('restores valid guide profile values from remote payloads', () => {
    const item = rowToCase({
      ...baseCaseRow,
      payload: { version: 2, transactionType: 'jeonse', propertyType: 'villa_multi' },
    }, [baseAlertRow], [], []);

    expect(item.transactionType).toBe('jeonse');
    expect(item.propertyType).toBe('villa_multi');
  });
});
