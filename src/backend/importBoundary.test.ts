import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('SDK import boundaries', () => {
  it('keeps product UI and domain files behind adapters', () => {
    ['src/App.tsx', 'src/domain.ts', 'src/storage.ts'].forEach((path) => {
      const source = read(path);
      expect(source).not.toContain('@supabase/supabase-js');
      expect(source).not.toContain('@apps-in-toss/web-framework');
    });
  });

  it('does not add AI provider implementation in this stage', () => {
    ['src/App.tsx', 'src/domain.ts', 'src/storage.ts'].forEach((path) => {
      const source = read(path);
      expect(source).not.toMatch(/deepseek|openai|anthropic|gemini|llm|vision/i);
    });
  });
});
