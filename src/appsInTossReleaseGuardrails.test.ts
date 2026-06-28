import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Apps in Toss release guardrails', () => {
  it('keeps a runnable preflight and release/privacy docs in the repo', () => {
    expect(existsSync(resolve(process.cwd(), 'scripts/apps-in-toss-preflight.mjs'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'docs/apps-in-toss-release-readiness.md'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'docs/privacy-and-data-retention.md'))).toBe(true);

    const packageJson = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    expect(packageJson.scripts?.['preflight:apps-in-toss']).toBe('node scripts/apps-in-toss-preflight.mjs');

    const output = execFileSync('npm', ['run', 'preflight:apps-in-toss', '--', '--skip-dist'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(output).toContain('Apps in Toss preflight passed');
  });

  it('documents human-gated launch actions separately from repo-complete work', () => {
    const releaseDoc = read('docs/apps-in-toss-release-readiness.md');
    expect(releaseDoc).toContain('repo-complete');
    expect(releaseDoc).toContain('Owner-gated');
    expect(releaseDoc).toContain('hard gate for upload');
    expect(releaseDoc).toContain('TOSS_LOGIN_TOKEN_EXCHANGE_URL');
    expect(releaseDoc).toContain('.ait');
    expect(releaseDoc).toContain('QR');
  });

  it('prepares server-only disconnect callback handling without raw Toss identifiers', () => {
    const edgeFunction = read('supabase/functions/zipcheck-toss-login/index.ts');
    expect(edgeFunction).toContain('TossDisconnectReason');
    expect(edgeFunction).toContain('UNLINK');
    expect(edgeFunction).toContain('WITHDRAWAL_TERMS');
    expect(edgeFunction).toContain('WITHDRAWAL_TOSS');
    expect(edgeFunction).toContain('TOSS_DISCONNECT_CALLBACK_SECRET');
    expect(edgeFunction).toContain('TOSS_DISCONNECT_CALLBACK_BASIC_USERNAME');
    expect(edgeFunction).toContain('TOSS_DISCONNECT_CALLBACK_BASIC_PASSWORD');
    expect(edgeFunction).toContain('TOSS_USER_KEY_HASH_SECRET');
    expect(edgeFunction).toContain('userKey');
    expect(edgeFunction).toContain("action === 'status'");
    expect(edgeFunction).toContain('existingLoginProviderMetadata');
    expect(edgeFunction).toContain('relinkedAt');
    expect(edgeFunction).toContain('providerSubjectHash');
    expect(edgeFunction).toContain('provider_metadata');
    expect(edgeFunction).toContain('existingProviderMetadata');
    expect(edgeFunction).toContain('...existingProviderMetadata');
    expect(edgeFunction).toContain('clearZipcheckUserData');
    expect(edgeFunction).not.toMatch(/provider_subject:\s*userKey/);
  });

  it('keeps Apps in Toss package config device-testable and branded', () => {
    const graniteConfig = read('granite.config.ts');
    expect(graniteConfig).toContain('APPS_IN_TOSS_WEB_HOST');
    expect(graniteConfig).toContain('APPS_IN_TOSS_ICON_URL');
    expect(graniteConfig).toContain('zipcheck-icon.svg');
    expect(graniteConfig).not.toMatch(/icon:\s*['"]\s*['"]/);
    expect(graniteConfig).not.toMatch(/host:\s*['"]localhost['"]/);
    expect(existsSync(resolve(process.cwd(), 'public/zipcheck-icon.svg'))).toBe(true);
  });

  it('documents real pre-login storage semantics without claiming local-only behavior', () => {
    const privacyDoc = read('docs/privacy-and-data-retention.md');
    const i18n = read('src/i18n.ts');

    expect(privacyDoc).toContain('Supabase public env');
    expect(privacyDoc).toContain('anonymous Supabase session');
    expect(privacyDoc).toContain('localStorage fallback');
    expect(privacyDoc).not.toContain('Before login, data stays on the device.');
    expect(i18n).not.toContain('Before Toss login, deal titles and memos stay on this device.');
  });
});
