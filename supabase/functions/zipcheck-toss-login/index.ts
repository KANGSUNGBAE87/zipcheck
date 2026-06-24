import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type TossLoginRequest = {
  authorizationCode?: unknown;
  referrer?: unknown;
};

const corsHeaders = {
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-origin': '*',
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...corsHeaders,
    'content-type': 'application/json',
  },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Supabase server env is not configured' }, 500);
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) return json({ error: 'Missing authorization header' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization } },
  });
  const userResponse = await userClient.auth.getUser();
  if (userResponse.error || !userResponse.data.user) {
    return json({ error: 'Invalid Supabase session' }, 401);
  }

  const body = await request.json().catch(() => null) as TossLoginRequest | null;
  const authorizationCode = typeof body?.authorizationCode === 'string' ? body.authorizationCode.trim() : '';
  const referrer = body?.referrer === 'SANDBOX' ? 'SANDBOX' : 'DEFAULT';
  if (!authorizationCode) return json({ error: 'Missing Toss authorization code' }, 400);

  const exchangeUrl = Deno.env.get('TOSS_LOGIN_TOKEN_EXCHANGE_URL');
  if (!exchangeUrl) {
    return json({
      error: 'Toss login token exchange endpoint is not configured',
      linked: false,
    }, 501);
  }

  const exchangeResponse = await fetch(exchangeUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authorizationCode, referrer }),
  });
  if (!exchangeResponse.ok) {
    return json({ error: 'Toss login token exchange failed' }, 502);
  }

  const exchangePayload = await exchangeResponse.json().catch(() => null) as { providerSubjectHash?: unknown } | null;
  const providerSubjectHash = typeof exchangePayload?.providerSubjectHash === 'string' ? exchangePayload.providerSubjectHash.trim() : '';
  if (!providerSubjectHash) return json({ error: 'Toss identity hash is missing' }, 502);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const existingResponse = await admin
    .from('authmap_user_identities')
    .select('user_id')
    .eq('provider', 'toss')
    .eq('provider_subject', providerSubjectHash)
    .is('unlinked_at', null)
    .maybeSingle();
  if (existingResponse.error) return json({ error: 'Identity lookup failed' }, 500);

  let coreUserId = existingResponse.data?.user_id as string | undefined;
  if (!coreUserId) {
    const coreResponse = await admin
      .from('core_users')
      .insert({ default_locale: 'ko' })
      .select('id')
      .single();
    if (coreResponse.error || !coreResponse.data?.id) return json({ error: 'Core user creation failed' }, 500);
    coreUserId = coreResponse.data.id as string;

    const linkResponse = await admin
      .from('authmap_user_identities')
      .insert({
        user_id: coreUserId,
        provider: 'toss',
        provider_subject: providerSubjectHash,
        provider_metadata: { referrer, authUserId: userResponse.data.user.id },
      });
    if (linkResponse.error) return json({ error: 'Identity link creation failed' }, 500);
  } else {
    const updateResponse = await admin
      .from('authmap_user_identities')
      .update({
        provider_metadata: { referrer, authUserId: userResponse.data.user.id },
        linked_at: new Date().toISOString(),
        unlinked_at: null,
      })
      .eq('provider', 'toss')
      .eq('provider_subject', providerSubjectHash);
    if (updateResponse.error) return json({ error: 'Identity link update failed' }, 500);
  }

  return json({ linked: true, coreUserId });
});
