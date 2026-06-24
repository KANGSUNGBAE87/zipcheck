import { describe, expect, it } from 'vitest';
import { ZIPCHECK_TABLES } from './tableNames';

describe('ZipCheck Supabase table names', () => {
  it('uses the zipcheck_ app prefix and never the zc_ prefix', () => {
    const names = Object.values(ZIPCHECK_TABLES);

    expect(names).toContain('zipcheck_cases');
    expect(names).toContain('zipcheck_case_alerts');
    expect(names).toContain('zipcheck_memos');
    expect(names).toContain('zipcheck_events');
    expect(names).toContain('zipcheck_guide_entries');
    expect(names).toContain('zipcheck_app_sessions');

    expect(names.every((name) => name.startsWith('zipcheck_'))).toBe(true);
    expect(names.some((name) => name.startsWith('zc_'))).toBe(false);
  });
});
