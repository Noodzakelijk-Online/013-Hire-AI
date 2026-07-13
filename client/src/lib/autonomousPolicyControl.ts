export type AutonomousPolicyControlStatus =
  | "blocked"
  | "monitoring_attention"
  | "paused"
  | "review_ready"
  | "manual_ready"
  | "follow_up_ready"
  | "ready_to_run"
  | "scheduled"
  | "idle";

export type AutonomousPolicyControlRisk = "low" | "medium" | "high";

export type AutonomousPolicyControlActionId =
  | "fix_profile"
  | "reconnect_inbox"
  | "resume_campaign"
  | "open_review_queue"
  | "open_applications"
  | "run_agent"
  | "review_jobs";

export interface AutonomousPolicyControlAction {
  id: AutonomousPolicyControlActionId;
  status: AutonomousPolicyControlStatus;
  label: string;
  headline: string;
  detail: string;
  cta: string;
  route: string;
  risk: AutonomousPolicyControlRisk;
  approvalGated: boolean;
  runsAgent: boolean;
}

export interface AutonomousPolicyControlPlanLike {
  summary?: {
    eligible?: number | null;
    queuedForReview?: number | null;
    manualApply?: number | null;
    followUpsDue?: number | null;
    dailyRemaining?: number | null;
    policyWarnings?: number | null;
  } | null;
  nextActions?: string[] | null;
  policyWarnings?: string[] | null;
  evidenceGates?: Array<{
    label?: string | null;
    detail?: string | null;
    severity?: "low" | "medium" | "high" | string | null;
  }> | null;
}

export interface AutonomousPolicyControlSchedulerLike {
  isStarted?: boolean | null;
  userEnabled?: boolean | null;
  errorCount?: number | null;
  inboxMonitoringFailures?: number | null;
  nextCycleAt?: string | Date | null;
}

export interface AutonomousPolicyControlSettingsLike {
  autonomousEnabled?: boolean | null;
  requireHumanReview?: boolean | null;
}

export interface AutonomousPolicyControlCampaignLike {
  status?: "active" | "paused" | "completed" | "archived" | string | null;
}

