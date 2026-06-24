export const ZIPCHECK_TABLES = {
  cases: 'zipcheck_cases',
  caseAlerts: 'zipcheck_case_alerts',
  memos: 'zipcheck_memos',
  events: 'zipcheck_events',
  guideEntries: 'zipcheck_guide_entries',
  guideSources: 'zipcheck_guide_sources',
  guideEntrySources: 'zipcheck_guide_entry_sources',
  guideBranches: 'zipcheck_guide_branches',
  appSessions: 'zipcheck_app_sessions',
} as const;

export type ZipcheckTableName = (typeof ZIPCHECK_TABLES)[keyof typeof ZIPCHECK_TABLES];
