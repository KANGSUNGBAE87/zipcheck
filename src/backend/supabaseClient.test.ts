import { describe, expect, it } from 'vitest';
import { resolveSupabaseConfig } from './supabaseClient';

describe('Supabase client config', () => {
  it('falls back to local storage when public Supabase env is incomplete', () => {
    expect(resolveSupabaseConfig({})).toBeNull();
    expect(resolveSupabaseConfig({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
    })).toBeNull();
  });

  it('uses only public browser Supabase values for client configuration', () => {
    expect(resolveSupabaseConfig({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'server-only',
    })).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });
  });
});
