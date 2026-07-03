export type ApplicationStatus =
  | "pending"
  | "applied"
  | "viewed"
  | "interview"
  | "offer"
  | "rejected"
  | "accepted"
  | "withdrawn";

const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ReadonlySet<ApplicationStatus>> = {
  pending: new Set<ApplicationStatus>(["applied", "withdrawn"]),
  applied: new Set<ApplicationStatus>(["viewed", "interview", "offer", "rejected", "withdrawn"]),
  viewed: new Set<ApplicationStatus>(["interview", "offer", "rejected", "withdrawn"]),
  interview: new Set<ApplicationStatus>(["offer", "rejected", "withdrawn"]),
  offer: new Set<ApplicationStatus>(["accepted", "rejected", "withdrawn"]),
  rejected: new Set<ApplicationStatus>(),
  accepted: new Set<ApplicationStatus>(),
  withdrawn: new Set<ApplicationStatus>(),
};

export function canTransitionApplicationStatus(
  current: ApplicationStatus,
  next: ApplicationStatus
): boolean {
  return current === next || ALLOWED_TRANSITIONS[current].has(next);
}

export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "rescheduled";

export function canTransitionInterviewStatus(
  current: InterviewStatus,
  next: InterviewStatus
): boolean {
  if (current === next) return true;
  if (current === "scheduled" || current === "rescheduled") {
    return next === "completed" || next === "cancelled" || next === "rescheduled";
  }
  return false;
}
