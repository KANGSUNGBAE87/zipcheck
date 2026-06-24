import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppsInTossAuthAdapter, TossLoginFn } from '../platform/tossAuth';
import { createAppsInTossAuthAdapter } from '../platform/tossAuth';
import type { CaseRepository } from './caseRepository';
import { LocalStorageCaseRepository } from './localStorageCaseRepository';
import { SupabaseCaseRepository } from './supabaseCaseRepository';
import { createBrowserSupabaseClient, type SupabaseEnv } from './supabaseClient';
import { createSupabaseTossLoginExchange } from './tossLoginBackend';

export type BackendOptions = {
  env?: SupabaseEnv;
  supabaseClient?: SupabaseClient | null;
  appLogin?: TossLoginFn;
};

const unavailableTossAuthAdapter = (): AppsInTossAuthAdapter => ({
  async signInWithToss() {
    throw new Error('Supabase public env is not configured for Toss login.');
  },
});

const resolveClient = (options: BackendOptions = {}) => (
  options.supabaseClient !== undefined ? options.supabaseClient : createBrowserSupabaseClient(options.env)
);

export const createDefaultCaseRepository = (options: BackendOptions = {}): CaseRepository => {
  const supabase = resolveClient(options);
  return supabase ? new SupabaseCaseRepository(supabase) : new LocalStorageCaseRepository();
};

export const createDefaultAppsInTossAuthAdapter = (options: BackendOptions = {}): AppsInTossAuthAdapter => {
  const supabase = resolveClient(options);
  if (!supabase) return unavailableTossAuthAdapter();
  return createAppsInTossAuthAdapter({
    appLogin: options.appLogin,
    exchangeTossLogin: createSupabaseTossLoginExchange(supabase),
  });
};

export const createDefaultBackend = (options: BackendOptions = {}) => {
  const supabase = resolveClient(options);
  return {
    repository: supabase ? new SupabaseCaseRepository(supabase) : new LocalStorageCaseRepository(),
    authAdapter: supabase
      ? createAppsInTossAuthAdapter({
        appLogin: options.appLogin,
        exchangeTossLogin: createSupabaseTossLoginExchange(supabase),
      })
      : unavailableTossAuthAdapter(),
  };
};
