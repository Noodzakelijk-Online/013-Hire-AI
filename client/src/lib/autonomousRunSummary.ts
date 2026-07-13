export interface AutonomousRunSummaryInput {
  queuedApplicationRecords?: number;
  queuedReviewRecords?: number;
  queuedManualRecords?: number;
  queuedFollowUps?: number;
  skippedDuplicateFollowUps?: number;
  skippedSafetyBlockedFollowUps?: number;
  skippedResumeEvidenceActions?: number;
  skippedProfileReadinessActions?: number;
  skippedEvidenceGatedActions?: number;
  skippedStaleJobActions?: number;
  skippedEmptySourceActions?: number;
  userDecisionLockedJobs?: number;
  inboxProvidersScanned?: number;
  inboxCandidatesDiscovered?: number;
  inboxMonitoringFailures?: number;
  evidenceGates?: Array<{ id?: string; label?: string; severity?: string }>;
  failedActions?: number;
  summary?: {
    expiredJobsSkipped?: number;
  };
}

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

export function getAutonomousRunCounts(result: AutonomousRunSummaryInput) {
  const followUpDrafts = result.queuedFollowUps || 0;
  const jobTasks =
    (result.queuedApplicationRecords || 0) +
    (result.queuedReviewRecords || 0) +
    (result.queuedManualRecords || 0);

  return {
    jobTasks,
    followUpDrafts,
    skippedFollowUps: result.skippedDuplicateFollowUps || 0,
    safetyBlockedFollowUps: result.skippedSafetyBlockedFollowUps || 0,
    resumeEvidenceBlockedActions: result.skippedResumeEvidenceActions || 0,
    profileReadinessBlockedActions: result.skippedProfileReadinessActions || 0,
    evidenceGatedActions: result.skippedEvidenceGatedActions || 0,
    staleJobActionsSkipped: result.skippedStaleJobActions || 0,
    emptySourceActionsSkipped: result.skippedEmptySourceActions || 0,
    userDecisionLockedJobs: result.userDecisionLockedJobs || 0,
    inboxProvidersScanned: result.inboxProvidersScanned || 0,
    inboxCandidatesDiscovered: result.inboxCandidatesDiscovered || 0,
    inboxMonitoringFailures: result.inboxMonitoringFailures || 0,
    evidenceGates: result.evidenceGates?.length || 0,
    expiredJobsSkipped: result.summary?.expiredJobsSkipped || 0,
    failures: result.failedActions || 0,
    totalCreated: jobTasks + followUpDrafts,
  };
}

/**
 * A completed run can still leave work blocked or monitoring degraded. Keep
 * every operator surface consistent about when that outcome needs attention.
 */
export function hasAutonomousRunAttention(result: AutonomousRunSummaryInput) {
  const counts = getAutonomousRunCounts(result);
  return (
    counts.failures > 0 ||
    counts.inboxMonitoringFailures > 0 ||
    counts.resumeEvidenceBlockedActions > 0 ||
    counts.profileReadinessBlockedActions > 0 ||
    counts.evidenceGatedActions > 0 ||
    counts.emptySourceActionsSkipped > 0 ||
    counts.safetyBlockedFollowUps > 0
  );
}

export function formatAutonomousRunSummary(result: AutonomousRunSummaryInput) {
  const counts = getAutonomousRunCounts(result);
  const parts: string[] = [];

  if (counts.jobTasks > 0) {
    parts.push(plural(counts.jobTasks, "job task"));
  }
  if (counts.followUpDrafts > 0) {
    parts.push(plural(counts.followUpDrafts, "follow-up draft"));
  }

  const createdSummary = parts.length > 0
    ? `Queued ${parts.join(" and ")}`
    : "Autonomous run completed with no new tasks";

  const notes: string[] = [];
  if (counts.skippedFollowUps > 0) {
    notes.push(`${plural(counts.skippedFollowUps, "duplicate follow-up")} skipped`);
  }
  if (counts.safetyBlockedFollowUps > 0) {
    notes.push(`${plural(counts.safetyBlockedFollowUps, "follow-up")} paused for higher-priority review`);
  }
  if (counts.resumeEvidenceBlockedActions > 0) {
    notes.push(`${plural(counts.resumeEvidenceBlockedActions, "application preparation")} blocked until an active resume is linked`);
  }
  if (counts.profileReadinessBlockedActions > 0) {
    notes.push(`${plural(counts.profileReadinessBlockedActions, "application preparation")} blocked until core profile evidence is complete`);
  }
  if (counts.evidenceGatedActions > 0) {
    notes.push(`${plural(counts.evidenceGatedActions, "external action")} gated by profile or connector evidence`);
  } else if (counts.evidenceGates > 0) {
    notes.push(`${plural(counts.evidenceGates, "evidence gate")} active`);
  }
  if (counts.expiredJobsSkipped > 0) {
    notes.push(`${plural(counts.expiredJobsSkipped, "expired or stale job posting")} excluded`);
  }
  if (counts.staleJobActionsSkipped > 0) {
    notes.push(`${plural(counts.staleJobActionsSkipped, "job preparation")} blocked after a final listing freshness check`);
  }
  if (counts.emptySourceActionsSkipped > 0) {
    notes.push(`${plural(counts.emptySourceActionsSkipped, "job preparation")} blocked because every observed source reported no listings`);
  }
  if (counts.userDecisionLockedJobs > 0) {
    notes.push(`${plural(counts.userDecisionLockedJobs, "job")} retained under an explicit user decision`);
  }
  if (counts.inboxCandidatesDiscovered > 0) {
    notes.push(`${plural(counts.inboxCandidatesDiscovered, "inbox response candidate")} queued for confirmation`);
  }
  if (counts.inboxMonitoringFailures > 0) {
    notes.push(`${plural(counts.inboxMonitoringFailures, "inbox monitor")} needs attention`);
  }
  if (counts.failures > 0) {
    notes.push(`${plural(counts.failures, "action")} failed`);
  }

  return notes.length > 0
    ? `${createdSummary}; ${notes.join("; ")}`
    : createdSummary;
}
