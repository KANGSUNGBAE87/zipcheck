import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ZIPCHECK_TABLES } from './tableNames';

const sql = () => readFileSync(resolve(process.cwd(), 'supabase/migrations/20260625_zipcheck_apps_in_toss.sql'), 'utf8');

describe('ZipCheck Supabase migration', () => {
  it('uses zipcheck_ for app tables and keeps shared identity prefixes separate', () => {
    const migration = sql();

    Object.values(ZIPCHECK_TABLES).forEach((tableName) => {
      expect(migration).toContain(`create table if not exists public.${tableName}`);
      expect(tableName.startsWith('zipcheck_')).toBe(true);
      expect(tableName.startsWith('zc_')).toBe(false);
    });

    expect(migration).toContain('create table if not exists public.core_users');
    expect(migration).toContain('create table if not exists public.authmap_user_identities');
    expect(migration).not.toMatch(/public\.zc_/);
  });

  it('enables RLS without public-open user-data policies or raw Toss userKey storage', () => {
    const migration = sql();

    ['zipcheck_cases', 'zipcheck_case_alerts', 'zipcheck_memos', 'zipcheck_events', 'zipcheck_app_sessions'].forEach((tableName) => {
      expect(migration).toContain(`alter table public.${tableName} enable row level security`);
    });

    expect(migration).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/with\s+check\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/user_?key/i);
  });
});
