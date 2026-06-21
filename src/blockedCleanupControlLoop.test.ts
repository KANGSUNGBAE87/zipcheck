import { describe, expect, it } from 'vitest';
import { classifyCleanupTask, summarizeCleanupInventory } from './blockedCleanupControlLoop';

describe('blocked cleanup control loop', () => {
  it('classifies every canonical bucket with read-only candidate actions', () => {
    const samples = [
      { id: 'a1', title: 'active', status: 'blocked', tags: ['active-blocker'] as string[] },
      { id: 'a2', title: 'decision', status: 'ready', ownerDecision: true },
      { id: 'a3', title: 'review', status: 'blocked', childId: 'c3', tags: ['review-required'] as string[] },
      { id: 'a4', title: 'timeout', status: 'running', timeoutMinutes: 45 },
      { id: 'a5', title: 'violation', status: 'done', protocolViolation: true },
      { id: 'a6', title: 'duplicate', status: 'blocked', duplicateOf: 'canon-1' },
      { id: 'a7', title: 'unknown', status: 'ready' },
    ] as const;

    expect(classifyCleanupTask(samples[0])).toMatchObject({ bucket: 'active_blocker' });
    expect(classifyCleanupTask(samples[1])).toMatchObject({ bucket: 'owner_decision_required' });
    expect(classifyCleanupTask(samples[2])).toMatchObject({ bucket: 'review_handoff_ready_to_release', candidateAction: { parentId: 'a3', childId: 'c3' } });
    expect(classifyCleanupTask(samples[3])).toMatchObject({ bucket: 'timeout_split_needed' });
    expect(classifyCleanupTask(samples[4])).toMatchObject({ bucket: 'protocol_violation_recovery' });
    expect(classifyCleanupTask(samples[5])).toMatchObject({ bucket: 'parked_duplicate_archive_candidate' });
    expect(classifyCleanupTask(samples[6])).toMatchObject({ bucket: 'unsafe_unknown' });
  });

  it('summarizes bucket counts for a dry-run sample without mutating tasks', () => {
    const tasks = [
      { id: 'a1', title: 'active', status: 'blocked' as const, tags: ['active-blocker'] as string[] },
      { id: 'a2', title: 'duplicate', status: 'blocked' as const, duplicateOf: 'canon-1' },
      { id: 'a3', title: 'review', status: 'blocked' as const, childId: 'c3', tags: ['review-required'] as string[] },
    ];

    const inventory = summarizeCleanupInventory(tasks);
    expect(inventory.buckets.active_blocker).toBe(1);
    expect(inventory.buckets.parked_duplicate_archive_candidate).toBe(1);
    expect(inventory.buckets.review_handoff_ready_to_release).toBe(1);
    expect(inventory.classifications[2]?.candidateAction.evidenceRequired).toContain('tests');
    expect(tasks[0].status).toBe('blocked');
  });
});
