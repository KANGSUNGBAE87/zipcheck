import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type TossLoginRequest = {
  action?: unknown;
  authorizationCode?: unknown;
  referrer?: unknown;
  coreUserId?: unknown;
};

type TossDisconnectReason = 'UNLINK' | 'WITHDRAWAL_TERMS' | 'WITHDRAWAL_TOSS';

type TossDisconnectRequest = {
  providerSubjectHash?: unknown;
  reason?: unknown;
  eventType?: unknown;
  userKey?: unknown;
  referrer?: unknown;
};

const disconnectReasons = new Set<TossDisconnectReason>(['UNLINK', 'WITHDRAWAL_TERMS', 'WITHDRAWAL_TOSS']);

const isDisconnectReason = (value: unknown): value is TossDisconnectReason => (
  typeof value === 'string' && disconnectReasons.has(value as TossDisconnectReason)
);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const resolveCorsHeaders = (request: Request) => {
  const origin = request.headers.get('origin') ?? '';
  const allowedOrigins = (Deno.env.get('ZIPCHECK_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const allowAll = allowedOrigins.length === 0;
  const allowed = allowAll || !origin || allowedOrigins.includes(origin);
  return {
    allowed,
    headers: {
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-zipcheck-callback-secret',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-origin': allowAll ? '*' : origin,
      'vary': 'Origin',
    },
  };
};

const json = (body: Record<string, unknown>, headers: Record<string, string>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...headers,
    'content-type': 'application/json',
  },
});

const readBearerSecret = (request: Request) => {
  const authorization = request.headers.get('authorization') ?? '';
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return request.headers.get('x-zipcheck-callback-secret')?.trim() || bearer || '';
};

const readBasicCredentials = (request: Request) => {
  const authorization = request.headers.get('authorization') ?? '';
  const encoded = authorization.match(/^Basic\s+(.+)$/i)?.[1]?.trim();
  if (!encoded) return null;
  try {
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex < 0) return null;
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
};

const resolveDisconnectAuthorization = (request: Request) => {
  const callbackSecret = Deno.env.get('TOSS_DISCONNECT_CALLBACK_SECRET')?.trim();
  const basicUsername = Deno.env.get('TOSS_DISCONNECT_CALLBACK_BASIC_USERNAME')?.trim();
  const basicPassword = Deno.env.get('TOSS_DISCONNECT_CALLBACK_BASIC_PASSWORD')?.trim();
  const basicCredentials = readBasicCredentials(request);

  const internalAuthorized = Boolean(callbackSecret && readBearerSecret(request) === callbackSecret);
  const basicAuthorized = Boolean(
    basicUsername
    && basicPassword
    && basicCredentials?.username === basicUsername
    && basicCredentials.password === basicPassword
  );

  return {
    configured: Boolean(callbackSecret || (basicUsername && basicPassword)),
    authorized: internalAuthorized || basicAuthorized,
  };
};

const parseDisconnectPayload = async (request: Request): Promise<TossDisconnectRequest> => {
  const url = new URL(request.url);
  const queryPayload = Object.fromEntries(url.searchParams.entries());
  if (request.method !== 'POST') return queryPayload;

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null);
    return { ...queryPayload, ...(isRecord(body) ? body : {}) };
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    return { ...queryPayload, ...Object.fromEntries(new URLSearchParams(text).entries()) };
  }

  return queryPayload;
};

