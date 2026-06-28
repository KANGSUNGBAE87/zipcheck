import { describe, expect, it, vi } from 'vitest';
import { createAppsInTossAuthAdapter } from './tossAuth';

describe('Apps in Toss auth adapter', () => {
  it('gets only an authorization code from appLogin and exchanges it on the backend', async () => {
    const appLogin = vi.fn(async () => ({ authorizationCode: 'auth-code-123', referrer: 'SANDBOX' as const }));
    const exchangeTossLogin = vi.fn(async () => ({ linked: true, coreUserId: 'core-user-1' }));

    const adapter = createAppsInTossAuthAdapter({ appLogin, exchangeTossLogin });
    const result = await adapter.signInWithToss();

    expect(appLogin).toHaveBeenCalledTimes(1);
    expect(exchangeTossLogin).toHaveBeenCalledWith({ authorizationCode: 'auth-code-123', referrer: 'SANDBOX' });
    expect(result).toEqual({ linked: true, coreUserId: 'core-user-1' });
    expect(JSON.stringify(exchangeTossLogin.mock.calls)).not.toContain('userKey');
  });

  it('exposes a local sign-out hook without calling Toss from the browser', async () => {
    const appLogin = vi.fn(async () => ({ authorizationCode: 'auth-code-123', referrer: 'DEFAULT' as const }));
    const exchangeTossLogin = vi.fn(async () => ({ linked: true, coreUserId: 'core-user-1' }));
    const signOutLocal = vi.fn();

    const adapter = createAppsInTossAuthAdapter({ appLogin, exchangeTossLogin, signOutLocal });
    await adapter.signOutLocal();

    expect(signOutLocal).toHaveBeenCalledTimes(1);
    expect(appLogin).not.toHaveBeenCalled();
    expect(exchangeTossLogin).not.toHaveBeenCalled();
  });

  it('delegates local connection verification to the backend status check', async () => {
    const appLogin = vi.fn(async () => ({ authorizationCode: 'auth-code-123', referrer: 'DEFAULT' as const }));
    const exchangeTossLogin = vi.fn(async () => ({ linked: true, coreUserId: 'core-user-1' }));
    const verifyConnection = vi.fn(async () => true);

    const adapter = createAppsInTossAuthAdapter({ appLogin, exchangeTossLogin, verifyConnection });
    await expect(adapter.verifyLocalConnection('core-user-1')).resolves.toBe(true);

    expect(verifyConnection).toHaveBeenCalledWith('core-user-1');
    expect(appLogin).not.toHaveBeenCalled();
    expect(exchangeTossLogin).not.toHaveBeenCalled();
  });
});
