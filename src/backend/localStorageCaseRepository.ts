import type { CaseItem, HistoryEvent } from '../domain';
import { appendAnalyticsEvent, loadAnalyticsQueue, loadCases, saveCases } from '../storage';
import type { CaseRepository, RepositoryStatus } from './caseRepository';

export class LocalStorageCaseRepository implements CaseRepository {
  getStatus(): RepositoryStatus {
    return {
      mode: 'local',
      label: '기기 저장',
      remoteReady: false,
      message: '현재 기기에 임시 저장합니다. 로그인하지 않아도 체크리스트를 사용할 수 있습니다.',
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
