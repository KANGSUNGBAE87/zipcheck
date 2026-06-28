import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('memo layout guardrails', () => {
  it('anchors row memo dropdowns to the full row on narrow screens so they cannot spill left', () => {
    expect(styles).toMatch(/@media\s*\(max-width:\s*820px\)\s*{[\s\S]*\.row-memo-tools\s*{[\s\S]*width:\s*100%;[\s\S]*}/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*820px\)\s*{[\s\S]*\.row-memo-tools\s+\.memo-review\s*{[\s\S]*position:\s*static;[\s\S]*}/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*820px\)\s*{[\s\S]*\.memo-review-panel\s*{[\s\S]*left:\s*0;[\s\S]*right:\s*auto;[\s\S]*width:\s*min\(280px,\s*100%\);[\s\S]*}/);
  });
});
