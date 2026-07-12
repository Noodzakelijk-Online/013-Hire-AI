export interface JobSearchAutonomousPolicy {
  mode: "review_first" | "auto_apply";
  remoteOnly: boolean;
  requireHumanReview: boolean;
  allowUnsupportedATS: boolean;
  createFollowUps: boolean;
}

export const defaultJobSearchAutonomousPolicy: JobSearchAutonomousPolicy = {
  mode: "review_first",
  remoteOnly: true,
  requireHumanReview: true,
  allowUnsupportedATS: false,
  createFollowUps: false,
};

function parsePreferences(value?: string | null): Record<string, unknown> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export function getJobSearchAutonomousPolicy(value?: string | null): JobSearchAutonomousPolicy {
  const preferences = parsePreferences(value);
  return {
    mode: preferences.mode === "auto_apply" ? "auto_apply" : "review_first",
    remoteOnly: typeof preferences.remoteOnly === "boolean"
      ? preferences.remoteOnly
      : defaultJobSearchAutonomousPolicy.remoteOnly,
    requireHumanReview: typeof preferences.requireHumanReview === "boolean"
      ? preferences.requireHumanReview
      : defaultJobSearchAutonomousPolicy.requireHumanReview,
    allowUnsupportedATS: preferences.allowUnsupportedATS === true,
    createFollowUps: preferences.createFollowUps === true,
  };
}

export function isJobSearchAutonomousPolicyDirty(
  value: string | null | undefined,
  draft: JobSearchAutonomousPolicy
) {
  const saved = getJobSearchAutonomousPolicy(value);
  return Object.keys(draft).some((key) =>
    draft[key as keyof JobSearchAutonomousPolicy] !== saved[key as keyof JobSearchAutonomousPolicy]
  );
}

export function mergeJobSearchAutonomousPolicy(
  value: string | null | undefined,
  draft: JobSearchAutonomousPolicy
) {
  return JSON.stringify({
    ...parsePreferences(value),
    ...draft,
  });
}
