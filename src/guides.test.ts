import { describe, expect, it } from 'vitest';
import { TEMPLATE } from './domain';
import { GUIDE_ENTRIES, GUIDE_SOURCES, resolveGuide, resolveGuideBranches } from './guides';

const alertIds = TEMPLATE.phaseOrder.flatMap((phaseKey) => TEMPLATE.alertsByPhase[phaseKey].map((alert) => alert.id));
const bannedPhrases = ['보장', '문제없음', '안전 확정', '법적으로 충분', '대신 처리', '이대로 하면 됨'];

describe('guide content seed', () => {
  it('has one guide entry for every checklist and reference item', () => {
    expect(Object.keys(GUIDE_ENTRIES).sort()).toEqual([...alertIds].sort());

    for (const alertId of alertIds) {
      const guide = resolveGuide(alertId);
      expect(guide.summary.length).toBeGreaterThan(10);
      expect(guide.bullets.length).toBeGreaterThanOrEqual(2);
      expect(guide.done.length).toBeGreaterThan(8);
      expect(guide.sourceLabels.every((label) => GUIDE_SOURCES[label])).toBe(true);
    }
  });

  it('marks P0-only guides and P1/P2 guides explicitly', () => {
    expect(resolveGuide('contract_copy').tier).toBe('P0');
    expect(resolveGuide('contract_signature').tier).toBe('P0');
    expect(resolveGuide('deposit_ref_parties').tier).toBe('P0');
    expect(resolveGuide('post_archive').tier).toBe('P0');
    expect(resolveGuide('pre_docs').tier).toBe('P1_P2');
    expect(resolveGuide('deposit_ref_docs').itemKind).toBe('reference');
  });

  it('returns only matched P2 transaction and property branches', () => {
    const branches = resolveGuideBranches(resolveGuide('pre_docs'), 'jeonse', 'villa_multi');
    const joined = [...branches.transaction, ...branches.property].join(' ');

    expect(joined).toContain('전세');
    expect(joined).toContain('빌라');
    expect(joined).not.toContain('매매는');
    expect(joined).not.toContain('아파트');
  });

  it('keeps runtime guide copy in broker-owned wording', () => {
    const guideText = JSON.stringify(GUIDE_ENTRIES);
    for (const phrase of bannedPhrases) {
      expect(guideText).not.toContain(phrase);
    }
  });
});
