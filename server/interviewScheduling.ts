export type InterviewSchedulingRequirement =
  | "missing_schedule"
  | "cancelled_schedule"
  | "new_invite"
  | null;

interface InterviewScheduleState {
  status: string | null;
  createdAt: Date;
  employerResponseId?: number | null;
}

export interface InterviewInvitationState {
  id?: number;
  responseType: string;
  receivedAt: Date;
}

export function getLatestSchedulableInterviewInvite(
  schedules: InterviewScheduleState[],
  responses: InterviewInvitationState[]
) {
  const latestInvite = responses
    .filter((response) => response.responseType === "interview_invite")
    .reduce<InterviewInvitationState | null>((latest, response) => {
      const isNewerTimestamp = !latest || response.receivedAt.getTime() > latest.receivedAt.getTime();
      const isNewerSequence = Boolean(
        latest &&
        response.receivedAt.getTime() === latest.receivedAt.getTime() &&
        typeof response.id === "number" &&
        (typeof latest.id !== "number" || response.id > latest.id)
      );
      if (isNewerTimestamp || isNewerSequence) {
        return response;
      }
      return latest;
    }, null);

  if (!latestInvite || hasScheduleConsumedInvite(schedules, latestInvite)) {
    return null;
  }

  return latestInvite;
}

function hasScheduleConsumedInvite(
  schedules: InterviewScheduleState[],
  invite: InterviewInvitationState
) {
  if (typeof invite.id === "number") {
    return schedules.some((schedule) => schedule.employerResponseId === invite.id) || schedules.some(
      (schedule) => schedule.employerResponseId == null && schedule.createdAt.getTime() > invite.receivedAt.getTime()
    );
  }

  return schedules.some((schedule) => schedule.createdAt.getTime() > invite.receivedAt.getTime());
}

export function getInterviewSchedulingRequirement(
  schedules: InterviewScheduleState[],
  responses: InterviewInvitationState[]
): InterviewSchedulingRequirement {
  if (getLatestSchedulableInterviewInvite(schedules, responses)) {
    return "new_invite";
  }

  if (schedules.some((schedule) => ["scheduled", "rescheduled"].includes(schedule.status || "scheduled"))) {
    return null;
  }

  if (schedules.some((schedule) => schedule.status === "cancelled")) {
    return "cancelled_schedule";
  }
  if (schedules.some((schedule) => schedule.status === "completed")) {
    return null;
  }
  return "missing_schedule";
}
