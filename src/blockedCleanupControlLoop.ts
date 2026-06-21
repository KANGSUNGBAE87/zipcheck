export type CleanupBucket =
  | 'active_blocker'
  | 'owner_decision_required'
  | 'review_handoff_ready_to_release'
  | 'timeout_split_needed'
  | 'protocol_violation_recovery'
  | 'parked_duplicate_archive_candidate'
  | 'unsafe_unknown';

export type CleanupCandidateAction = {
  kind: string;
  targetId?: string;
  parentId?: string;
  childId?: string;
  evidenceRequired?: string[];
  note: string;
};

export type CleanupTask = {
  id: string;
  title: string;
  status: 'blocked' | 'ready' | 'todo' | 'running' | 'done';
  parentId?: string;
  childId?: string;
  tags?: string[];
  reason?: string;
  evidence?: string[];
  ownerDecision?: boolean;
  protocolViolation?: boolean;
  timeoutMinutes?: number;
  duplicateOf?: string;
};

export type CleanupClassification = {
  bucket: CleanupBucket;
  candidateAction: CleanupCandidateAction;
};

const hasTag = (task: CleanupTask, tag: string) => task.tags?.includes(tag) ?? false;

export const classifyCleanupTask = (task: CleanupTask): CleanupClassification => {
  if (task.duplicateOf || hasTag(task, 'parked-duplicate')) {
    return {
      bucket: 'parked_duplicate_archive_candidate',
      candidateAction: {
        kind: 'safe-archive-flow',
        targetId: task.id,
        note: `Preserve the canonical chain at ${task.duplicateOf ?? 'existing canonical ref'} and keep the duplicate blocked until helper PASS.`,
      },
    };
  }

  if (task.protocolViolation || hasTag(task, 'protocol-violation')) {
    return {
      bucket: 'protocol_violation_recovery',
      candidateAction: {
        kind: 'micro-split-or-recovery-owner',
        targetId: task.id,
        note: 'Do not blindly retry the broad card; split to the smallest recovery owner and guarded retry path.',
      },
    };
  }

  if (task.ownerDecision || hasTag(task, 'owner-decision')) {
    return {
      bucket: 'owner_decision_required',
      candidateAction: {
        kind: 'prepare-owner-brief',
        targetId: task.id,
        note: 'Prepare a compressed candidate report for CEO/Owner decision; do not mutate the board.',
      },
    };
  }

  if (task.childId && (hasTag(task, 'review-required') || hasTag(task, 'review-handoff'))) {
    return {
      bucket: 'review_handoff_ready_to_release',
      candidateAction: {
        kind: 'report-review-handoff',
        targetId: task.id,
        parentId: task.id,
        childId: task.childId,
        evidenceRequired: ['linked reviewer child', 'tests', 'diff evidence', 'handoff notes'],
        note: `Report exact parent/child ids (${task.id} -> ${task.childId}) and evidence requirements; do not auto-complete without CEO/blocker-manager authorization.`,
      },
    };
  }

  if ((task.timeoutMinutes ?? 0) >= 30 || hasTag(task, 'timeout') || hasTag(task, 'oversized')) {
    return {
      bucket: 'timeout_split_needed',
      candidateAction: {
        kind: 'micro-split',
        targetId: task.id,
        note: 'Recommend micro-split or recovery owner; do not blindly retry a broad task.',
      },
    };
  }

  if (task.status === 'blocked' || hasTag(task, 'active-blocker')) {
    return {
      bucket: 'active_blocker',
      candidateAction: {
        kind: 'triage-active-blocker',
        targetId: task.id,
        note: 'Keep blocked and surface the active blocker; candidate actions only, no board mutation.',
      },
    };
  }

  return {
    bucket: 'unsafe_unknown',
    candidateAction: {
      kind: 'manual-triage',
      targetId: task.id,
      note: 'Insufficient evidence to classify safely; leave untouched and escalate for human review.',
    },
  };
};

export const summarizeCleanupInventory = (tasks: CleanupTask[]) => {
  const buckets: Record<CleanupBucket, number> = {
    active_blocker: 0,
    owner_decision_required: 0,
    review_handoff_ready_to_release: 0,
    timeout_split_needed: 0,
    protocol_violation_recovery: 0,
    parked_duplicate_archive_candidate: 0,
    unsafe_unknown: 0,
  };

  const classifications = tasks.map((task) => {
    const classification = classifyCleanupTask(task);
    buckets[classification.bucket] += 1;
    return { taskId: task.id, ...classification };
  });

  return { buckets, classifications };
};
