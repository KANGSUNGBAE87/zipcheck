import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const sourceFiles = (dir: string): string[] => readdirSync(resolve(process.cwd(), dir), { withFileTypes: true })
  .flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.test.tsx') ? [path] : [];
  });

const productSurfaceFiles = () => sourceFiles('src')
  .filter((path) => !path.startsWith('src/backend/') && !path.startsWith('src/platform/') && !path.startsWith('src/test/'));

describe('SDK import boundaries', () => {
  it('keeps product UI and domain files behind adapters', () => {
    productSurfaceFiles().forEach((path) => {
      const source = read(path);
      expect(source).not.toContain('@supabase/supabase-js');
      expect(source).not.toContain('@apps-in-toss/web-framework');
    });
  });

  it('does not add AI provider implementation in this stage', () => {
    productSurfaceFiles().forEach((path) => {
      const source = read(path);
      expect(source).not.toMatch(/deepseek|openai|anthropic|gemini|llm|vision/i);
    });
  });
});
