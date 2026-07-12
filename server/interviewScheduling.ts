export type InterviewSchedulingRequirement =
  | "missing_schedule"
  | "cancelled_schedule"
  | "new_invite"
  | null;

interface InterviewScheduleState {
  status: string | null;
  createdAt: Date;
}

interface EmployerResponseState {
  responseType: string;
  receivedAt: Date;
}

function latestInterviewInvite(responses: EmployerResponseState[]) {
  return responses
    .filter((response) => response.responseType === "interview_invite")
    .reduce<EmployerResponseState | null>((latest, response) => {
      if (!latest || response.receivedAt.getTime() > latest.receivedAt.getTime()) {
        return response;
      }
      return latest;
    }, null);
}

function hasScheduleCreatedAfter(schedules: InterviewScheduleState[], receivedAt: Date) {
  return schedules.some((schedule) => schedule.createdAt.getTime() > receivedAt.getTime());
}

export function getInterviewSchedulingRequirement(
  schedules: InterviewScheduleState[],
  responses: EmployerResponseState[]
): InterviewSchedulingRequirement {
  if (schedules.some((schedule) => ["scheduled", "rescheduled"].includes(schedule.status || "scheduled"))) {
    return null;
  }

  const latestInvite = latestInterviewInvite(responses);
  if (latestInvite && !hasScheduleCreatedAfter(schedules, latestInvite.receivedAt)) {
    return "new_invite";
  }

  if (schedules.some((schedule) => schedule.status === "cancelled")) {
    return "cancelled_schedule";
  }
  if (schedules.some((schedule) => schedule.status === "completed")) {
    return null;
  }
  return "missing_schedule";
}
