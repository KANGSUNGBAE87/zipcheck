import type { SupabaseClient } from '@supabase/supabase-js';
import type { TossLoginExchange, TossLoginExchangeResult } from '../platform/tossAuth';
import { saveZipcheckCoreUserId } from './zipcheckSession';

const normalizeExchangeResult = (value: unknown): TossLoginExchangeResult => {
  if (!value || typeof value !== 'object') {
    throw new Error('Toss login exchange returned an invalid response.');
  }
  const result = value as { linked?: unknown; coreUserId?: unknown };
  return {
    linked: result.linked === true,
    coreUserId: typeof result.coreUserId === 'string' ? result.coreUserId : undefined,
  };
};

export const createSupabaseTossLoginExchange = (supabase: SupabaseClient): TossLoginExchange => async (input) => {
  const response = await supabase.functions.invoke('zipcheck-toss-login', {
    body: input,
  });
  if (response.error) {
    throw new Error(response.error.message);
  }

  const result = normalizeExchangeResult(response.data);
  if (result.coreUserId) saveZipcheckCoreUserId(result.coreUserId);
  return result;
};
