import { describe, expect, it } from 'vitest';
import { createDefaultCaseRepository } from './defaultBackend';

describe('default backend selection', () => {
  it('keeps local fallback when Supabase public env is absent', () => {
    const repository = createDefaultCaseRepository({ env: {} });

    expect(repository.getStatus()).toMatchObject({
      mode: 'local',
      remoteReady: false,
    });
  });
});
