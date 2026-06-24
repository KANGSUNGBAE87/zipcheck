import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type SupabaseEnv = Partial<Record<string, string | boolean | undefined>>;

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export const resolveSupabaseConfig = (env: SupabaseEnv = import.meta.env): SupabasePublicConfig | null => {
  if (env.MODE === 'test' && env.VITE_ENABLE_REMOTE_SUPABASE_IN_TESTS !== 'true') return null;
  const url = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : '';
  const anonKey = typeof env.VITE_SUPABASE_ANON_KEY === 'string' ? env.VITE_SUPABASE_ANON_KEY.trim() : '';
  if (!url || !anonKey) return null;
  return { url, anonKey };
};

export const createBrowserSupabaseClient = (env?: SupabaseEnv): SupabaseClient | null => {
  const config = resolveSupabaseConfig(env ?? import.meta.env);
  if (!config) return null;

  return createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
  });
};
