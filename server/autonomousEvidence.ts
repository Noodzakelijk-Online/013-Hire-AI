import type { UserProfile } from "../drizzle/schema";
import {
  getEducationEntries,
  getUserApplications,
  getUserProfile,
  getUserSkills,
  getWorkExperiences,
  listUserConnectorAccounts,
} from "./db";
import { calculateProfileReadiness } from "./profileReadiness";
import { getActiveResume } from "./resumeStorage";
import { getProfileEvidenceControlSummary } from "@shared/profileEvidence";
import { buildAutonomousEvidenceGates } from "@shared/autonomousEvidenceGates";
import { getConnectorReadinessQueue } from "./applicationCampaigns";

type UserApplicationRecord = Awaited<ReturnType<typeof getUserApplications>>[number];

export interface AutonomousEvidenceContextOptions {
  profile?: UserProfile | null;
  applications?: UserApplicationRecord[];
}

export async function getAutonomousEvidenceContext(
  userId: number,
  options: AutonomousEvidenceContextOptions = {}
) {
  const [
    profile,
    applications,
    workExperiences,
    educationEntries,
    skills,
    connectorAccounts,
    activeResume,
  ] = await Promise.all([
    options.profile !== undefined ? Promise.resolve(options.profile) : getUserProfile(userId),
    options.applications !== undefined ? Promise.resolve(options.applications) : getUserApplications(userId),
    getWorkExperiences(userId),
    getEducationEntries(userId),
    getUserSkills(userId),
    listUserConnectorAccounts(userId),
    getActiveResume(userId),
  ]);

  const readiness = calculateProfileReadiness({
    profile: profile ?? undefined,
    workExperiences,
    educationEntries,
    skills,
    hasActiveResumeArtifact: Boolean(activeResume),
  });
  const profileEvidence = getProfileEvidenceControlSummary({
    profile,
    readiness,
    hasActiveResumeArtifact: Boolean(activeResume),
    connectorAccounts: connectorAccounts.map((account) => ({
      provider: account.provider,
      status: account.status,
      externalAccountLabel: account.externalAccountLabel,
      consentScopes: account.consentScopes,
      lastVerifiedAt: account.lastVerifiedAt,
    })),
  });
  const connectorReadiness = getConnectorReadinessQueue({
    profile,
    applications,
    providers: profileEvidence.providers,
    hasActiveResumeArtifact: Boolean(activeResume),
  });

  return {
    readiness,
    profileEvidence,
    connectorReadiness,
    evidenceGates: buildAutonomousEvidenceGates({
      profileEvidence,
      connectorReadiness,
    }),
  };
}
