export interface ProfileOnboardingReadiness {
  signals?: {
    hasSkills?: boolean;
    hasExperience?: boolean;
    hasWorkHistory?: boolean;
    hasEducation?: boolean;
  };
}

/**
 * Keeps onboarding aligned with the same structured evidence that powers
 * readiness and matching. A profile can be useful before legacy summary
 * fields are populated.
 */
export function shouldShowProfileOnboarding(input: {
  loading: boolean;
  isAuthenticated: boolean;
  tosAccepted: boolean;
  readiness?: ProfileOnboardingReadiness;
}): boolean {
  if (input.loading || !input.isAuthenticated || !input.tosAccepted || !input.readiness) {
    return false;
  }

  const signals = input.readiness.signals;
  return !Boolean(
    signals?.hasSkills ||
    signals?.hasExperience ||
    signals?.hasWorkHistory ||
    signals?.hasEducation
  );
}

/**
 * The dashboard welcome state must not fall back to legacy profile fields.
 * It is a first-application state, backed by the same readiness evidence as
 * the onboarding prompt.
 */
export function shouldShowNewUserDashboard(input: {
  totalApplications: number;
  onboarding: Parameters<typeof shouldShowProfileOnboarding>[0];
}): boolean {
  return input.totalApplications === 0 && shouldShowProfileOnboarding(input.onboarding);
}
