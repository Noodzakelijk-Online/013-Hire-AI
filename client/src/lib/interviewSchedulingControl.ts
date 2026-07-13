export type InterviewSchedulingRequirement =
  | "missing_schedule"
  | "cancelled_schedule"
  | "new_invite"
  | null
  | undefined;

export type InterviewSchedulingAction =
  | "schedule-interview"
  | "record-interview-invitation";

export interface InterviewSchedulingControl {
  badgeLabel: string;
  badgeClassName: string;
  description: string;
  action: InterviewSchedulingAction;
  actionLabel: string;
  canSchedule: boolean;
}

export function getInterviewSchedulingControl(
  requirement: InterviewSchedulingRequirement
): InterviewSchedulingControl {
  if (requirement === "new_invite") {
    return {
      badgeLabel: "New interview round",
      badgeClassName: "border-blue-500/40 text-blue-300",
      description: "A recorded employer invitation is ready for the time, channel, interviewer, and notes to be captured.",
      action: "schedule-interview",
      actionLabel: "Schedule Interview",
      canSchedule: true,
    };
  }

  if (requirement === "cancelled_schedule") {
    return {
      badgeLabel: "Schedule cancelled",
      badgeClassName: "border-amber-500/40 text-amber-300",
      description: "Record a fresh employer invitation before scheduling another interview time.",
      action: "record-interview-invitation",
      actionLabel: "Record New Invitation",
      canSchedule: false,
    };
  }

  return {
    badgeLabel: "Invitation evidence missing",
    badgeClassName: "border-amber-500/40 text-amber-300",
    description: "Record the employer interview invitation before scheduling any interview details.",
    action: "record-interview-invitation",
    actionLabel: "Record Invitation",
    canSchedule: false,
  };
}
