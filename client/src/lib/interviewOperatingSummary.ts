export type InterviewOperatingStatus =
  | "not_applicable"
  | "needs_scheduling"
  | "scheduled"
  | "completed"
  | "cancelled";

export interface InterviewApplicationLike {
  status?: string | null;
}

export interface InterviewScheduleLike {
  status?: string | null;
  scheduledAt?: Date | string | null;
}

export interface InterviewOperatingSummary {
  status: InterviewOperatingStatus;
  label: string;
  nextAction: string;
  canSchedule: boolean;
  activeInterviews: number;
  completedInterviews: number;
  cancelledInterviews: number;
  nextInterviewAt: Date | null;
}

function asDate(value?: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getInterviewOperatingSummary(
  application: InterviewApplicationLike | null | undefined,
  interviews: InterviewScheduleLike[] = [],
  now = new Date()
): InterviewOperatingSummary {
  const status = application?.status || "pending";
  const activeInterviews = interviews.filter((interview) =>
    interview.status === "scheduled" || interview.status === "rescheduled"
  );
  const completedInterviews = interviews.filter((interview) => interview.status === "completed").length;
  const cancelledInterviews = interviews.filter((interview) => interview.status === "cancelled").length;
  const futureInterviewDates = activeInterviews
    .map((interview) => asDate(interview.scheduledAt))
    .filter((date): date is Date => date !== null && date.getTime() >= now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  const nextInterviewAt = futureInterviewDates[0] ?? null;

  const base = {
    activeInterviews: activeInterviews.length,
    completedInterviews,
    cancelledInterviews,
    nextInterviewAt,
  };

  if (activeInterviews.length > 0) {
    return {
      ...base,
      status: "scheduled",
      label: "Interview scheduled",
      nextAction: nextInterviewAt
        ? "Prepare for the next interview and update the outcome after it happens."
        : "Review scheduled interview records and update stale outcomes.",
      canSchedule: true,
    };
  }

  if (completedInterviews > 0) {
    return {
      ...base,
      status: "completed",
      label: "Interview completed",
      nextAction: "Record the outcome, next steps, or offer response when the employer follows up.",
      canSchedule: status === "interview",
    };
  }

  if (status === "interview") {
    return {
      ...base,
      status: cancelledInterviews > 0 ? "cancelled" : "needs_scheduling",
      label: cancelledInterviews > 0 ? "Interview cancelled" : "Schedule interview",
      nextAction: cancelledInterviews > 0
        ? "Schedule a new interview only after the employer provides a replacement time."
        : "Turn the employer invite into a scheduled interview with time, channel, and interviewer context.",
      canSchedule: true,
    };
  }

  return {
    ...base,
    status: "not_applicable",
    label: "No interview action",
    nextAction: "Record an employer interview invite before scheduling interview details.",
    canSchedule: false,
  };
}