const hashTossUserKey = async (userKey: string) => {
  const hashSecret = Deno.env.get('TOSS_USER_KEY_HASH_SECRET')?.trim();
  if (!hashSecret) return '';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(hashSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(userKey));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const clearZipcheckUserData = async (
  admin: ReturnType<typeof createClient>,
  coreUserId: string,
  ownerAuthUserId: string,
) => {
  if (ownerAuthUserId) {
    for (const table of ['zipcheck_case_alerts', 'zipcheck_memos', 'zipcheck_events', 'zipcheck_cases']) {
      const response = await admin.from(table).delete().eq('owner_auth_user_id', ownerAuthUserId);
      if (response.error) return response.error.message ?? `${table} cleanup failed`;
    }
  }

  const caseResponse = await admin
    .from('zipcheck_cases')
    .delete()
    .eq('core_user_id', coreUserId);
  if (caseResponse.error) return caseResponse.error.message ?? 'case cleanup failed';

  const sessionResponse = await admin
    .from('zipcheck_app_sessions')
    .delete()
    .eq('core_user_id', coreUserId);
  if (sessionResponse.error) return sessionResponse.error.message ?? 'app session cleanup failed';

  return '';
};

const handleConnectionStatus = async (
  body: TossLoginRequest | null,
  admin: ReturnType<typeof createClient>,
  currentAuthUserId: string,
  headers: Record<string, string>,
) => {
  const coreUserId = typeof body?.coreUserId === 'string' ? body.coreUserId.trim() : '';
  if (!coreUserId) return json({ connected: false }, headers);

  const identityResponse = await admin
    .from('authmap_user_identities')
    .select('provider_metadata')
    .eq('provider', 'toss')
    .eq('user_id', coreUserId)
    .is('unlinked_at', null)
    .maybeSingle();
  if (identityResponse.error) return json({ error: 'Identity status lookup failed' }, headers, 500);

  const providerMetadata = isRecord(identityResponse.data?.provider_metadata) ? identityResponse.data.provider_metadata : {};
  const authUserId = typeof providerMetadata.authUserId === 'string' ? providerMetadata.authUserId : '';
  return json({ connected: Boolean(identityResponse.data && authUserId === currentAuthUserId) }, headers);
};

const handleDisconnectCallback = async (
  request: Request,
  admin: ReturnType<typeof createClient>,
  headers: Record<string, string>,
) => {
  const authorization = resolveDisconnectAuthorization(request);
  if (!authorization.configured) {
    return json({ error: 'Toss disconnect callback auth is not configured' }, headers, 501);
  }
  if (!authorization.authorized) {
    return json({ error: 'Unauthorized disconnect callback' }, headers, 401);
  }

  const body = await parseDisconnectPayload(request);

  const reasonCandidate = body.reason ?? body.eventType ?? 'UNLINK';
  if (!isDisconnectReason(reasonCandidate)) {
    return json({ error: 'Unsupported Toss disconnect reason' }, headers, 400);
  }

  let providerSubjectHash = typeof body.providerSubjectHash === 'string' ? body.providerSubjectHash.trim() : '';
  const userKey = typeof body.userKey === 'string' ? body.userKey.trim() : '';
  if (!providerSubjectHash && userKey) {
    providerSubjectHash = await hashTossUserKey(userKey);
    if (!providerSubjectHash) {
      return json({ error: 'Toss userKey hash secret is not configured' }, headers, 501);
    }
  }
  if (!providerSubjectHash) {
    return json({ error: 'Missing hashed Toss identity' }, headers, 400);
  }

  const identityResponse = await admin
    .from('authmap_user_identities')
    .select('user_id, provider_metadata')
    .eq('provider', 'toss')
    .eq('provider_subject', providerSubjectHash)
    .maybeSingle();
  if (identityResponse.error) return json({ error: 'Identity lookup failed' }, headers, 500);

  if (!identityResponse.data?.user_id) {
    return json({ disconnected: true, matched: false, reason: reasonCandidate }, headers);
  }

  const identityData = identityResponse.data as { user_id: string; provider_metadata?: unknown };
  const existingProviderMetadata = isRecord(identityData.provider_metadata) ? identityData.provider_metadata : {};
  const ownerAuthUserId = typeof existingProviderMetadata.authUserId === 'string' ? existingProviderMetadata.authUserId : '';
  const disconnectedAt = new Date().toISOString();
  const referrer = typeof body.referrer === 'string' ? body.referrer : undefined;
  const unlinkResponse = await admin
    .from('authmap_user_identities')
    .update({
      provider_metadata: {
        ...existingProviderMetadata,
        disconnectReason: reasonCandidate,
        disconnectedAt,
        ...(referrer ? { disconnectReferrer: referrer } : {}),
      },
      unlinked_at: disconnectedAt,
    })
    .eq('provider', 'toss')
    .eq('provider_subject', providerSubjectHash);
  if (unlinkResponse.error) return json({ error: 'Identity unlink failed' }, headers, 500);

  const cleanupError = await clearZipcheckUserData(admin, identityData.user_id, ownerAuthUserId);
  if (cleanupError) return json({ error: 'ZipCheck data cleanup failed' }, headers, 500);

  return json({ disconnected: true, matched: true, reason: reasonCandidate }, headers);
};

Deno.serve(async (request) => {
  const { allowed, headers } = resolveCorsHeaders(request);
  if (request.method === 'OPTIONS') {
    return new Response(allowed ? 'ok' : 'origin blocked', { status: allowed ? 200 : 403, headers });
  }
  if (!allowed) return json({ error: 'Origin is not allowed' }, headers, 403);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase server env is not configured' }, headers, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const isDisconnectCallback = new URL(request.url).pathname.endsWith('/disconnect');
  if (isDisconnectCallback) {
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, headers, 405);
    return handleDisconnectCallback(request, admin, headers);
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, headers, 405);

  if (!anonKey) {
    return json({ error: 'Supabase public server env is not configured' }, headers, 500);
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) return json({ error: 'Missing authorization header' }, headers, 401);

  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
  if (!bearerToken) return json({ error: 'Missing bearer token' }, headers, 401);

  const userResponse = await admin.auth.getUser(bearerToken);
  if (userResponse.error || !userResponse.data.user) {
    return json({ error: 'Invalid Supabase session' }, headers, 401);
  }

  const body = await request.json().catch(() => null) as TossLoginRequest | null;
  if (body?.action === 'status') {
    return handleConnectionStatus(body, admin, userResponse.data.user.id, headers);
  }

  const authorizationCode = typeof body?.authorizationCode === 'string' ? body.authorizationCode.trim() : '';
  const referrer = body?.referrer === 'SANDBOX' ? 'SANDBOX' : 'DEFAULT';
  if (!authorizationCode) return json({ error: 'Missing Toss authorization code' }, headers, 400);

  const exchangeUrl = Deno.env.get('TOSS_LOGIN_TOKEN_EXCHANGE_URL');
  if (!exchangeUrl) {
    return json({
      error: 'Toss login token exchange endpoint is not configured',
      linked: false,
    }, headers, 501);
  }

  const exchangeResponse = await fetch(exchangeUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authorizationCode, referrer }),
  });
  if (!exchangeResponse.ok) {
    return json({ error: 'Toss login token exchange failed' }, headers, 502);
  }

  const exchangePayload = await exchangeResponse.json().catch(() => null) as { providerSubjectHash?: unknown } | null;
  const providerSubjectHash = typeof exchangePayload?.providerSubjectHash === 'string' ? exchangePayload.providerSubjectHash.trim() : '';
  if (!providerSubjectHash) return json({ error: 'Toss identity hash is missing' }, headers, 502);

  const existingResponse = await admin
    .from('authmap_user_identities')
    .select('user_id, provider_metadata')
    .eq('provider', 'toss')
    .eq('provider_subject', providerSubjectHash)
    .maybeSingle();
  if (existingResponse.error) return json({ error: 'Identity lookup failed' }, headers, 500);

  let coreUserId = existingResponse.data?.user_id as string | undefined;
  const linkedAt = new Date().toISOString();
  if (!coreUserId) {
    const coreResponse = await admin
      .from('core_users')
      .insert({ default_locale: 'ko' })
      .select('id')
      .single();
    if (coreResponse.error || !coreResponse.data?.id) return json({ error: 'Core user creation failed' }, headers, 500);
    coreUserId = coreResponse.data.id as string;

    const linkResponse = await admin
      .from('authmap_user_identities')
      .insert({
        user_id: coreUserId,
        provider: 'toss',
        provider_subject: providerSubjectHash,
        provider_metadata: { referrer, authUserId: userResponse.data.user.id },
      });
    if (linkResponse.error) return json({ error: 'Identity link creation failed' }, headers, 500);
  } else {
    const existingLoginProviderMetadata = isRecord(existingResponse.data?.provider_metadata)
      ? existingResponse.data.provider_metadata
      : {};
    const updateResponse = await admin
      .from('authmap_user_identities')
      .update({
        provider_metadata: {
          ...existingLoginProviderMetadata,
          referrer,
          authUserId: userResponse.data.user.id,
          relinkedAt: linkedAt,
        },
        linked_at: linkedAt,
        unlinked_at: null,
      })
      .eq('provider', 'toss')
      .eq('provider_subject', providerSubjectHash);
    if (updateResponse.error) return json({ error: 'Identity link update failed' }, headers, 500);
  }

  return json({ linked: true, coreUserId }, headers);
});
