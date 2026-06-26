import { describe, expect, it } from 'vitest';
import { TEMPLATE } from './domain';
import { GUIDE_ENTRIES, GUIDE_SOURCES, guideTierLabel, resolveGuide, resolveGuideBranches } from './guides';

const alertIds = TEMPLATE.phaseOrder.flatMap((phaseKey) => TEMPLATE.alertsByPhase[phaseKey].map((alert) => alert.id));
const bannedPhrases = ['보장', '문제없음', '안전 확정', '법적으로 충분', '대신 처리', '이대로 하면 됨'];
const internalPlanningLabelPattern = new RegExp(['P[0-2]', '기본', `M${'VP'}`, `구${'현'}`].join('|'));

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

  it('marks simple guides and detailed guides explicitly', () => {
    expect(resolveGuide('contract_copy').tier).toBe('simple');
    expect(resolveGuide('contract_signature').tier).toBe('simple');
    expect(resolveGuide('deposit_ref_parties').tier).toBe('simple');
    expect(resolveGuide('post_archive').tier).toBe('simple');
    expect(resolveGuide('pre_docs').tier).toBe('detailed');
    expect(resolveGuide('deposit_ref_docs').itemKind).toBe('reference');
  });

  it('maps internal guide tiers to user-facing labels without P-stage wording', () => {
    expect(guideTierLabel(resolveGuide('contract_copy'))).toBe('확인 가이드');
    expect(guideTierLabel(resolveGuide('pre_docs'))).toBe('상세 가이드');
    expect(guideTierLabel(resolveGuide('contract_copy'))).not.toMatch(internalPlanningLabelPattern);
    expect(guideTierLabel(resolveGuide('pre_docs'))).not.toMatch(internalPlanningLabelPattern);
  });

  it('returns only matched transaction and property guide branches', () => {
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
