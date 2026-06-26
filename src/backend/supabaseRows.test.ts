import { describe, expect, it } from 'vitest';
import { TEMPLATE } from '../domain';
import { createBlankCase, createEvent } from '../storage';
import { caseToRow, alertToRow, eventToRow, memoToRow } from './supabaseRows';

describe('Supabase row mappers', () => {
  it('maps case, alert, and memo data to zipcheck_ table rows without raw provider identity', () => {
    const item = createBlankCase(TEMPLATE, '서초 래미안 전세', 'ko');
    const alert = item.alerts[0];
    const memo = {
      memoId: crypto.randomUUID(),
      targetType: 'alert' as const,
      targetId: alert.id,
      text: '임대인 통화 예정',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      localeAtWrite: 'ko' as const,
    };

    const caseRow = caseToRow(item, 'auth-user-1', 'core-user-1');
    const alertRow = alertToRow(item.id, alert, 'auth-user-1', 0);
    const memoRow = memoToRow(item.id, memo, 'auth-user-1');

    expect(caseRow.owner_auth_user_id).toBe('auth-user-1');
    expect(caseRow.core_user_id).toBe('core-user-1');
    expect(caseRow.title).toBe('서초 래미안 전세');
    expect(caseRow.payload).toMatchObject({ version: 2, transactionType: 'sale', propertyType: 'apartment' });
    expect(alertRow.case_id).toBe(item.id);
    expect(alertRow.alert_id).toBe(alert.id);
    expect(memoRow.text).toBe('임대인 통화 예정');
    expect(JSON.stringify({ caseRow, alertRow, memoRow })).not.toContain('userKey');
  });

  it('sanitizes analytics event payloads before mapping remote rows', () => {
    const event = createEvent('memo_saved', {
      caseId: 'case-1',
      payload: {
        locale: 'ko',
        target: 'case',
        memoText: '원격 저장되면 안 되는 메모',
        caseTitle: '원격 저장되면 안 되는 거래명',
        authorizationCode: 'remote-auth-code',
        coreUserId: 'remote-core-user-id',
      } as any,
    });

    const eventRow = eventToRow(event, 'auth-user-1');

    expect(eventRow.payload).toEqual({ locale: 'ko', target: 'case' });
    expect(JSON.stringify(eventRow)).not.toContain('원격 저장되면 안 되는 메모');
    expect(JSON.stringify(eventRow)).not.toContain('원격 저장되면 안 되는 거래명');
    expect(JSON.stringify(eventRow)).not.toContain('remote-auth-code');
    expect(JSON.stringify(eventRow)).not.toContain('remote-core-user-id');
  });
});
