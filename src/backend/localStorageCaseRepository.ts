import type { CaseItem, HistoryEvent } from '../domain';
import { appendAnalyticsEvent, loadAnalyticsQueue, loadCases, saveCases } from '../storage';
import type { CaseRepository, RepositoryStatus } from './caseRepository';

export class LocalStorageCaseRepository implements CaseRepository {
  getStatus(): RepositoryStatus {
    return {
      mode: 'local',
      label: 'localStorage fallback',
      remoteReady: false,
      message: 'Supabase 환경값이 없거나 원격 저장을 사용할 수 없어 이 기기에 임시 저장합니다.',
    };
  }

  async loadCases(): Promise<CaseItem[]> {
    return loadCases();
  }

  async saveCases(cases: CaseItem[]): Promise<void> {
    saveCases(cases);
  }

  async loadAnalyticsQueue(): Promise<HistoryEvent[]> {
    return loadAnalyticsQueue();
  }

  async appendAnalyticsEvent(event: HistoryEvent): Promise<void> {
    appendAnalyticsEvent(event);
  }
}