function count(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function firstProfileWarning(warnings: string[]) {
  return warnings.find((warning) => /resume|profile|skill|evidence/i.test(warning)) || null;
}

function firstEvidenceGate(
  gates: NonNullable<AutonomousPolicyControlPlanLike["evidenceGates"]>
) {
  return gates.find((gate) => gate.severity === "high") || gates[0] || null;
}

export function getAutonomousPolicyControlAction({
  plan,
  scheduler,
  settings,
  campaign,
}: {
  plan?: AutonomousPolicyControlPlanLike | null;
  scheduler?: AutonomousPolicyControlSchedulerLike | null;
  settings?: AutonomousPolicyControlSettingsLike | null;
  campaign?: AutonomousPolicyControlCampaignLike | null;
}): AutonomousPolicyControlAction {
  const summary = plan?.summary;
  const warnings = plan?.policyWarnings || [];
  const profileWarning = firstProfileWarning(warnings);
  const evidenceGate = firstEvidenceGate(plan?.evidenceGates || []);
  const queuedForReview = count(summary?.queuedForReview);
  const manualApply = count(summary?.manualApply);
  const followUpsDue = count(summary?.followUpsDue);
  const eligible = count(summary?.eligible);
  const dailyRemaining =
    typeof summary?.dailyRemaining === "number" && Number.isFinite(summary.dailyRemaining)
      ? summary.dailyRemaining
      : null;
  const inboxMonitoringFailures = count(scheduler?.inboxMonitoringFailures);

  if (campaign?.status === "paused") {
    return {
      id: "resume_campaign",
      status: "paused",
      label: "Campaign paused",
      headline: "Autonomous work is paused for this job-search campaign.",
      detail: "Resume the campaign from the command dashboard before Hire.AI creates new review items or follow-up drafts.",
      cta: "Resume campaign",
      route: "/dashboard",
      risk: "medium",
      approvalGated: false,
      runsAgent: false,
    };
  }

  if (profileWarning) {
    return {
      id: "fix_profile",
      status: "blocked",
      label: "Profile evidence gate",
      headline: "Autonomous preparation is blocked by missing candidate evidence.",
      detail: profileWarning,
      cta: "Improve profile",
      route: "/profile",
      risk: "high",
      approvalGated: true,
      runsAgent: false,
    };
  }

  if (evidenceGate) {
    return {
      id: "fix_profile",
      status: "blocked",
      label: evidenceGate.label || "Evidence gate",
      headline: "Autonomous execution is gated by profile or connector evidence.",
      detail: evidenceGate.detail || "Complete the required profile evidence or connector setup before relying on external automation.",
      cta: "Resolve evidence",
      route: "/profile",
      risk: evidenceGate.severity === "high" ? "high" : "medium",
      approvalGated: true,
      runsAgent: false,
    };
  }

  if (inboxMonitoringFailures > 0) {
    return {
      id: "reconnect_inbox",
      status: "monitoring_attention",
      label: "Inbox monitoring needs attention",
      headline: `${inboxMonitoringFailures} inbox monitor${inboxMonitoringFailures === 1 ? "" : "s"} failed during the latest autonomous run.`,
      detail: "Reconnect or review Gmail and Outlook recruiting-message access before relying on Hire.AI to surface employer replies.",
      cta: "Review inbox connection",
      route: "/profile",
      risk: "medium",
      approvalGated: false,
      runsAgent: false,
    };
  }

  if (queuedForReview > 0) {
    return {
      id: "open_review_queue",
      status: "review_ready",
      label: "Review-gated work",
      headline: `${queuedForReview} prepared job${queuedForReview === 1 ? "" : "s"} need review before submission.`,
      detail: "Open the review queue to approve, reject, or inspect prepared applications before any external submission can happen.",
      cta: "Open review queue",
      route: "/review-queue",
      risk: "high",
      approvalGated: true,
      runsAgent: false,
    };
  }

  if (manualApply > 0) {
    return {
      id: "open_applications",
      status: "manual_ready",
      label: "Manual handoff",
      headline: `${manualApply} manual application task${manualApply === 1 ? "" : "s"} need handling.`,
      detail: "Unsupported platforms should become explicit manual tasks instead of being treated as submitted automation.",
      cta: "Open applications",
      route: "/applications",
      risk: "medium",
      approvalGated: true,
      runsAgent: false,
    };
  }

  if (followUpsDue > 0) {
    return {
      id: "open_applications",
      status: "follow_up_ready",
      label: "Follow-up draft window",
      headline: `${followUpsDue} follow-up${followUpsDue === 1 ? "" : "s"} can be drafted from application activity.`,
      detail: "Draft follow-ups from ledger state, then require review before anything is sent externally.",
      cta: "Open applications",
      route: "/applications",
      risk: "medium",
      approvalGated: true,
      runsAgent: false,
    };
  }

  if (dailyRemaining === 0) {
    return {
      id: "review_jobs",
      status: "idle",
      label: "Daily limit reached",
      headline: "Today's autonomous preparation limit is already used.",
      detail: "Wait for the next cycle or adjust the daily limit before creating more application work.",
      cta: "Review jobs",
      route: "/jobs",
      risk: "low",
      approvalGated: false,
      runsAgent: false,
    };
  }

  if (eligible > 0 && settings?.autonomousEnabled !== true) {
    return {
      id: "run_agent",
      status: "ready_to_run",
      label: "Manual run available",
      headline: `${eligible} eligible match${eligible === 1 ? "" : "es"} can be processed now.`,
      detail: "Run the agent manually to create controlled review items and follow-up drafts under the current safety policy.",
      cta: "Run agent now",
      route: "/ai-preferences",
      risk: settings?.requireHumanReview === false ? "high" : "medium",
      approvalGated: settings?.requireHumanReview !== false,
      runsAgent: true,
    };
  }

  if (settings?.autonomousEnabled === true && scheduler?.isStarted && scheduler?.userEnabled) {
    return {
      id: "review_jobs",
      status: "scheduled",
      label: "Scheduled",
      headline: "Background preparation is scheduled under the current policy.",
      detail: scheduler.nextCycleAt
        ? `Next scheduler check is ${new Date(scheduler.nextCycleAt).toLocaleString()}.`
        : "The scheduler is enabled and will create review-safe work as matching jobs appear.",
      cta: "Review jobs",
      route: "/jobs",
      risk: "low",
      approvalGated: settings.requireHumanReview !== false,
      runsAgent: false,
    };
  }

  return {
    id: eligible > 0 ? "run_agent" : "review_jobs",
    status: eligible > 0 ? "ready_to_run" : "idle",
    label: eligible > 0 ? "Ready" : "No eligible work",
    headline: eligible > 0
      ? `${eligible} eligible match${eligible === 1 ? "" : "es"} are ready for a controlled run.`
      : "No autonomous work is ready from the current plan.",
    detail: eligible > 0
      ? "Run the agent manually or enable scheduled runs after confirming the safety policy."
      : "Review jobs, adjust filters, or wait for stronger discovery results.",
    cta: eligible > 0 ? "Run agent now" : "Review jobs",
    route: eligible > 0 ? "/ai-preferences" : "/jobs",
    risk: eligible > 0 ? "medium" : "low",
    approvalGated: settings?.requireHumanReview !== false,
    runsAgent: eligible > 0,
  };
}
