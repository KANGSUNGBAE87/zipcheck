import type { CaseItem, HistoryEvent } from '../domain';

export type RepositoryMode = 'local' | 'supabase';

export type RepositoryStatus = {
  mode: RepositoryMode;
  label: string;
  remoteReady: boolean;
  message?: string;
};

export interface CaseRepository {
  getStatus(): RepositoryStatus;
  loadCases(): Promise<CaseItem[]>;
  saveCases(cases: CaseItem[]): Promise<void>;
  loadAnalyticsQueue(): Promise<HistoryEvent[]>;
  appendAnalyticsEvent(event: HistoryEvent): Promise<void>;
}
