import type {
  JobMatchDecisionSummary,
  JobMatchRecommendedDecision,
} from "./jobMatchDecisionSummary";

export type JobSourcingControlStatus =
  | "empty"
  | "blocked"
  | "review_ready"
  | "manual_tasks"
  | "save_for_later"
  | "low_signal";

export interface JobSourcingControlSummary {
  status: JobSourcingControlStatus;
  label: string;
  headline: string;
  nextAction: string;
  primaryTab: "all" | "excellent" | "good" | "fair" | "decided";
  primaryCta: string;
  totalJobs: number;
  reviewReady: number;
  manualTasks: number;
  saveForLater: number;
  ignored: number;
  decided: number;
  blocked: number;
  highRisk: number;
  highMatch: number;
  averageScore: number;
}

export interface JobSourcingControlInput {
  matchScore?: number | null;
  matchSummary?: Pick<
    JobMatchDecisionSummary,
    "recommendedDecision" | "riskLevel" | "blockers" | "matchScore" | "isDecided"
  > | null;
}

const RECOMMENDATION_TABS: Record<JobMatchRecommendedDecision, JobSourcingControlSummary["primaryTab"]> = {
  review: "excellent",
  manual_apply: "good",
  save: "good",
  ignore: "fair",
};

function getDecision(job: JobSourcingControlInput): JobMatchRecommendedDecision {
  return job.matchSummary?.recommendedDecision || "save";
}

function getScore(job: JobSourcingControlInput) {
  const score = job.matchSummary?.matchScore ?? job.matchScore ?? 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getJobSourcingControlSummary(
  jobs: JobSourcingControlInput[] = []
): JobSourcingControlSummary {
  const totalJobs = jobs.length;
  const scores = jobs.map(getScore);
  const averageScore = totalJobs > 0
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / totalJobs)
    : 0;
  const reviewReady = jobs.filter((job) => getDecision(job) === "review").length;
  const manualTasks = jobs.filter((job) => getDecision(job) === "manual_apply").length;
  const saveForLater = jobs.filter((job) => getDecision(job) === "save").length;
  const ignored = jobs.filter((job) => getDecision(job) === "ignore").length;
  const decided = jobs.filter((job) => job.matchSummary?.isDecided === true).length;
  const blocked = jobs.filter((job) => (job.matchSummary?.blockers?.length || 0) > 0).length;
  const highRisk = jobs.filter((job) => job.matchSummary?.riskLevel === "high").length;
  const highMatch = jobs.filter((job) => getScore(job) >= 80).length;

  const base = {
    totalJobs,
    reviewReady,
    manualTasks,
    saveForLater,
    ignored,
    decided,
    blocked,
    highRisk,
    highMatch,
    averageScore,
  };

  if (totalJobs === 0) {
    return {
      ...base,
      status: "empty",
      label: "No jobs found",
      headline: "No jobs match the current filters.",
      nextAction: "Loosen filters or refresh discovery before making application decisions.",
      primaryTab: "all",
      primaryCta: "All jobs",
    };
  }

  if (blocked > 0) {
    return {
      ...base,
      status: "blocked",
      label: "Review blockers",
      headline: `${blocked} job${blocked === 1 ? " has" : "s have"} blockers before application materials are prepared.`,
      nextAction: "Open blocked roles first and resolve missing resume, profile evidence, salary, location, or application-destination gaps.",
      primaryTab: "all",
      primaryCta: "Review blockers",
    };
  }

  if (reviewReady > 0) {
    return {
      ...base,
      status: "review_ready",
      label: "Review-ready jobs",
      headline: `${reviewReady} job${reviewReady === 1 ? " is" : "s are"} ready to queue for controlled review.`,
      nextAction: "Queue strong matches for review so materials can be prepared without an external submission.",
      primaryTab: RECOMMENDATION_TABS.review,
      primaryCta: "Open excellent",
    };
  }

  if (manualTasks > 0) {
    return {
      ...base,
      status: "manual_tasks",
      label: "Manual tasks",
      headline: `${manualTasks} job${manualTasks === 1 ? " needs" : "s need"} manual application handling.`,
      nextAction: "Create manual tasks for unsupported platforms instead of pretending automation submitted them.",
      primaryTab: RECOMMENDATION_TABS.manual_apply,
      primaryCta: "Open good",
    };
  }

  if (saveForLater > 0) {
    return {
      ...base,
      status: "save_for_later",
      label: "Save candidates",
      headline: `${saveForLater} job${saveForLater === 1 ? " is" : "s are"} worth saving for later review.`,
      nextAction: "Save partial matches and improve profile evidence before deciding whether to apply.",
      primaryTab: RECOMMENDATION_TABS.save,
      primaryCta: "Open good",
    };
  }

  return {
    ...base,
    status: "low_signal",
    label: "Low signal",
    headline: "Current jobs should be ignored unless the profile or filters change.",
    nextAction: "Adjust filters, wait for better discovery results, or improve profile data to raise match quality.",
    primaryTab: RECOMMENDATION_TABS.ignore,
    primaryCta: "Open fair",
  };
}
