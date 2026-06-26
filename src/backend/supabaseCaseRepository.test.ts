import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TEMPLATE, type CaseItem, type Memo } from '../domain';
import { createBlankCase, createEvent } from '../storage';
import { SupabaseCaseRepository, rowToCase } from './supabaseCaseRepository';
import { ZIPCHECK_TABLES, type ZipcheckTableName } from './tableNames';
import type { ZipcheckAlertRow, ZipcheckCaseRow, ZipcheckEventRow, ZipcheckMemoRow } from './supabaseRows';

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

type FakeDb = {
  [ZIPCHECK_TABLES.cases]: ZipcheckCaseRow[];
  [ZIPCHECK_TABLES.caseAlerts]: ZipcheckAlertRow[];
  [ZIPCHECK_TABLES.memos]: ZipcheckMemoRow[];
  [ZIPCHECK_TABLES.events]: ZipcheckEventRow[];
};

type FakeTableName = keyof FakeDb;

type FakeAuthUser = { id: string };

type FakeAuth = {
  getSession: () => Promise<{ data: { session: { user: FakeAuthUser } | null }; error: null }>;
  signInAnonymously: () => Promise<{ data: { user: FakeAuthUser | null }; error: null }>;
};

const defaultFakeAuth: FakeAuth = {
  getSession: async () => ({ data: { session: { user: { id: 'auth-user-1' } } }, error: null }),
  signInAnonymously: async () => ({ data: { user: { id: 'auth-user-1' } }, error: null }),
};

const createFakeSupabase = (db: FakeDb, auth: FakeAuth = defaultFakeAuth) => ({
  auth: {
    getSession: auth.getSession,
    signInAnonymously: auth.signInAnonymously,
  },
  from: (table: ZipcheckTableName) => new FakeQuery(db, table as FakeTableName),
});

class FakeQuery {
  private action: 'select' | 'delete' | null = null;
  private filters: Array<{ column: string; value: unknown }> = [];
  private inFilters: Array<{ column: string; values: unknown[] }> = [];

  constructor(
    private readonly db: FakeDb,
    private readonly table: FakeTableName,
  ) {}

  select() {
    this.action = 'select';
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.inFilters.push({ column, values });
    return this;
  }

  order() {
    return this;
  }

  async upsert(rows: unknown | unknown[], options?: { onConflict?: string }) {
    const nextRows = Array.isArray(rows) ? rows : [rows];
    const conflict = options?.onConflict ?? 'id';
    const keys = conflict.split(',').map((key) => key.trim());
    const tableRows = this.db[this.table] as Array<Record<string, unknown>>;
    nextRows.forEach((row) => {
      const rowRecord = row as Record<string, unknown>;
      const index = tableRows.findIndex((candidate) => keys.every((key) => candidate[key] === rowRecord[key]));
      if (index >= 0) {
        tableRows[index] = rowRecord;
      } else {
        tableRows.push(rowRecord);
      }
    });
    return { error: null };
  }

  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    const tableRows = this.db[this.table] as Array<Record<string, unknown>>;
    const matches = (row: Record<string, unknown>) => (
      this.filters.every((filter) => row[filter.column] === filter.value)
      && this.inFilters.every((filter) => filter.values.includes(row[filter.column]))
    );

    if (this.action === 'delete') {
      const kept = tableRows.filter((row) => !matches(row));
      tableRows.splice(0, tableRows.length, ...kept);
      return { data: [], error: null };
    }

    return { data: tableRows.filter(matches), error: null };
  }
}

const emptyDb = (): FakeDb => ({
  [ZIPCHECK_TABLES.cases]: [],
  [ZIPCHECK_TABLES.caseAlerts]: [],
  [ZIPCHECK_TABLES.memos]: [],
  [ZIPCHECK_TABLES.events]: [],
});

const withMemo = (item: CaseItem, memo: Memo): CaseItem => ({
  ...item,
  memos: [memo],
  alerts: item.alerts.map((alert, index) => index === 0 ? { ...alert, memoIds: [memo.memoId] } : alert),
});

const withoutMemo = (item: CaseItem, memo: Memo): CaseItem => ({
  ...item,
  memos: [],
  alerts: item.alerts.map((alert) => alert.id === memo.targetId ? { ...alert, memoIds: [] } : alert),
  history: [...item.history, createEvent('memo_deleted', { caseId: item.id, alertId: memo.targetId, payload: { target: 'alert', locale: 'ko' } })],
});

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

  it('removes remote memo rows that no longer exist in the saved case snapshot', async () => {
    const db = emptyDb();
    const repository = new SupabaseCaseRepository(createFakeSupabase(db) as unknown as SupabaseClient, () => 'core-user-1');
    const item = createBlankCase(TEMPLATE, '원격 메모 삭제 검증', 'ko');
    const memo: Memo = {
      memoId: 'memo-1',
      targetType: 'alert',
      targetId: item.alerts[0].id,
      text: '원격에서 사라져야 하는 메모',
      createdAt: now,
      updatedAt: now,
      localeAtWrite: 'ko',
    };

    await repository.saveCases([withMemo(item, memo)]);
    expect(db[ZIPCHECK_TABLES.memos]).toHaveLength(1);

    await repository.saveCases([withoutMemo(withMemo(item, memo), memo)]);

    expect(db[ZIPCHECK_TABLES.memos]).toHaveLength(0);
    expect(db[ZIPCHECK_TABLES.caseAlerts][0].memo_ids).toEqual([]);
    expect((await repository.loadCases())[0].memos).toEqual([]);
  });

  it('sanitizes remote analytics payloads on append and load', async () => {
    const db = emptyDb();
    const repository = new SupabaseCaseRepository(createFakeSupabase(db) as unknown as SupabaseClient, () => 'core-user-1');
    const unsafeEvent = createEvent('memo_saved', {
      caseId: 'case-1',
      payload: {
        locale: 'ko',
        target: 'case',
        memoText: '원격 큐에 남으면 안 되는 메모',
        title: '원격 큐에 남으면 안 되는 거래명',
        authorizationCode: 'remote-auth-code',
        coreUserId: 'remote-core-user-id',
      } as any,
    });

    await repository.appendAnalyticsEvent(unsafeEvent);

    expect(db[ZIPCHECK_TABLES.events][0].payload).toEqual({ locale: 'ko', target: 'case' });
    expect(JSON.stringify(db[ZIPCHECK_TABLES.events][0])).not.toContain('원격 큐에 남으면 안 되는 메모');

    db[ZIPCHECK_TABLES.events].push({
      id: 'legacy-remote-event',
      case_id: 'case-1',
      owner_auth_user_id: 'auth-user-1',
      alert_id: null,
      event_type: 'memo_deleted',
      occurred_at: now,
      payload: {
        locale: 'ko',
        target: 'case',
        memoText: '로드 중 제거되어야 하는 메모',
        caseTitle: '로드 중 제거되어야 하는 거래명',
      } as any,
    });

    const loadedQueue = await repository.loadAnalyticsQueue();
    expect(loadedQueue.find((event) => event.id === 'legacy-remote-event')?.payload).toEqual({ locale: 'ko', target: 'case' });
  });

  it('deduplicates concurrent anonymous sign-in for a shared Supabase client', async () => {
    const db = emptyDb();
    let signInCalls = 0;
    const supabase = createFakeSupabase(db, {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInAnonymously: async () => {
        signInCalls += 1;
        return { data: { user: { id: 'auth-user-1' } }, error: null };
      },
    }) as unknown as SupabaseClient;

    await Promise.all([
      new SupabaseCaseRepository(supabase).loadAnalyticsQueue(),
      new SupabaseCaseRepository(supabase).loadAnalyticsQueue(),
    ]);

    expect(signInCalls).toBe(1);
  });
});
